'use client';

import { useState } from 'react';
import { format, startOfToday } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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

type Props = {
  status: string;
  followUpDate: string | null;
  /** Commit a partial update (status and/or followUpDate) to the lead. */
  onPatch: (data: Record<string, unknown>) => void;
  /** Tailwind classes for the status Select trigger so it matches its table/card context. */
  triggerClassName?: string;
};

export function LeadStatusCell({ status, followUpDate, onPatch, triggerClassName }: Props) {
  // When a dated status is chosen, hold it here until a date is picked (required).
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const isDated = DATED_STATUSES.has(status);
  // While the calendar is open for a brand-new dated status, reflect it in the trigger.
  const shownStatus = pendingStatus ?? status;

  function handleStatusChange(next: string) {
    if (next === status) return;
    if (DATED_STATUSES.has(next)) {
      // Don't commit yet — require a date first.
      setPendingStatus(next);
      setOpen(true);
    } else {
      // Leaving a dated status clears the stale follow-up date so no reminder fires.
      onPatch(isDated ? { status: next, followUpDate: null } : { status: next });
    }
  }

  function handlePickDate(date: Date | undefined) {
    if (!date) return;
    const ymd = format(date, 'yyyy-MM-dd');
    if (pendingStatus) {
      onPatch({ status: pendingStatus, followUpDate: ymd });
    } else {
      // Editing the date of an already-dated status via the chip.
      onPatch({ followUpDate: ymd });
    }
    setPendingStatus(null);
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Cancelled without picking a date → drop the pending status (required, so nothing saves).
    if (!next) setPendingStatus(null);
  }

  const selectedDate = followUpDate ? new Date(followUpDate) : undefined;

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

      {/* Date chip + calendar popover. Open is driven both by the chip and by choosing a dated status. */}
      {(isDated || open) && (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={selectedDate ? 'Change follow-up date' : 'Set follow-up date'}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs whitespace-nowrap',
                selectedDate
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                  : 'border-dashed text-muted-foreground',
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {selectedDate ? format(selectedDate, 'd MMM') : 'Set date'}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handlePickDate}
              defaultMonth={selectedDate}
              disabled={{ before: startOfToday() }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
