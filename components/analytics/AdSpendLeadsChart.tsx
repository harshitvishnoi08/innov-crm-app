'use client';

import { useState } from 'react';
import * as RechartsPrimitive from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { AnalyticsSpendBucket } from '@/services/analytics.service';
import { formatMoney } from '@/lib/format-money';
import { SeriesToggleTile } from '@/components/analytics/SeriesToggleTile';

const MAX_ROWS = 10;
const LEADS_COLOR = 'var(--chart-1)'; // blue
const SPEND_COLOR = 'var(--chart-6)'; // red — opposite pole of blue, reads as a distinct second series

function truncateLabel(label: string, max = 16) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

// Angled + right-anchored so labels read diagonally under their point instead
// of colliding with their neighbors when names are long and slots are narrow.
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

export function AdSpendLeadsChart({
  buckets,
  currency,
  spendConfigured,
}: {
  buckets: AnalyticsSpendBucket[];
  currency: string | null;
  spendConfigured: boolean;
}) {
  const [showLeads, setShowLeads] = useState(true);
  const [showSpend, setShowSpend] = useState(spendConfigured);

  const top = buckets.slice(0, MAX_ROWS);
  const chartData = top.map((b) => ({ name: b.label, leads: b.count, spend: b.spend }));
  const totalLeads = top.reduce((sum, b) => sum + b.count, 0);
  const totalSpend = top.reduce((sum, b) => sum + b.spend, 0);

  const config: ChartConfig = {
    leads: { label: 'Leads', color: LEADS_COLOR },
    spend: { label: 'Spend', color: SPEND_COLOR },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Spend vs. leads by ad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <SeriesToggleTile
            active={showLeads}
            onClick={() => setShowLeads((v) => !v)}
            color={LEADS_COLOR}
            label="Leads"
            value={String(totalLeads)}
          />
          <SeriesToggleTile
            active={spendConfigured && showSpend}
            onClick={() => spendConfigured && setShowSpend((v) => !v)}
            color={SPEND_COLOR}
            label="Spend"
            value={spendConfigured ? formatMoney(totalSpend, currency, 0) : 'Not connected'}
          />
        </div>

        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No leads in this range yet.</p>
        ) : (
          <ChartContainer config={config} className="w-full aspect-auto h-[340px]">
            <RechartsPrimitive.LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 56, left: 0 }}>
              <RechartsPrimitive.CartesianGrid vertical={false} strokeDasharray="0" stroke="var(--border)" opacity={0.5} />
              <RechartsPrimitive.XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={Tick} />
              <RechartsPrimitive.YAxis
                yAxisId="leads"
                orientation="left"
                hide={!showLeads}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                stroke={LEADS_COLOR}
              />
              <RechartsPrimitive.YAxis
                yAxisId="spend"
                orientation="right"
                hide={!showSpend || !spendConfigured}
                tickLine={false}
                axisLine={false}
                width={56}
                stroke={SPEND_COLOR}
                tickFormatter={(v) => formatMoney(Number(v), currency, 0)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelKey="name"
                    formatter={(value, name) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{name === 'spend' ? 'Spend' : 'Leads'}</span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {name === 'spend' ? formatMoney(Number(value), currency) : String(value)}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              {showLeads && (
                <RechartsPrimitive.Line
                  yAxisId="leads"
                  type="linear"
                  dataKey="leads"
                  name="leads"
                  stroke={LEADS_COLOR}
                  strokeWidth={2}
                  strokeLinejoin="miter"
                  dot={{ r: 3, fill: LEADS_COLOR, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              )}
              {showSpend && spendConfigured && (
                <RechartsPrimitive.Line
                  yAxisId="spend"
                  type="linear"
                  dataKey="spend"
                  name="spend"
                  stroke={SPEND_COLOR}
                  strokeWidth={2}
                  strokeLinejoin="miter"
                  dot={{ r: 3, fill: SPEND_COLOR, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </RechartsPrimitive.LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
