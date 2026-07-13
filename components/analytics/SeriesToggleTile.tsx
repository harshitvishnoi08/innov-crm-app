'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SeriesToggleTile({
  active,
  onClick,
  color,
  label,
  value,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 min-w-[130px] rounded-lg border p-3 text-left transition-colors',
        active ? 'border-transparent' : 'border-border bg-transparent opacity-60 hover:opacity-100'
      )}
      style={active ? { backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, borderColor: color } : undefined}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span
          className={cn(
            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
            active && 'border-transparent'
          )}
          style={active ? { backgroundColor: color } : undefined}
        >
          {active && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
        </span>
        {label}
      </span>
      <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
    </button>
  );
}
