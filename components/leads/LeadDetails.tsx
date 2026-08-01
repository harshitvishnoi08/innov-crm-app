'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLeadQuery, useUpdateLead, useAddComment, useUploadCommentImage, useScheduleMeeting, useUpdateMeeting, useDeleteMeeting } from '@/queries/leads';
import { useUsersQuery } from '@/queries/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Calendar, X, UserPlus, Trash2, Phone, Pencil, MessageCircle, ImagePlus, Loader2 } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { WhatsAppLinkMenu } from '@/components/leads/WhatsAppLinkMenu';
import { LeadStatusCell } from '@/components/leads/LeadStatusCell';
import { toast } from 'sonner';
import { WhatsAppChat } from '@/components/leads/WhatsAppChat';
import { getActivityLabel, isSystemActivity } from '@/components/leads/activity-labels';
import { FetchLeadError } from '@/services/leads.service';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type AppUser = { id: string; name: string; email: string };

export function LeadDetail({ id }: { id: string }) {
  const router = useRouter();
  // Go back to the exact previous list view (preserving its filters/page/scroll
  // stored in the URL). Falls back to the bare leads page when the lead was
  // opened via a direct link / refresh with no in-app history to return to.
  const goBackToLeads = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/admin/leads');
    }
  };
  const { data: lead, isLoading, error, refetch } = useLeadQuery(id);
  const updateLead = useUpdateLead(id);
  const addComment = useAddComment(id);
  const uploadImage = useUploadCommentImage(id);
  const scheduleMeeting = useScheduleMeeting(id);
  const updateMeetingMut = useUpdateMeeting(id);
  const deleteMeetingMut = useDeleteMeeting(id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rightTab, setRightTab] = useState<'activity' | 'whatsapp'>('activity');
  const [comment, setComment] = useState('');
  const [confirmCall, setConfirmCall] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [meetingForm, setMeetingForm] = useState({ agenda: '', meetingDate: '', meetingTime: '' });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Users are shared across the app and rarely change, so fetch them through the
  // cached react-query hook instead of a raw fetch on every lead open. Opening
  // many leads in a row now reuses one cached result rather than re-hitting
  // /api/users (and its auth round-trip) each time.
  const { data: usersData } = useUsersQuery({ staleTime: 1000 * 60 * 5 });

  useEffect(() => {
    const users: AppUser[] = (usersData as AppUser[]) ?? [];
    let savedIds: string[] = [];
    try {
      savedIds = JSON.parse(localStorage.getItem('team_enabled_users') ?? '[]');
    } catch {
      savedIds = [];
    }
    setAllUsers(
      savedIds.length > 0 ? users.filter((u) => savedIds.includes(u.id)) : users
    );
  }, [usersData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!lead) {
    const status = error instanceof FetchLeadError ? error.status : null;
    const isAuthIssue = status === 401;
    const isForbidden = status === 403;
    const message = isAuthIssue
      ? 'Your session expired — refresh the page and try again.'
      : isForbidden
      ? "You don't have permission to view this lead."
      : status && status !== 404
      ? 'Something went wrong loading this lead — please try again.'
      : 'Lead not found.';

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">{message}</p>
        <div className="flex gap-2">
          {isAuthIssue ? (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          ) : (
            !isForbidden && status !== 404 && (
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            )
          )}
          <Button variant="outline" onClick={goBackToLeads}>
            Back to Leads
          </Button>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    setEditForm({
      customerName: (lead.customerName as string) || '',
      contactNumber: (lead.contactNumber as string) || '',
      email: (lead.email as string) || '',
      city: (lead.city as string) || '',
      state: (lead.state as string) || '',
      propertyType: (lead.propertyType as string) || '',
      serviceRequired: (lead.serviceRequired as string) || '',
      budgetRange: (lead.budgetRange as string) || '',
      propertySize: (lead.propertySize as string) || '',
      preferredCallTime: (lead.preferredCallTime as string) || '',
      briefScope: (lead.briefScope as string) || '',
      requirement: (lead.requirement as string) || '',
      initialNotes: (lead.initialNotes as string) || '',
      leadSource: (lead.leadSource as string) || '',
      followUpDate: lead.followUpDate
        ? new Date(lead.followUpDate as string).toISOString().split('T')[0]
        : '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    await updateLead.mutateAsync(editForm);
    setEditing(false);
    void refetch();
  };

  const handleSendComment = async () => {
    if (!comment.trim()) return;
    await addComment.mutateAsync({ content: comment.trim(), type: 'note' });
    setComment('');
    void refetch();
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be 10MB or smaller');
      return;
    }
    try {
      await uploadImage.mutateAsync({ file, caption: comment.trim() });
      setComment('');
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image');
    }
  };

  const handleScheduleMeeting = async () => {
    if (!meetingForm.agenda || !meetingForm.meetingDate || !meetingForm.meetingTime) return;
    const meetingDate = new Date(`${meetingForm.meetingDate}T${meetingForm.meetingTime}`).toISOString();
    if (editingMeetingId) {
      await updateMeetingMut.mutateAsync({ id: editingMeetingId, agenda: meetingForm.agenda, meetingDate });
      toast.success('Meeting updated.');
    } else {
      await scheduleMeeting.mutateAsync({ agenda: meetingForm.agenda, meetingDate });
      toast.success('Meeting scheduled.');
    }
    setShowMeetingModal(false);
    setEditingMeetingId(null);
    setMeetingForm({ agenda: '', meetingDate: '', meetingTime: '' });
    void refetch();
  };

  const handleEditMeeting = (meeting: Record<string, unknown>) => {
    const dt = new Date(meeting.meetingDate as string);
    setEditingMeetingId(meeting.id as string);
    setMeetingForm({
      agenda: meeting.agenda as string,
      meetingDate: dt.toISOString().split('T')[0],
      meetingTime: dt.toTimeString().slice(0, 5),
    });
    setShowMeetingModal(true);
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    await deleteMeetingMut.mutateAsync({ id: meetingId });
    toast.success('Meeting deleted.');
    void refetch();
  };

  const handleDeleteLead = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Lead deleted.');
      goBackToLeads();
    } catch {
      toast.error('Failed to delete lead.');
      setDeleting(false);
    }
  };

  const handleAddTeamMember = async (userId: string) => {
    setTeamLoading(true);
    await fetch(`/api/leads/${id}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    void refetch();
    setTeamLoading(false);
  };

  const handleRemoveTeamMember = async (userId: string) => {
    setTeamLoading(true);
    await fetch(`/api/leads/${id}/team`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    void refetch();
    setTeamLoading(false);
  };

  const comments = (lead.comments as Record<string, unknown>[]) || [];
  const meetings = (lead.meetings as Record<string, unknown>[]) || [];
  const teamMembers = (lead.teamMembers as { userId: string; user: AppUser }[]) || [];
  const teamMemberIds = teamMembers.map(m => m.userId);
  const availableToAdd = allUsers.filter(u => !teamMemberIds.includes(u.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-2 sm:items-center">
        <Button variant="ghost" size="sm" onClick={goBackToLeads} className="shrink-0">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight sm:text-2xl">
          {lead.customerName as string}
        </h1>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => { setEditingMeetingId(null); setMeetingForm({ agenda: '', meetingDate: '', meetingTime: '' }); setShowMeetingModal(true); }}>
            <Calendar className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Schedule Meeting</span>
            <span className="sm:hidden">Meeting</span>
          </Button>
          {!editing ? (
            <>
              <Button size="sm" onClick={handleEdit}>Edit</Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={updateLead.isPending}>
                {updateLead.isPending ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Lead Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editing ? (
                <>
                  {[
                    { key: 'customerName', label: 'Customer Name', type: 'text' },
                    { key: 'contactNumber', label: 'Phone', type: 'text' },
                    { key: 'email', label: 'Email', type: 'text' },
                    { key: 'city', label: 'City', type: 'text' },
                    { key: 'state', label: 'State', type: 'text' },
                    { key: 'propertyType', label: 'Property Type', type: 'text' },
                    { key: 'serviceRequired', label: 'Looking For', type: 'text' },
                    { key: 'budgetRange', label: 'Budget Range', type: 'text' },
                    { key: 'propertySize', label: 'Property Size', type: 'text' },
                    { key: 'preferredCallTime', label: 'Preferred Call Time', type: 'text' },
                    { key: 'leadSource', label: 'Lead Source', type: 'text' },
                    { key: 'followUpDate', label: 'Follow Up Date', type: 'date' },
                  ].map(({ key, label, type }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type={type}
                        value={editForm[key] || ''}
                        onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="col-span-full space-y-1">
                    <Label className="text-xs text-muted-foreground">Requirement / Brief Scope</Label>
                    <Textarea
                      value={editForm.briefScope || ''}
                      onChange={e => setEditForm(p => ({ ...p, briefScope: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="col-span-full space-y-1">
                    <Label className="text-xs text-muted-foreground">Remarks / Initial Notes</Label>
                    <Textarea
                      value={editForm.initialNotes || ''}
                      onChange={e => setEditForm(p => ({ ...p, initialNotes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Phone with call/WhatsApp actions */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{(lead.contactNumber as string) || '—'}</p>
                      {(lead.contactNumber as string) && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setConfirmCall(true)}
                            className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500 transition-colors active:opacity-60 hover:bg-blue-500/20"
                          >
                            <Phone className="h-3 w-3" /> Call
                          </button>
                          <WhatsAppLinkMenu
                            phone={lead.contactNumber as string}
                            customerName={lead.customerName as string}
                            variant="pill"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {[
                    { label: 'Customer Name', value: lead.customerName as string },
                    { label: 'Email', value: lead.email as string },
                    { label: 'City', value: lead.city as string },
                    { label: 'State', value: lead.state as string },
                    { label: 'Platform', value: lead.platform as string },
                    { label: 'Lead Source', value: lead.leadSource as string },
                    { label: 'Property Type', value: lead.propertyType as string },
                    { label: 'Looking For', value: lead.serviceRequired as string },
                    { label: 'Budget Range', value: lead.budgetRange as string },
                    { label: 'Property Size', value: lead.propertySize as string },
                    { label: 'Preferred Call Time', value: lead.preferredCallTime as string },
                    { label: 'Created Date', value: formatDate(lead.leadCreatedDate as string) },
                    { label: 'Follow Up Date', value: formatDate(lead.followUpDate as string) },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium">{value || '—'}</p>
                    </div>
                  ))}
                  <div className="col-span-full space-y-1">
                    <p className="text-xs text-muted-foreground">Requirement / Brief Scope</p>
                    <p className="text-sm">{(lead.briefScope as string) || (lead.requirement as string) || '—'}</p>
                  </div>
                  <div className="col-span-full space-y-1">
                    <p className="text-xs text-muted-foreground">Remarks / Initial Notes</p>
                    <p className="text-sm">{(lead.initialNotes as string) || '—'}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Temperature</Label>
                <Select
                  value={(lead.temperature as string) || ''}
                  onValueChange={v => updateLead.mutate({ temperature: v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOT">🔥 Hot</SelectItem>
                    <SelectItem value="WARM">🌡️ Warm</SelectItem>
                    <SelectItem value="COLD">❄️ Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Lead Status</Label>
                <LeadStatusCell
                  status={(lead.status as string) || ''}
                  followUpDate={(lead.followUpDate as string) || null}
                  followUpHasTime={!!lead.followUpHasTime}
                  onPatch={data => updateLead.mutate(data)}
                  triggerClassName="h-9 min-w-0 flex-1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground" title="Reported to Meta as Qualified/Disqualified for Meta-sourced leads, independent of pipeline stage">
                  Qualification
                </Label>
                <Select
                  value={(lead.qualification as string) || 'UNREVIEWED'}
                  onValueChange={v => updateLead.mutate({ qualification: v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNREVIEWED">Unreviewed</SelectItem>
                    <SelectItem value="QUALIFIED">✅ Qualified</SelectItem>
                    <SelectItem value="NOT_QUALIFIED">❌ Not Qualified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Active Status</Label>
                <Select
                  value={(lead.activeStatus as string) || ''}
                  onValueChange={v => updateLead.mutate({ activeStatus: v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="HOLD">Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Primary Assignee</Label>
                <Select
                  value={(lead.assignedTo as string) || ''}
                  onValueChange={v => updateLead.mutate({ assignedTo: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select primary assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Collaborators</Label>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.length === 0 && (
                    <p className="text-xs text-muted-foreground">No collaborators yet.</p>
                  )}
                  {teamMembers.map(m => (
                    <Badge key={m.userId} variant="secondary" className="flex items-center gap-1 pr-1">
                      {m.user.name}
                      <button
                        onClick={() => void handleRemoveTeamMember(m.userId)}
                        disabled={teamLoading}
                        className="ml-1 rounded-full hover:bg-muted p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                {availableToAdd.length > 0 && (
                  <div className="flex gap-2 items-center">
                    <Select onValueChange={v => void handleAddTeamMember(v)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Add collaborator..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableToAdd.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            <span className="flex items-center gap-2">
                              <UserPlus className="h-3 w-3" /> {u.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {meetings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Scheduled Meetings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {meetings.map((meeting) => (
                  <div key={meeting.id as string} className="flex items-start justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{meeting.agenda as string}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        📅 {formatDateTime(meeting.meetingDate as string)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon-sm" onClick={() => handleEditMeeting(meeting)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => void handleDeleteMeeting(meeting.id as string)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col" style={{ height: 'min(600px, 80vh)' }}>
          <Card className="flex flex-col h-full">
            {/* Tab switcher */}
            <div className="flex border-b flex-shrink-0">
              <button
                onClick={() => setRightTab('activity')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex-1 justify-center ${
                  rightTab === 'activity'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Activity & Notes
              </button>
              <button
                onClick={() => setRightTab('whatsapp')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex-1 justify-center ${
                  rightTab === 'whatsapp'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                WhatsApp
              </button>
            </div>

            {/* Activity & Notes tab */}
            {rightTab === 'activity' && (
              <>
                <CardContent className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                  {comments.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-8">
                      No comments yet. Add the first one!
                    </p>
                  )}
                  {[...comments].reverse().map((c) => {
                    const user = c.user as Record<string, string> | null;
                    const commentType = c.type as string | undefined;
                    const activityLabel = getActivityLabel(commentType);
                    const systemEvent = isSystemActivity(commentType);
                    const imageUrl = c.imageUrl as string | undefined;
                    const content = c.content as string;
                    return (
                      <div
                        key={c.id as string}
                        className={`flex flex-col gap-1 items-start ${systemEvent ? 'w-full' : ''}`}
                      >
                        {activityLabel && (
                          <span
                            className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full ${activityLabel.className}`}
                          >
                            {activityLabel.label}
                          </span>
                        )}
                        <div
                          className={`rounded-2xl px-3 py-2 max-w-[95%] ${
                            systemEvent
                              ? 'rounded-lg border border-border/60 bg-muted/30 w-full max-w-full'
                              : 'rounded-tl-sm bg-muted/60 max-w-[85%]'
                          }`}
                        >
                          {imageUrl && (
                            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imageUrl}
                                alt={(c.imageName as string) || 'attachment'}
                                className="max-w-[220px] max-h-[260px] rounded-lg object-cover mb-1"
                                loading="lazy"
                              />
                            </a>
                          )}
                          {content && (
                            <p className={`text-sm leading-relaxed ${systemEvent ? 'text-muted-foreground' : ''}`}>
                              {content}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground px-1">
                          {user?.name || 'System'} · {formatDateTime(c.createdAt as string)}
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
                <div className="p-3 border-t flex gap-2 flex-shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => void handleImageSelected(e)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePickImage}
                    disabled={uploadImage.isPending}
                    title="Attach a photo"
                  >
                    {uploadImage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                  </Button>
                  <Input
                    placeholder={uploadImage.isPending ? 'Uploading photo…' : 'Add a comment or caption…'}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendComment();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleSendComment()}
                    disabled={addComment.isPending || !comment.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {/* WhatsApp tab */}
            {rightTab === 'whatsapp' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <WhatsAppChat
                  leadId={id}
                  contactNumber={lead.contactNumber as string | null}
                  customerName={lead.customerName as string}
                />
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Call confirmation ── */}
      <Dialog open={confirmCall} onOpenChange={setConfirmCall}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Call {lead.contactNumber as string}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will open your phone dialer to make a call.</p>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => setConfirmCall(false)}>Cancel</Button>
            <a href={`tel:${lead.contactNumber as string}`} onClick={() => setConfirmCall(false)}>
              <Button size="sm"><Phone className="mr-1.5 h-4 w-4" /> Call now</Button>
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{lead.customerName as string}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDeleteLead()} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMeetingModal} onOpenChange={(open) => { setShowMeetingModal(open); if (!open) setEditingMeetingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMeetingId ? 'Edit Meeting' : 'Schedule Meeting'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Agenda *</Label>
              <Input
                placeholder="What is the meeting about?"
                value={meetingForm.agenda}
                onChange={e => setMeetingForm(p => ({ ...p, agenda: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={meetingForm.meetingDate}
                  onChange={e => setMeetingForm(p => ({ ...p, meetingDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <Input
                  type="time"
                  value={meetingForm.meetingTime}
                  onChange={e => setMeetingForm(p => ({ ...p, meetingTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingModal(false)}>Cancel</Button>
            <Button
              onClick={() => void handleScheduleMeeting()}
              disabled={scheduleMeeting.isPending || !meetingForm.agenda || !meetingForm.meetingDate || !meetingForm.meetingTime}
            >
              {(scheduleMeeting.isPending || updateMeetingMut.isPending)
                ? (editingMeetingId ? 'Saving...' : 'Scheduling...')
                : (editingMeetingId ? 'Save Changes' : 'Schedule Meeting')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}