'use client';

import { useState } from 'react';
import { format, startOfToday } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'NOT_ANSWERED', label: 'Not Answered' },
  { value: 'MEETING_FIXED', label: 'Meeting Fixed' },
  { value: 'CONTACT_IN_FUTURE', label: 'Contact in Future' },
  { value: 'CLOSED_WON', label: 'Closed Won' },
  { value: 'CLOSED_LOST', label: 'Closed Lost' },
  { value: 'JUNK', label: 'Junk' },
];

// Statuses that require a follow-up date before they can be saved.
const DATED_STATUSES = new Set(['FOLLOW_UP', 'CONTACT_IN_FUTURE']);
const IST = 'Asia/Kolkata';

// Build an unambiguous ISO string pinned to IST so the server stores the exact instant.
function buildFollowUpISO(ymd: string, time: string) {
  return time ? `${ymd}T${time}:00+05:30` : `${ymd}T00:00:00+05:30`;
}

// Extract the IST "HH:mm" from a stored timestamp (for re-editing an existing time).
function istTime(date: Date) {
  return date.toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false });
}

// Chip label: "25 Jun" for date-only, "25 Jun · 4:30 PM" when a time is set.
function chipLabel(date: Date, hasTime: boolean) {
  const d = date.toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short' });
  if (!hasTime) return d;
  const t = date.toLocaleTimeString('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true });
  return `${d} · ${t}`;
}

type Props = {
  status: string;
  followUpDate: string | null;
  followUpHasTime: boolean;
  /** Commit a partial update (status and/or followUpDate) to the lead. */
  onPatch: (data: Record<string, unknown>) => void;
  /** Tailwind classes for the status Select trigger so it matches its table/card context. */
  triggerClassName?: string;
};

export function LeadStatusCell({ status, followUpDate, followUpHasTime, onPatch, triggerClassName }: Props) {
  // When a dated status is chosen, hold it here until the date is saved (required).
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | undefined>(undefined);
  const [draftTime, setDraftTime] = useState('');

  const isDated = DATED_STATUSES.has(status);
  const existingDate = followUpDate ? new Date(followUpDate) : undefined;
  // While the calendar is open for a brand-new dated status, reflect it in the trigger.
  const shownStatus = pendingStatus ?? status;

  function seedDraft() {
    setDraftDate(existingDate);
    setDraftTime(existingDate && followUpHasTime ? istTime(existingDate) : '');
  }

  function handleStatusChange(next: string) {
    if (next === status) return;
    if (DATED_STATUSES.has(next)) {
      // Don't commit yet — require a date first.
      setPendingStatus(next);
      seedDraft();
      setOpen(true);
    } else {
      // Leaving a dated status clears the stale follow-up date so no reminder fires.
      onPatch(isDated ? { status: next, followUpDate: null, followUpHasTime: false } : { status: next });
    }
  }

  function handleSave() {
    if (!draftDate) return;
    const iso = buildFollowUpISO(format(draftDate, 'yyyy-MM-dd'), draftTime);
    onPatch({
      followUpDate: iso,
      followUpHasTime: !!draftTime,
      ...(pendingStatus ? { status: pendingStatus } : {}),
    });
    setPendingStatus(null);
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) seedDraft();
    else setPendingStatus(null); // cancelled without saving → nothing commits (date is required)
    setOpen(next);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={shownStatus || ''} onValueChange={handleStatusChange}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date/time chip + picker. Rendered when in a dated status or mid-selection of one. */}
      {(isDated || open) && (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={existingDate ? 'Change follow-up date/time' : 'Set follow-up date/time'}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs whitespace-nowrap',
                existingDate
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                  : 'border-dashed text-muted-foreground',
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {existingDate ? chipLabel(existingDate, followUpHasTime) : 'Set date'}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={draftDate}
              onSelect={setDraftDate}
              defaultMonth={draftDate}
              disabled={{ before: startOfToday() }}
              autoFocus
            />
            <div className="space-y-2 border-t p-3">
              <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Time (optional)</span>
                <input
                  type="time"
                  value={draftTime}
                  onChange={e => setDraftTime(e.target.value)}
                  className="rounded-md border bg-transparent px-2 py-1 text-xs"
                />
              </label>
              <div className="flex items-center justify-between gap-2">
                {draftTime ? (
                  <button
                    type="button"
                    onClick={() => setDraftTime('')}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Clear time
                  </button>
                ) : <span />}
                <Button size="sm" className="h-7 text-xs" disabled={!draftDate} onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
