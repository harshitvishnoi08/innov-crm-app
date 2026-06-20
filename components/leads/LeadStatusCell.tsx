'use client';

import { useState } from 'react';
import { format, startOfToday } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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

// Statuses that require a follow-up date+time before they can be saved.
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
  // While the picker is open for a brand-new dated status, reflect it in the trigger.
  const shownStatus = pendingStatus ?? status;

  function seedDraft() {
    setDraftDate(existingDate);
    // Time is required — default new follow-ups to 10:00, or reuse the saved time.
    setDraftTime(existingDate && followUpHasTime ? istTime(existingDate) : '10:00');
  }

  // Open on the next tick so the Select fully closes first — opening synchronously
  // from the Select's change handler lets its closing event dismiss the dialog.
  function openPicker() {
    setTimeout(() => setOpen(true), 0);
  }

  function handleStatusChange(next: string) {
    if (next === status) return;
    if (DATED_STATUSES.has(next)) {
      // Don't commit yet — require a date+time first.
      setPendingStatus(next);
      seedDraft();
      openPicker();
    } else {
      // Leaving a dated status clears the stale follow-up date so no reminder fires.
      onPatch(isDated ? { status: next, followUpDate: null, followUpHasTime: false } : { status: next });
    }
  }

  function openForEdit() {
    setPendingStatus(null);
    seedDraft();
    setOpen(true);
  }

  function handleSave() {
    if (!draftDate || !draftTime) return;
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
    // Closing without saving drops the pending status (date is required → nothing commits).
    if (!next) setPendingStatus(null);
    setOpen(next);
  }

  return (
    <div className="flex w-full items-center gap-1.5">
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

      {/* Chip shows/edits the saved follow-up date+time once the status is dated. */}
      {isDated && (
        <button
          type="button"
          title={existingDate ? 'Change follow-up date/time' : 'Set follow-up date/time'}
          onClick={e => { e.stopPropagation(); openForEdit(); }}
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs whitespace-nowrap',
            existingDate
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
              : 'border-dashed text-muted-foreground',
          )}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          {existingDate && <span>{chipLabel(existingDate, followUpHasTime)}</span>}
        </button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-xs" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Set follow-up date &amp; time</DialogTitle>
            <DialogDescription>
              Pick when to be reminded. Both date and time are required.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            <Calendar
              mode="single"
              selected={draftDate}
              onSelect={setDraftDate}
              defaultMonth={draftDate}
              disabled={{ before: startOfToday() }}
              autoFocus
            />
            <label className="flex w-full items-center justify-between gap-2 text-sm">
              <span>Time<span className="text-red-500"> *</span></span>
              <input
                type="time"
                required
                value={draftTime}
                onChange={e => setDraftTime(e.target.value)}
                className="rounded-md border bg-transparent px-2 py-1 text-sm"
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button disabled={!draftDate || !draftTime} onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
