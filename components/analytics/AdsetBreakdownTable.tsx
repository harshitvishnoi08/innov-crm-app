'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AnalyticsSpendBucket } from '@/services/analytics.service';
import { formatMoney } from '@/lib/format-money';

export function AdsetBreakdownTable({
  buckets,
  currency,
  spendConfigured,
}: {
  buckets: AnalyticsSpendBucket[];
  currency: string | null;
  spendConfigured: boolean;
}) {
  const rows = [...buckets].sort((a, b) => b.spend - a.spend || b.count - a.count);
  const totalLeads = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Ad set breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No leads or spend in this range yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad set</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Share</TableHead>
                {spendConfigured && (
                  <>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Cost / lead</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-muted-foreground">{row.campaignName || '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{row.count}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {totalLeads > 0 ? `${Math.round((row.count / totalLeads) * 100)}%` : '—'}
                  </TableCell>
                  {spendConfigured && (
                    <>
                      <TableCell className="text-right font-mono tabular-nums">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                        {row.costPerLead != null ? formatMoney(row.costPerLead, currency) : '—'}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
