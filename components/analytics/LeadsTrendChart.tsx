'use client';

import { useState } from 'react';
import * as RechartsPrimitive from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { AnalyticsTrendPoint } from '@/services/analytics.service';
import { formatMoney } from '@/lib/format-money';
import { SeriesToggleTile } from '@/components/analytics/SeriesToggleTile';

const LEADS_COLOR = 'var(--chart-1)'; // blue
const SPEND_COLOR = 'var(--chart-6)'; // red — opposite pole of blue, reads as a distinct second series

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function LeadsTrendChart({
  trend,
  currency,
  spendConfigured,
}: {
  trend: AnalyticsTrendPoint[];
  currency: string | null;
  spendConfigured: boolean;
}) {
  const [showLeads, setShowLeads] = useState(true);
  const [showSpend, setShowSpend] = useState(spendConfigured);

  const chartData = trend.map((p) => ({ ...p, label: formatDate(p.date) }));
  const totalLeads = trend.reduce((sum, p) => sum + p.count, 0);
  const totalSpend = trend.reduce((sum, p) => sum + p.spend, 0);

  const config: ChartConfig = {
    count: { label: 'Leads', color: LEADS_COLOR },
    spend: { label: 'Spend', color: SPEND_COLOR },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Leads &amp; spend over time</CardTitle>
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
          <ChartContainer config={config} className="w-full aspect-auto h-[280px]">
            <RechartsPrimitive.LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <RechartsPrimitive.CartesianGrid vertical={false} strokeDasharray="3 3" />
              <RechartsPrimitive.XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
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
                cursor={{ stroke: 'var(--border)' }}
                content={
                  <ChartTooltipContent
                    labelKey="label"
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
                  dataKey="count"
                  name="count"
                  stroke={LEADS_COLOR}
                  strokeWidth={2}
                  strokeLinejoin="miter"
                  dot={false}
                  activeDot={{ r: 4 }}
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
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}
            </RechartsPrimitive.LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
