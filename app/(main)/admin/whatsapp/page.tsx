'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  MessageSquare, Zap, RefreshCw, Video, Rows3,
  ChevronDown, ChevronUp, Check, ChevronsUpDown, User, Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type TemplateRule = {
  id: string;
  name: string;
  formKeyword: string;
  templateName: string;
  language: string;
  videoId: string | null;
  notifyNumber: string | null;
  isActive: boolean;
  createdAt: string;
};

type MetaTemplate = {
  name: string;
  status: string;
  category: string;
  language: string;
  components: { type: string; format?: string; text?: string; buttons?: { text: string }[] }[];
};

const PRAYAGRAJ_VIDEO_ID = '860392389677081';
const KW_SEP = '||';

type FacebookForm = { id: string; name: string; status: string; pageName?: string };

const emptyForm = {
  name: '',
  formKeyword: '',
  templateName: '',
  language: 'en',
  videoId: '',
  notifyNumber: '',
  isActive: true,
};

// ── Multi-select dropdown ─────────────────────────────────────────────────────
function FormMultiSelect({
  forms,
  selected,
  onChange,
  loading,
}: {
  forms: FacebookForm[];
  selected: string[];
  onChange: (v: string[]) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (loading) return <div className="h-9 rounded-md bg-muted/50 animate-pulse" />;

  // Fallback text input when FB forms not available
  if (forms.length === 0) {
    return (
      <Input
        placeholder="e.g. resort leads"
        value={selected[0] ?? ''}
        onChange={e => onChange(e.target.value ? [e.target.value] : [])}
        required
      />
    );
  }

  const allSelected = selected.length === forms.length;
  const toggle = (name: string) => {
    const lower = name.toLowerCase();
    onChange(selected.includes(lower) ? selected.filter(s => s !== lower) : [...selected, lower]);
  };
  const toggleAll = () => onChange(allSelected ? [] : forms.map(f => f.name.toLowerCase()));

  const label =
    selected.length === 0
      ? 'Select forms…'
      : selected.length === forms.length
      ? 'All forms'
      : selected.length === 1
      ? forms.find(f => f.name.toLowerCase() === selected[0])?.name ?? selected[0]
      : `${selected.length} forms selected`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={selected.length === 0 ? 'text-muted-foreground' : ''}>{label}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
          {/* Select All */}
          <button
            type="button"
            onClick={toggleAll}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent border-b font-medium"
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded border ${allSelected ? 'bg-primary border-primary' : 'border-input'}`}>
              {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              {!allSelected && selected.length > 0 && <span className="h-0.5 w-2 bg-primary rounded" />}
            </span>
            Select All ({forms.length})
          </button>
          {forms.map(f => {
            const val = f.name.toLowerCase();
            const checked = selected.includes(val);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.name)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border shrink-0 ${checked ? 'bg-primary border-primary' : 'border-input'}`}>
                  {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                </span>
                <span className="truncate text-left">{f.name}</span>
                {f.status !== 'ACTIVE' && (
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">({f.status})</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected badges */}
      {selected.length > 0 && selected.length < forms.length && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(s => (
            <span key={s} className="inline-flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded-full">
              {forms.find(f => f.name.toLowerCase() === s)?.name ?? s}
              <button type="button" onClick={() => onChange(selected.filter(x => x !== s))} className="text-muted-foreground hover:text-foreground">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────
function TemplateCard({
  t,
  onCreateRule,
}: {
  t: MetaTemplate;
  onCreateRule: (templateName: string, hasVideo: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
  const hasVideo = t.components.some(c => c.type === 'HEADER' && c.format === 'VIDEO');
  const hasButtons = t.components.some(c => c.type === 'BUTTONS');
  const buttons = t.components.find(c => c.type === 'BUTTONS')?.buttons ?? [];

  const catColor: Record<string, string> = {
    MARKETING: 'bg-purple-500/15 text-purple-500 border-purple-500/25',
    UTILITY: 'bg-blue-500/15 text-blue-500 border-blue-500/25',
    AUTHENTICATION: 'bg-green-500/15 text-green-500 border-green-500/25',
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <code className="text-sm font-semibold truncate max-w-[200px]">{t.name}</code>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${catColor[t.category] ?? ''}`}>
                {t.category}
              </Badge>
              {hasVideo && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-orange-500/10 text-orange-500 border-orange-500/20 flex items-center gap-1">
                  <Video className="h-2.5 w-2.5" /> VIDEO
                </Badge>
              )}
              {hasButtons && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {buttons.length} BTN
                </Badge>
              )}
            </div>
            <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
              {body}
            </p>
          </div>
        </div>

        {expanded && buttons.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {buttons.map((b, i) => (
              <span key={i} className="text-[11px] border rounded-full px-2.5 py-0.5 text-muted-foreground">
                {b.text}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Less' : 'Preview'}
          </button>
          {t.status === 'APPROVED' ? (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
              onClick={() => onCreateRule(t.name, hasVideo)}>
              <Zap className="h-3 w-3" /> Create Rule
            </Button>
          ) : (
            <Badge variant="secondary" className="text-[10px]">{t.status}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Rule Card ─────────────────────────────────────────────────────────────────
const FORMS_PREVIEW = 2;

function RuleCard({ rule, keywords, onToggle, onEdit, onDelete }: {
  rule: TemplateRule;
  keywords: string[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? keywords : keywords.slice(0, FORMS_PREVIEW);
  const extra = keywords.length - FORMS_PREVIEW;

  return (
    <Card className={`transition-opacity ${rule.isActive ? '' : 'opacity-55'}`}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Rule</p>
            <p className="font-medium truncate">{rule.name}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Forms</p>
            <div className="flex flex-wrap gap-1">
              {visible.map(k => (
                <code key={k} className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{k}</code>
              ))}
              {!showAll && extra > 0 && (
                <button type="button" onClick={() => setShowAll(true)}
                  className="text-[11px] text-primary underline underline-offset-2">
                  +{extra} more
                </button>
              )}
              {showAll && keywords.length > FORMS_PREVIEW && (
                <button type="button" onClick={() => setShowAll(false)}
                  className="text-[11px] text-muted-foreground underline underline-offset-2">
                  show less
                </button>
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Template</p>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{rule.templateName}</code>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Send To</p>
            {rule.notifyNumber ? (
              <div className="flex flex-col gap-0.5">
                {rule.notifyNumber.split('||').map(n => n.trim()).filter(Boolean).map(n => (
                  <span key={n} className="inline-flex items-center gap-1 text-xs text-orange-500">
                    <Phone className="h-3 w-3 shrink-0" />{n}
                  </span>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />Lead
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onToggle} title={rule.isActive ? 'Deactivate' : 'Activate'}>
            {rule.isActive
              ? <ToggleRight className="h-5 w-5 text-green-500" />
              : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TemplateRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [notifyNumbers, setNotifyNumbers] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'rules'>('templates');

  const { data: rules = [], isLoading: rulesLoading } = useQuery<TemplateRule[]>({
    queryKey: ['whatsapp-template-rules'],
    queryFn: () => fetch('/api/whatsapp/template-rules').then(r => r.json()),
  });

  const { data: fbFormsRaw, isLoading: fbFormsLoading } = useQuery({
    queryKey: ['whatsapp-facebook-forms'],
    queryFn: () => fetch('/api/whatsapp/facebook-forms').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const fbForms: FacebookForm[] = Array.isArray(fbFormsRaw) ? fbFormsRaw : [];

  const { data: metaTemplatesRaw, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ['whatsapp-meta-templates'],
    queryFn: () => fetch('/api/whatsapp/meta-templates').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const metaTemplates: MetaTemplate[] = Array.isArray(metaTemplatesRaw) ? metaTemplatesRaw : [];
  const approvedTemplates = metaTemplates.filter(t => t.status === 'APPROVED');

  const invalidateRules = () => void qc.invalidateQueries({ queryKey: ['whatsapp-template-rules'] });

  const createRule = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      fetch('/api/whatsapp/template-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { invalidateRules(); setDialogOpen(false); setActiveTab('rules'); toast.success('Rule created'); },
    onError: () => toast.error('Failed to create rule'),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) =>
      fetch(`/api/whatsapp/template-rules/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { invalidateRules(); setDialogOpen(false); toast.success('Rule updated'); },
    onError: () => toast.error('Failed to update rule'),
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => fetch(`/api/whatsapp/template-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateRules(); setDeleteId(null); toast.success('Rule deleted'); },
    onError: () => toast.error('Failed to delete rule'),
  });

  const openCreate = (prefillTemplate = '', prefillVideoRequired = false) => {
    setEditingRule(null);
    setSelectedForms([]);
    setNotifyNumbers([]);
    setForm({
      ...emptyForm,
      templateName: prefillTemplate,
      name: prefillTemplate ? `${prefillTemplate} rule` : '',
      videoId: prefillVideoRequired ? PRAYAGRAJ_VIDEO_ID : '',
    });
    setDialogOpen(true);
  };

  const openEdit = (rule: TemplateRule) => {
    setEditingRule(rule);
    const keywords = rule.formKeyword ? rule.formKeyword.split(KW_SEP).map(k => k.trim()).filter(Boolean) : [];
    setSelectedForms(keywords);
    const nums = rule.notifyNumber ? rule.notifyNumber.split(KW_SEP).map(n => n.trim()).filter(Boolean) : [];
    setNotifyNumbers(nums);
    setForm({ name: rule.name, formKeyword: rule.formKeyword, templateName: rule.templateName, language: rule.language, videoId: rule.videoId || '', notifyNumber: rule.notifyNumber || '', isActive: rule.isActive });
    setDialogOpen(true);
  };

  const updateNotifyNumbers = (nums: string[]) => {
    setNotifyNumbers(nums);
    setForm(f => ({ ...f, notifyNumber: nums.filter(Boolean).join(KW_SEP) }));
  };

  const handleFormsChange = (forms: string[]) => {
    setSelectedForms(forms);
    setForm(f => ({ ...f, formKeyword: forms.join(KW_SEP) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) updateRule.mutate({ id: editingRule.id, data: form });
    else createRule.mutate(form);
  };

  const selectedTemplateMeta = metaTemplates.find(t => t.name === form.templateName);
  const hasVideoHeader = selectedTemplateMeta?.components.some(c => c.type === 'HEADER' && c.format === 'VIDEO');

  const handleTemplateChange = (v: string) => {
    const tmpl = metaTemplates.find(t => t.name === v);
    const isVideo = tmpl?.components.some(c => c.type === 'HEADER' && c.format === 'VIDEO') ?? false;
    setForm(f => ({ ...f, templateName: v, videoId: isVideo ? (f.videoId || PRAYAGRAJ_VIDEO_ID) : '' }));
  };

  // Helper: parse stored formKeyword into display badges
  const parseKeywords = (kw: string) => kw.split(KW_SEP).map(k => k.trim()).filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            WhatsApp Automation
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {approvedTemplates.length} approved templates · {Array.isArray(rules) ? rules.filter(r => r.isActive).length : 0} active rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <a href="https://business.facebook.com/latest/whatsapp_manager/message_templates/?business_id=109117231998763&tab=message-templates&filters=%7B%22date_range%22%3A7%2C%22language%22%3A[]%2C%22quality%22%3A[]%2C%22search_text%22%3A%22%22%2C%22status%22%3A[%22APPROVED%22%2C%22IN_APPEAL%22%2C%22PAUSED%22%2C%22PENDING%22%2C%22REJECTED%22]%2C%22tag%22%3A[]%7D&nav_ref=whatsapp_manager&asset_id=757676046966708" target="_blank" rel="noopener noreferrer">
              <Plus className="h-4 w-4" /> Create Template
            </a>
          </Button>
          <Button onClick={() => openCreate()} className="gap-2">
            <Plus className="h-4 w-4" /> Add Rule
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b px-6">
        {([['templates', 'Templates', Rows3], ['rules', 'Auto-send Rules', Zap]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {key === 'rules' && Array.isArray(rules) && rules.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-1.5 py-0.5">{rules.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Templates Tab ── */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{metaTemplates.length} templates total · {approvedTemplates.length} approved</p>
              <button onClick={() => void refetchTemplates()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${templatesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {templatesLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />)}
              </div>
            ) : metaTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No templates found.<br />Check WHATSAPP_WABA_ID env var.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {metaTemplates.map(t => (
                  <TemplateCard
                    key={t.name}
                    t={t}
                    onCreateRule={(name, hasVideo) => openCreate(name, hasVideo)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Rules Tab ── */}
        {activeTab === 'rules' && (
          <div className="space-y-3">
            {rulesLoading ? (
              <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>
            ) : !Array.isArray(rules) || rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Zap className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No rules yet.<br />Go to Templates tab and click &quot;Create Rule&quot; on any template.</p>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('templates')}>
                  Browse Templates
                </Button>
              </div>
            ) : (
              rules.map((rule: TemplateRule) => {
                const keywords = parseKeywords(rule.formKeyword);
                return (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    keywords={keywords}
                    onToggle={() => updateRule.mutate({ id: rule.id, data: { isActive: !rule.isActive } })}
                    onEdit={() => openEdit(rule)}
                    onDelete={() => setDeleteId(rule.id)}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Auto-send Rule'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Rule Name</Label>
              <Input placeholder="e.g. Resort Leads" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>

            <div className="space-y-1.5">
              <Label>Facebook Forms</Label>
              <FormMultiSelect
                forms={fbForms}
                selected={selectedForms}
                onChange={handleFormsChange}
                loading={fbFormsLoading}
              />
              <p className="text-xs text-muted-foreground">Rule triggers when a lead comes from any selected form.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Template</Label>
              {approvedTemplates.length > 0 ? (
                <Select value={form.templateName} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approved template" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedTemplates.map(t => (
                      <SelectItem key={t.name} value={t.name}>
                        <span className="font-mono text-xs">{t.name}</span>
                        <span className="ml-2 text-muted-foreground text-xs">· {t.category}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="e.g. resort_intro_message" value={form.templateName} onChange={e => setForm(f => ({ ...f, templateName: e.target.value }))} required />
              )}
            </div>

            {hasVideoHeader && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Video Media ID
                  <span className="text-orange-500 text-xs font-normal">(template has video header)</span>
                </Label>
                <Input value={form.videoId} onChange={e => setForm(f => ({ ...f, videoId: e.target.value }))} />
                {form.videoId === PRAYAGRAJ_VIDEO_ID && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Video className="h-3 w-3 text-orange-500" /> Prayagraj Resort Video
                  </p>
                )}
                {!form.videoId && (
                  <button
                    type="button"
                    className="text-xs text-primary underline underline-offset-2"
                    onClick={() => setForm(f => ({ ...f, videoId: PRAYAGRAJ_VIDEO_ID }))}
                  >
                    Use Prayagraj Resort Video
                  </button>
                )}
              </div>
            )}

            {/* Send To */}
            <div className="space-y-2">
              <Label>Send To</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setNotifyNumbers([]); setForm(f => ({ ...f, notifyNumber: '' })); }}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${notifyNumbers.length === 0 ? 'border-primary bg-primary/5 text-primary' : 'border-input text-muted-foreground hover:border-muted-foreground'}`}
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Lead&apos;s number</span>
                </button>
                <button
                  type="button"
                  onClick={() => { if (notifyNumbers.length === 0) updateNotifyNumbers(['918178262805']); }}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${notifyNumbers.length > 0 ? 'border-primary bg-primary/5 text-primary' : 'border-input text-muted-foreground hover:border-muted-foreground'}`}
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Fixed number</span>
                </button>
              </div>
              {notifyNumbers.length > 0 && (
                <div className="space-y-2">
                  {notifyNumbers.map((num, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="e.g. 918178262805"
                        value={num}
                        onChange={e => {
                          const updated = [...notifyNumbers];
                          updated[i] = e.target.value;
                          updateNotifyNumbers(updated);
                        }}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => updateNotifyNumbers(notifyNumbers.filter((_, j) => j !== i))}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateNotifyNumbers([...notifyNumbers, ''])}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add another number
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <p className="text-sm font-medium">Active</p>
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createRule.isPending || updateRule.isPending}>
                {editingRule ? 'Save' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Rule?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This rule will stop triggering. Already-sent messages are unaffected.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteRule.mutate(deleteId)} disabled={deleteRule.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
