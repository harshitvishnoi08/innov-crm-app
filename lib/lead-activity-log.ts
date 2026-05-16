import prisma from '@/lib/prisma';

export const ActivityType = {
  NOTE: 'note',
  MEETING: 'meeting',
  MEETING_UPDATED: 'meeting_updated',
  MEETING_CANCELLED: 'meeting_cancelled',
  STATUS_CHANGE: 'status_change',
  TEMPERATURE_CHANGE: 'temperature_change',
  ACTIVE_STATUS_CHANGE: 'active_status_change',
  ASSIGNMENT: 'assignment',
  FIELD_UPDATE: 'field_update',
  TEAM_ADD: 'team_add',
  TEAM_REMOVE: 'team_remove',
  LEAD_CREATED: 'lead_created',
  BULK_UPDATE: 'bulk_update',
} as const;

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  FOLLOW_UP: 'Follow Up',
  NOT_ANSWERED: 'Not Answered',
  MEETING_FIXED: 'Meeting Fixed',
  CONTACT_IN_FUTURE: 'Contact in Future',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
  JUNK: 'Junk',
};

const TEMPERATURE_LABELS: Record<string, string> = {
  HOT: 'Hot',
  WARM: 'Warm',
  COLD: 'Cold',
};

const ACTIVE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  HOLD: 'Hold',
};

const FIELD_LABELS: Record<string, string> = {
  customerName: 'Customer name',
  contactNumber: 'Phone',
  alternateContact: 'Alternate phone',
  email: 'Email',
  state: 'State',
  city: 'City',
  platform: 'Platform',
  leadSource: 'Lead source',
  status: 'Status',
  temperature: 'Temperature',
  activeStatus: 'Active status',
  assignedTo: 'Assigned to',
  followUpDate: 'Follow-up date',
  propertyType: 'Property type',
  serviceRequired: 'Service required',
  briefScope: 'Brief scope',
  budgetRange: 'Budget range',
  propertySize: 'Property size',
  requirement: 'Requirement',
  initialNotes: 'Initial notes',
  preferredCallTime: 'Preferred call time',
  visitChargeQuoted: 'Visit charge quoted',
  visitTokenAmount: 'Visit token amount',
};

function labelStatus(v: string | null | undefined) {
  if (!v) return '—';
  return STATUS_LABELS[v] ?? v;
}

function labelTemperature(v: string | null | undefined) {
  if (!v) return 'None';
  return TEMPERATURE_LABELS[v] ?? v;
}

function labelActiveStatus(v: string | null | undefined) {
  if (!v) return '—';
  return ACTIVE_STATUS_LABELS[v] ?? v;
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'status') return labelStatus(String(value));
  if (field === 'temperature') return labelTemperature(String(value));
  if (field === 'activeStatus') return labelActiveStatus(String(value));
  if (field === 'followUpDate' || field === 'leadCreatedDate') {
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return String(a ?? '') === String(b ?? '');
}

export async function logLeadActivity({
  leadId,
  userId,
  type,
  content,
}: {
  leadId: string;
  userId: string | null;
  type: string;
  content: string;
}) {
  await prisma.$transaction([
    prisma.comment.create({
      data: { leadId, userId, content, type },
    }),
    prisma.leadActivity.create({
      data: {
        leadId,
        userId,
        activityType: type,
        note: content,
        activityDate: new Date(),
      },
    }),
  ]);
}

export async function logLeadFieldChanges({
  leadId,
  userId,
  before,
  after,
  fields,
}: {
  leadId: string;
  userId: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields: string[];
}) {
  const logs: { type: string; content: string }[] = [];

  for (const field of fields) {
    if (!(field in after)) continue;
    const oldVal = before[field];
    const newVal = after[field];
    if (valuesEqual(oldVal, newVal)) continue;

    const label = FIELD_LABELS[field] ?? field;
    const from = formatValue(field, oldVal);
    const to = formatValue(field, newVal);

    if (field === 'status') {
      logs.push({
        type: ActivityType.STATUS_CHANGE,
        content: `Status changed from ${from} to ${to}`,
      });
    } else if (field === 'temperature') {
      logs.push({
        type: ActivityType.TEMPERATURE_CHANGE,
        content: `Temperature changed from ${from} to ${to}`,
      });
    } else if (field === 'activeStatus') {
      logs.push({
        type: ActivityType.ACTIVE_STATUS_CHANGE,
        content: `Active status changed from ${from} to ${to}`,
      });
    } else if (field === 'assignedTo') {
      const [oldName, newName] = await resolveUserNames(
        oldVal as string | null | undefined,
        newVal as string | null | undefined,
      );
      logs.push({
        type: ActivityType.ASSIGNMENT,
        content: `Assignment changed from ${oldName} to ${newName}`,
      });
    } else {
      logs.push({
        type: ActivityType.FIELD_UPDATE,
        content: `${label} changed from "${from}" to "${to}"`,
      });
    }
  }

  for (const { type, content } of logs) {
    await logLeadActivity({ leadId, userId, type, content });
  }
}

async function resolveUserNames(
  oldId: string | null | undefined,
  newId: string | null | undefined,
): Promise<[string, string]> {
  const ids = [oldId, newId].filter((id): id is string => Boolean(id));
  if (ids.length === 0) return ['Unassigned', 'Unassigned'];

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const byId = Object.fromEntries(users.map((u: { id: string; name: string }) => [u.id, u.name]));

  return [
    oldId ? (byId[oldId] ?? 'Unknown user') : 'Unassigned',
    newId ? (byId[newId] ?? 'Unknown user') : 'Unassigned',
  ];
}

export async function logBulkLeadChanges({
  leadIds,
  userId,
  updateData,
}: {
  leadIds: string[];
  userId: string;
  updateData: Record<string, unknown>;
}) {
  const parts: string[] = [];
  if (updateData.status) parts.push(`status → ${labelStatus(String(updateData.status))}`);
  if (updateData.temperature !== undefined) {
    parts.push(`temperature → ${labelTemperature(String(updateData.temperature))}`);
  }
  if (updateData.activeStatus) {
    parts.push(`active status → ${labelActiveStatus(String(updateData.activeStatus))}`);
  }
  if (updateData.assignedTo !== undefined) {
    const [, newName] = await resolveUserNames(null, updateData.assignedTo as string | null);
    parts.push(`assigned to → ${newName}`);
  }
  if (parts.length === 0) return;

  const content = `Bulk update: ${parts.join(', ')}`;
  await Promise.all(
    leadIds.map(leadId =>
      logLeadActivity({
        leadId,
        userId,
        type: ActivityType.BULK_UPDATE,
        content,
      }),
    ),
  );
}
