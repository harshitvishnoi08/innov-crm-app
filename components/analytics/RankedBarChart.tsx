'use client';

import * as RechartsPrimitive from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { AnalyticsBucket } from '@/services/analytics.service';

const MAX_ROWS = 8;
// Fixed hue order — a bar's color follows its rank/entity, never regenerated
// or cycled past this list (see dataviz palette: blue, aqua, yellow, green,
// violet, red, magenta, orange).
const SLOT_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];
const OTHER_COLOR = 'var(--muted-foreground)';

function truncateLabel(label: string, max = 16) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

// Angled + right-anchored so labels read diagonally under their bar instead
// of colliding with their neighbors when names are long and bars are narrow.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Tick(props: any) {
  const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text
        dy={8}
        textAnchor="end"
        transform="rotate(-35)"
        className="fill-muted-foreground text-[11px]"
      >
        {truncateLabel(payload.value)}
      </text>
    </g>
  );
}

function makeValueLabel(formatValue: (n: number) => string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function ValueLabel(props: any) {
    const { x = 0, y = 0, width = 0, value } = props as {
      x?: number;
      y?: number;
      width?: number;
      value?: number;
    };
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        className="fill-foreground text-[11px] font-medium tabular-nums"
      >
        {value != null ? formatValue(value) : ''}
      </text>
    );
  };
}

export function RankedBarChart({
  title,
  emptyLabel,
  buckets,
  metric = 'count',
  formatValue = (n: number) => String(n),
  seriesLabel,
}: {
  title: string;
  emptyLabel: string;
  buckets: (AnalyticsBucket & { spend?: number })[];
  /** Which field on each bucket the bars represent. */
  metric?: 'count' | 'spend';
  /** Formats the raw number for the direct label + tooltip (e.g. currency). */
  formatValue?: (n: number) => string;
  seriesLabel?: string;
}) {
  const valueOf = (b: (typeof buckets)[number]) => (metric === 'spend' ? b.spend ?? 0 : b.count);

  const top = buckets.slice(0, MAX_ROWS);
  const restValue = buckets.slice(MAX_ROWS).reduce((sum, b) => sum + valueOf(b), 0);
  const rows =
    restValue > 0
      ? [...top, { key: '__other__', label: 'Other', count: 0, spend: 0, [metric]: restValue } as (typeof buckets)[number]]
      : top;

  const chartData = rows.map((b, i) => ({
    name: b.label,
    value: valueOf(b),
    fill: b.key === '__other__' ? OTHER_COLOR : SLOT_COLORS[i % SLOT_COLORS.length],
  }));

  const config: ChartConfig = {
    value: { label: seriesLabel ?? (metric === 'spend' ? 'Spend' : 'Leads') },
  };
  const ValueLabel = makeValueLabel(formatValue);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ChartContainer config={config} className="w-full aspect-auto h-[340px]">
            <RechartsPrimitive.BarChart data={chartData} margin={{ top: 20, right: 8, bottom: 56, left: 8 }} barCategoryGap="20%">
              <RechartsPrimitive.CartesianGrid vertical={false} strokeDasharray="0" stroke="var(--border)" opacity={0.5} />
              <RechartsPrimitive.XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={Tick}
              />
              <RechartsPrimitive.YAxis hide allowDecimals={false} />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{item.payload.name}</span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {formatValue(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <RechartsPrimitive.Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24}>
                <RechartsPrimitive.LabelList dataKey="value" content={ValueLabel} />
                {chartData.map((entry) => (
                  <RechartsPrimitive.Cell key={entry.name} fill={entry.fill} />
                ))}
              </RechartsPrimitive.Bar>
            </RechartsPrimitive.BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
