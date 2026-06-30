export async function fetchLeads(params?: {
  search?: string;
  status?: string;
  temperature?: string;
  activeStatus?: string;
  assignedTo?: string;
  platform?: string;
  leadSource?: string;
  dateCreated?: string;
  followUp?: string;
  page?: number;
  pageSize?: number;
  all?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.search)      query.set('search',      params.search);
  if (params?.status)      query.set('status',      params.status);
  if (params?.temperature) query.set('temperature', params.temperature);
  if (params?.activeStatus) query.set('activeStatus', params.activeStatus);
  if (params?.assignedTo)  query.set('assignedTo',  params.assignedTo);
  if (params?.platform)    query.set('platform',    params.platform);
  if (params?.leadSource)  query.set('leadSource',  params.leadSource);
  if (params?.dateCreated) query.set('dateCreated', params.dateCreated);
  if (params?.followUp)    query.set('followUp',    params.followUp);
  if (params?.page)        query.set('page',        String(params.page));
  if (params?.pageSize)    query.set('pageSize',    String(params.pageSize));
  if (params?.all)         query.set('all',         '1');

  const response = await fetch(`/api/leads?${query.toString()}`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to fetch leads');
  return response.json(); // returns { success, data, pagination }
}

export async function fetchLeadsMeta() {
  const response = await fetch('/api/leads/meta', { method: 'GET' });
  if (!response.ok) throw new Error('Failed to fetch leads meta');
  return response.json(); // returns { platforms, sources }
}

export async function fetchLead(id: string) {
  const response = await fetch(`/api/leads/${id}`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to fetch lead');
  const json = await response.json();
  return json?.data ?? json;
}

export async function createLead(data: Record<string, unknown>) {
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create lead');
  const json = await response.json();
  return json?.data ?? json;
}

export async function updateLead(id: string, data: Record<string, unknown>) {
  const response = await fetch(`/api/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update lead');
  const json = await response.json();
  return json?.data ?? json;
}

export async function addComment(leadId: string, content: string, type = 'note') {
  const response = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId, content, type }),
  });
  if (!response.ok) throw new Error('Failed to add comment');
  const json = await response.json();
  return json?.data ?? json;
}

export async function uploadCommentImage(leadId: string, file: File, caption = '') {
  const formData = new FormData();
  formData.append('leadId', leadId);
  formData.append('file', file);
  if (caption) formData.append('caption', caption);

  const response = await fetch('/api/comments/upload', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error || 'Failed to upload image');
  }
  const json = await response.json();
  return json?.data ?? json;
}

export async function scheduleMeeting(data: {
  leadId: string;
  agenda: string;
  meetingDate: string;
}) {
  const response = await fetch('/api/meeting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to schedule meeting');
  const json = await response.json();
  return json?.data ?? json;
}

export async function updateMeeting(data: {
  id: string;
  agenda: string;
  meetingDate: string;
}) {
  const response = await fetch('/api/meeting', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update meeting');
  const json = await response.json();
  return json?.data ?? json;
}

export async function deleteMeeting(data: { id: string }) {
  const response = await fetch('/api/meeting', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to delete meeting');
  const json = await response.json();
  return json?.data ?? json;
}
