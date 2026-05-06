'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  MessageSquare, Zap, RefreshCw, Video, Rows3,
  ChevronDown, ChevronUp,
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

const emptyForm = {
  name: '',
  formKeyword: '',
  templateName: '',
  language: 'en',
  videoId: '',
  isActive: true,
};

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
        {/* Header bar */}
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

        {/* Expanded: buttons preview */}
        {expanded && buttons.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {buttons.map((b, i) => (
              <span key={i} className="text-[11px] border rounded-full px-2.5 py-0.5 text-muted-foreground">
                {b.text}
              </span>
            ))}
          </div>
        )}

        {/* Footer actions */}
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

export default function WhatsAppPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TemplateRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'rules'>('templates');

  const { data: rules = [], isLoading: rulesLoading } = useQuery<TemplateRule[]>({
    queryKey: ['whatsapp-template-rules'],
    queryFn: () => fetch('/api/whatsapp/template-rules').then(r => r.json()),
  });

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
    setForm({
      ...emptyForm,
      templateName: prefillTemplate,
      name: prefillTemplate ? `${prefillTemplate} rule` : '',
      videoId: prefillVideoRequired ? '' : '',
    });
    setDialogOpen(true);
  };

  const openEdit = (rule: TemplateRule) => {
    setEditingRule(rule);
    setForm({ name: rule.name, formKeyword: rule.formKeyword, templateName: rule.templateName, language: rule.language, videoId: rule.videoId || '', isActive: rule.isActive });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) updateRule.mutate({ id: editingRule.id, data: form });
    else createRule.mutate(form);
  };

  const selectedTemplateMeta = metaTemplates.find(t => t.name === form.templateName);
  const hasVideoHeader = selectedTemplateMeta?.components.some(c => c.type === 'HEADER' && c.format === 'VIDEO');

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
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
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
              rules.map((rule: TemplateRule) => (
                <Card key={rule.id} className={`transition-opacity ${rule.isActive ? '' : 'opacity-55'}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Rule</p>
                        <p className="font-medium truncate">{rule.name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Form keyword</p>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{rule.formKeyword}</code>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Template</p>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{rule.templateName}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateRule.mutate({ id: rule.id, data: { isActive: !rule.isActive } })} title={rule.isActive ? 'Deactivate' : 'Activate'}>
                        {rule.isActive
                          ? <ToggleRight className="h-5 w-5 text-green-500" />
                          : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <button onClick={() => openEdit(rule)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(rule.id)} className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))
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
              <Label>Form Name Keyword <span className="text-muted-foreground font-normal">(case-insensitive)</span></Label>
              <Input placeholder="e.g. bliss glass house" value={form.formKeyword} onChange={e => setForm(f => ({ ...f, formKeyword: e.target.value }))} required />
              <p className="text-xs text-muted-foreground">If the Meta form name contains this text, this rule triggers.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Template</Label>
              {approvedTemplates.length > 0 ? (
                <Select value={form.templateName} onValueChange={v => setForm(f => ({ ...f, templateName: v }))}>
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
                <Label>Video Media ID <span className="text-orange-500 text-xs">(template has video header)</span></Label>
                <Input placeholder="e.g. 860392389677081" value={form.videoId} onChange={e => setForm(f => ({ ...f, videoId: e.target.value }))} />
              </div>
            )}

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
