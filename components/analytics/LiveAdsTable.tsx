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
import type { LiveAd } from '@/services/analytics.service';
import { formatMoney } from '@/lib/format-money';

export function LiveAdsTable({
  ads,
  currency,
  configured,
}: {
  ads: LiveAd[];
  currency: string | null;
  configured: boolean;
}) {
  const rows = [...ads].sort((a, b) => b.spendToday - a.spendToday || b.leadsToday - a.leadsToday);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Currently running ads</CardTitle>
        <p className="text-xs text-muted-foreground">
          Active in Ads Manager and spending today — independent of the date range above.
        </p>
      </CardHeader>
      <CardContent>
        {!configured ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Meta ads spend isn&apos;t connected — set META_AD_ACCOUNT_ID and META_ADS_ACCESS_TOKEN to see live status.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No active ads are spending today.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Ad set</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Leads today</TableHead>
                <TableHead className="text-right">Spend today</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((ad) => (
                <TableRow key={ad.adId}>
                  <TableCell className="font-medium">
                    <span className="mr-2 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 align-middle" />
                    {ad.adName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ad.adsetName || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{ad.campaignName || '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{ad.leadsToday}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatMoney(ad.spendToday, currency)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {ad.impressionsToday.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {ad.ctrToday != null ? `${ad.ctrToday.toFixed(2)}%` : '—'}
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
