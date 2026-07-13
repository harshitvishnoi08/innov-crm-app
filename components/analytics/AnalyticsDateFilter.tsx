'use client';

import { useEffect, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Value is a single string so it's easy to pass straight through to the
 * analytics API's `dateRange` query param:
 *   'today' | 'week' | 'month' | 'last_month' | 'last_30' | 'last_90' | 'all'
 *   'YYYY-MM-DD:YYYY-MM-DD'  → custom inclusive range (single day = from===to)
 */

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
] as const;

const RANGE_RE = /^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;

function valueToRange(value: string): DateRange | undefined {
  const m = RANGE_RE.exec(value);
  if (!m) return undefined;
  const from = parseISO(m[1]);
  const to = parseISO(m[2]);
  if (!isValid(from) || !isValid(to)) return undefined;
  return { from, to };
}

export function analyticsDateLabel(value: string): string {
  const preset = PRESETS.find((p) => p.value === value);
  if (preset) return preset.label;
  const range = valueToRange(value);
  if (range?.from && range?.to) {
    return range.from.getTime() === range.to.getTime()
      ? format(range.from, 'dd MMM yyyy')
      : `${format(range.from, 'dd MMM')} – ${format(range.to, 'dd MMM yyyy')}`;
  }
  return 'Last 30 days';
}

export function AnalyticsDateFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isCustom = !!valueToRange(value);

  // Held as a draft so an in-progress range (only the start clicked) isn't
  // committed yet — react-day-picker needs `selected` to stay incomplete
  // until the second click, otherwise it restarts the range.
  const [draft, setDraft] = useState<DateRange | undefined>(() => valueToRange(value));
  useEffect(() => {
    setDraft(valueToRange(value));
  }, [value]);

  const handlePreset = (preset: string) => {
    onChange(preset);
    setOpen(false);
  };

  const handleRange = (next: DateRange | undefined) => {
    setDraft(next);
    if (next?.from && next?.to) {
      onChange(`${format(next.from, 'yyyy-MM-dd')}:${format(next.to, 'yyyy-MM-dd')}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex h-9 w-[170px] shrink-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:size-4 [&_svg]:shrink-0',
          isCustom && 'border-primary/50 text-primary'
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className={cn('text-muted-foreground', isCustom && 'text-primary')} />
          <span className="truncate">{analyticsDateLabel(value)}</span>
        </span>
        <ChevronDown className="size-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[20rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex flex-wrap gap-1.5 border-b p-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => handlePreset(p.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent',
                value === p.value && 'bg-primary text-primary-foreground hover:bg-primary'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={draft}
          onSelect={handleRange}
          defaultMonth={draft?.from}
          disabled={{ after: new Date() }}
          autoFocus
          className="w-full"
          classNames={{ root: 'w-full' }}
        />
      </PopoverContent>
    </Popover>
  );
}
