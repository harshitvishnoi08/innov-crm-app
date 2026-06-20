export type QuickTemplate = {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export async function fetchQuickTemplates(): Promise<QuickTemplate[]> {
  const res = await fetch('/api/whatsapp/quick-templates');
  const json = await res.json();
  if (!res.ok || !json?.success) throw new Error(json?.error ?? 'Failed to load templates');
  return json?.data?.templates ?? [];
}

export async function createQuickTemplate(payload: { title: string; body: string; isActive?: boolean }) {
  const res = await fetch('/api/whatsapp/quick-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) throw new Error(json?.error ?? 'Failed to create template');
  return json?.data?.template;
}

export async function updateQuickTemplate(
  id: string,
  payload: { title?: string; body?: string; isActive?: boolean },
) {
  const res = await fetch(`/api/whatsapp/quick-templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) throw new Error(json?.error ?? 'Failed to update template');
  return json?.data?.template;
}

export async function deleteQuickTemplate(id: string) {
  const res = await fetch(`/api/whatsapp/quick-templates/${id}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok || !json?.success) throw new Error(json?.error ?? 'Failed to delete template');
  return json?.data;
}
