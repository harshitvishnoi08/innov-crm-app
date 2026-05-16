const ACTIVITY_LABELS: Record<string, { label: string; className: string }> = {
  note: { label: 'Note', className: 'bg-muted text-muted-foreground' },
  meeting: { label: 'Meeting', className: 'bg-blue-500/15 text-blue-500' },
  meeting_updated: { label: 'Meeting updated', className: 'bg-blue-500/15 text-blue-500' },
  meeting_cancelled: { label: 'Meeting cancelled', className: 'bg-orange-500/15 text-orange-500' },
  status_change: { label: 'Status', className: 'bg-purple-500/15 text-purple-500' },
  temperature_change: { label: 'Temperature', className: 'bg-red-500/15 text-red-400' },
  active_status_change: { label: 'Active status', className: 'bg-yellow-500/15 text-yellow-600' },
  assignment: { label: 'Assignment', className: 'bg-cyan-500/15 text-cyan-600' },
  field_update: { label: 'Updated', className: 'bg-slate-500/15 text-slate-400' },
  team_add: { label: 'Team', className: 'bg-indigo-500/15 text-indigo-400' },
  team_remove: { label: 'Team', className: 'bg-indigo-500/15 text-indigo-400' },
  lead_created: { label: 'Created', className: 'bg-green-500/15 text-green-500' },
  bulk_update: { label: 'Bulk update', className: 'bg-amber-500/15 text-amber-500' },
};

export function getActivityLabel(type: string | undefined) {
  if (!type || type === 'note') return null;
  return ACTIVITY_LABELS[type] ?? { label: type.replace(/_/g, ' '), className: 'bg-muted text-muted-foreground' };
}

export function isSystemActivity(type: string | undefined) {
  return Boolean(type && type !== 'note');
}
