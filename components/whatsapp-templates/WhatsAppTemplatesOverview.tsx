'use client';

import { useState } from 'react';
import { MessageSquareText, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useQuickTemplatesQuery,
  useCreateQuickTemplate,
  useUpdateQuickTemplate,
  useDeleteQuickTemplate,
} from '@/queries/whatsapp-templates';
import type { QuickTemplate } from '@/services/whatsapp-templates.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmAlert } from '@/components/common/ConfirmAlert';

export function WhatsAppTemplatesOverview() {
  const { data, isLoading } = useQuickTemplatesQuery();
  const templates = (data ?? []) as QuickTemplate[];

  const createMutation = useCreateQuickTemplate();
  const updateMutation = useUpdateQuickTemplate();
  const deleteMutation = useDeleteQuickTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuickTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditing(null);
    setTitle('');
    setBody('');
    setDialogOpen(true);
  }

  function openEdit(t: QuickTemplate) {
    setEditing(t);
    setTitle(t.title);
    setBody(t.body);
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, title: title.trim(), body: body.trim() });
      } else {
        await createMutation.mutateAsync({ title: title.trim(), body: body.trim() });
      }
      setDialogOpen(false);
    } catch {}
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="border-primary/20 bg-linear-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                <MessageSquareText className="h-4 w-4" />
              </span>
              WhatsApp message templates
            </CardTitle>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add template
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick messages shown in a lead&apos;s WhatsApp menu. Use <code className="rounded bg-muted px-1">{'{{name}}'}</code> to insert the customer&apos;s name.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No templates yet. Click <span className="font-medium">Add template</span> to create your first one.
            </div>
          ) : (
            templates.map(t => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{t.title}</p>
                    {!t.isActive && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-3">{t.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="mr-1 flex items-center gap-1.5" title={t.isActive ? 'Visible in the WhatsApp menu' : 'Hidden from the WhatsApp menu'}>
                    <Switch
                      checked={t.isActive}
                      onCheckedChange={(v) => updateMutation.mutate({ id: t.id, isActive: v })}
                    />
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(t.id)} aria-label="Delete">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit template' : 'Add template'}</DialogTitle>
            <DialogDescription>
              Use <code className="rounded bg-muted px-1">{'{{name}}'}</code> anywhere to insert the lead&apos;s name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-title">Title</Label>
              <Input
                id="tpl-title"
                placeholder="Follow-up"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-body">Message</Label>
              <Textarea
                id="tpl-body"
                rows={6}
                placeholder={'Hi {{name}},\n\nHope you are doing well! ...'}
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !title.trim() || !body.trim()}>
              {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmAlert
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete template"
        description="This template will be removed from the WhatsApp menu. This cannot be undone."
        confirmText={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await deleteMutation.mutateAsync(deleteId);
            setDeleteId(null);
          } catch {}
        }}
      />
    </div>
  );
}
