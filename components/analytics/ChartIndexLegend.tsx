'use client';

// Maps the numbered x-axis ticks a chart uses (to avoid overlapping long/
// similar-looking names) back to their full names, since the axis alone
// can't show enough text to distinguish e.g. several "Hill Resort ..." rows.
export function ChartIndexLegend({
  items,
}: {
  items: { index: number; label: string; color?: string }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.index} className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-medium tabular-nums text-foreground">
            {item.index}
          </span>
          {item.color && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          )}
          <span className="text-foreground">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
