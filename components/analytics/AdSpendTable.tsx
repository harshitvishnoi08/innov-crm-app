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

export function AdSpendTable({
  buckets,
  currency,
  configured,
}: {
  buckets: AnalyticsSpendBucket[];
  currency: string | null;
  configured: boolean;
}) {
  const rows = [...buckets].sort((a, b) => b.spend - a.spend || b.count - a.count);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Ad spend &amp; cost per lead</CardTitle>
      </CardHeader>
      <CardContent>
        {!configured ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Spend data isn&apos;t connected yet. Set <code className="rounded bg-muted px-1 py-0.5">META_AD_ACCOUNT_ID</code>{' '}
            (and a token with <code className="rounded bg-muted px-1 py-0.5">ads_read</code>) to see cost per ad here.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No spend recorded in this range yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Cost / lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-muted-foreground">{row.campaignName || '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{row.count}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatMoney(row.spend, currency)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {row.costPerLead != null ? formatMoney(row.costPerLead, currency) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
