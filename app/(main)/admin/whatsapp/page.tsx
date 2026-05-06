'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, MessageSquare, Zap, RefreshCw } from 'lucide-react';
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
  components: { type: string; format?: string; text?: string }[];
};

const emptyForm = {
  name: '',
  formKeyword: '',
  templateName: '',
  language: 'en',
  videoId: '',
  isActive: true,
};

export default function WhatsAppPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TemplateRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rules = [], isLoading: rulesLoading } = useQuery<TemplateRule[]>({
    queryKey: ['whatsapp-template-rules'],
    queryFn: () => fetch('/api/whatsapp/template-rules').then(r => r.json()),
  });

  const { data: metaTemplates = [], isLoading: templatesLoading, refetch: refetchTemplates } = useQuery<MetaTemplate[]>({
    queryKey: ['whatsapp-meta-templates'],
    queryFn: () => fetch('/api/whatsapp/meta-templates').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const approvedTemplates = Array.isArray(metaTemplates) ? metaTemplates.filter(t => t.status === 'APPROVED') : [];

  const createRule = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      fetch('/api/whatsapp/template-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['whatsapp-template-rules'] }); setDialogOpen(false); toast.success('Rule created'); },
    onError: () => toast.error('Failed to create rule'),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) =>
      fetch(`/api/whatsapp/template-rules/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['whatsapp-template-rules'] }); setDialogOpen(false); toast.success('Rule updated'); },
    onError: () => toast.error('Failed to update rule'),
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => fetch(`/api/whatsapp/template-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['whatsapp-template-rules'] }); setDeleteId(null); toast.success('Rule deleted'); },
    onError: () => toast.error('Failed to delete rule'),
  });

  const toggleRule = (rule: TemplateRule) => {
    updateRule.mutate({ id: rule.id, data: { isActive: !rule.isActive } });
  };

  const openCreate = () => {
    setEditingRule(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (rule: TemplateRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      formKeyword: rule.formKeyword,
      templateName: rule.templateName,
      language: rule.language,
      videoId: rule.videoId || '',
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateRule.mutate({ id: editingRule.id, data: form });
    } else {
      createRule.mutate(form);
    }
  };

  const selectedTemplateMeta = metaTemplates.find(t => t.name === form.templateName);
  const hasVideoHeader = selectedTemplateMeta?.components.some(c => c.type === 'HEADER' && c.format === 'VIDEO');

  const getCategoryColor = (cat: string) => {
    if (cat === 'MARKETING') return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    if (cat === 'UTILITY') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    return 'bg-green-500/10 text-green-600 border-green-500/20';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Automation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage auto-send rules for incoming leads</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Rule
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Auto-send Rules ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Auto-send Rules</h2>
            <Badge variant="outline" className="ml-auto">{rules.length}</Badge>
          </div>

          {rulesLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-24 rounded-lg bg-muted/50 animate-pulse" />)}
            </div>
          ) : rules.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No rules yet. Add one to start automating.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
                <Card key={rule.id} className={`transition-opacity ${rule.isActive ? '' : 'opacity-60'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{rule.name}</p>
                          <Badge variant="outline" className={`text-xs ${rule.isActive ? 'border-green-500/30 bg-green-500/10 text-green-600' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <p><span className="font-medium text-foreground">Form keyword:</span> <code className="bg-muted px-1 py-0.5 rounded">{rule.formKeyword}</code></p>
                          <p><span className="font-medium text-foreground">Template:</span> <code className="bg-muted px-1 py-0.5 rounded">{rule.templateName}</code></p>
                          {rule.videoId && <p><span className="font-medium text-foreground">Video ID:</span> <code className="bg-muted px-1 py-0.5 rounded">{rule.videoId}</code></p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleRule(rule)}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                          title={rule.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {rule.isActive
                            ? <ToggleRight className="h-4 w-4 text-green-500" />
                            : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => openEdit(rule)}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(rule.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Available Templates from Meta ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Available Templates</h2>
            <Badge variant="outline" className="ml-auto">{approvedTemplates.length} approved</Badge>
            <button
              onClick={() => void refetchTemplates()}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${templatesLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {templatesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />)}
            </div>
          ) : !Array.isArray(metaTemplates) || metaTemplates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-muted-foreground">Could not load templates.<br />Check WHATSAPP_WABA_ID env var.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {metaTemplates.map(t => (
                <Card key={t.name} className={t.status !== 'APPROVED' ? 'opacity-50' : ''}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs font-semibold">{t.name}</code>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getCategoryColor(t.category)}`}>
                            {t.category}
                          </Badge>
                          {t.components.some(c => c.type === 'HEADER' && c.format === 'VIDEO') && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-600 border-orange-500/20">VIDEO</Badge>
                          )}
                          {t.components.some(c => c.type === 'BUTTONS') && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">BUTTONS</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {t.components.find(c => c.type === 'BODY')?.text?.slice(0, 80)}
                          {(t.components.find(c => c.type === 'BODY')?.text?.length ?? 0) > 80 ? '…' : ''}
                        </p>
                      </div>
                      <Badge variant={t.status === 'APPROVED' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {t.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Auto-send Rule'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Rule Name</Label>
              <Input
                placeholder="e.g. Resort Leads Auto-reply"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Form Name Keyword</Label>
              <Input
                placeholder="e.g. bliss glass house"
                value={form.formKeyword}
                onChange={e => setForm(f => ({ ...f, formKeyword: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Case-insensitive. If the Meta form name contains this keyword, the rule triggers.</p>
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
                        <span className="ml-2 text-muted-foreground text-xs">({t.category})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="e.g. resort_intro_message"
                  value={form.templateName}
                  onChange={e => setForm(f => ({ ...f, templateName: e.target.value }))}
                  required
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Language Code</Label>
              <Input
                placeholder="en"
                value={form.language}
                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
              />
            </div>

            {(hasVideoHeader || form.videoId) && (
              <div className="space-y-1.5">
                <Label>Video Media ID {hasVideoHeader && <span className="text-xs text-orange-500">(required — template has video header)</span>}</Label>
                <Input
                  placeholder="e.g. 860392389677081"
                  value={form.videoId}
                  onChange={e => setForm(f => ({ ...f, videoId: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Upload your video via WhatsApp media API to get this ID.</p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Enable or disable this rule</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createRule.isPending || updateRule.isPending}>
                {editingRule ? 'Save Changes' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this auto-send rule. Leads already sent messages won&apos;t be affected.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteRule.mutate(deleteId)} disabled={deleteRule.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
