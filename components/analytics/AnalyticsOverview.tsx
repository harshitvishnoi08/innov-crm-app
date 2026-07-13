'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMetaAnalyticsQuery } from '@/queries/analytics';
import { AnalyticsStats } from '@/components/analytics/AnalyticsStats';
import { RankedBarChart } from '@/components/analytics/RankedBarChart';
import { LeadsTrendChart } from '@/components/analytics/LeadsTrendChart';
import { AdsetBreakdownTable } from '@/components/analytics/AdsetBreakdownTable';
import { AdSpendTable } from '@/components/analytics/AdSpendTable';
import { AdSpendLeadsChart } from '@/components/analytics/AdSpendLeadsChart';
import { AnalyticsDateFilter } from '@/components/analytics/AnalyticsDateFilter';
import { formatMoney } from '@/lib/format-money';

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <Skeleton className="h-24 sm:h-28 rounded-xl" />
        <Skeleton className="h-24 sm:h-28 rounded-xl" />
        <Skeleton className="h-24 sm:h-28 rounded-xl" />
        <Skeleton className="h-24 sm:h-28 rounded-xl" />
        <Skeleton className="h-24 sm:h-28 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function AnalyticsOverview() {
  const [dateRange, setDateRange] = useState('last_30');
  const { data, isLoading, isError, error, refetch, isFetching } = useMetaAnalyticsQuery(dateRange);

  if (isLoading) return <AnalyticsSkeleton />;

  if (isError || !data) {
    return (
      <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-red-500">
          {error instanceof Error ? error.message : 'Something went wrong while loading analytics.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Meta Ads Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            See which campaigns, ad sets, and ads are driving your leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AnalyticsDateFilter value={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {data.totals.leadsWithAdData === 0 && data.totals.totalLeads > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
          None of the leads in this range have ad-level data yet. Ad, ad set, and campaign tracking
          only applies to leads received after this feature was enabled — older leads show up in the
          totals but not in the breakdowns below.
        </div>
      )}

      {/* Stats */}
      <AnalyticsStats data={data} />

      {/* Trend */}
      <LeadsTrendChart trend={data.trend} currency={data.spend.currency} spendConfigured={data.spend.configured} />

      {/* Spend vs. leads, per ad — one chart, two lines, toggleable like the
          Search Console reference: click a tile to show/hide its line. */}
      <AdSpendLeadsChart buckets={data.byAd} currency={data.spend.currency} spendConfigured={data.spend.configured} />

      {/* Campaign breakdown */}
      <RankedBarChart title="Leads by campaign" emptyLabel="No leads in this range yet." buckets={data.byCampaign} />

      {/* Ad spend & cost per lead */}
      <AdSpendTable buckets={data.byAd} currency={data.spend.currency} configured={data.spend.configured} />

      {/* Ad set: spend vs. leads, same order + colors in both charts so a
          short bar under a tall one is easy to spot at a glance. */}
      <div className={data.spend.configured ? 'grid gap-4 sm:grid-cols-2' : ''}>
        {data.spend.configured && (
          <RankedBarChart
            title="Spend by ad set"
            emptyLabel="No spend in this range yet."
            buckets={data.byAdset}
            metric="spend"
            formatValue={(n) => formatMoney(n, data.spend.currency, 0)}
          />
        )}
        <RankedBarChart
          title="Leads by ad set"
          emptyLabel="No leads in this range yet."
          buckets={data.byAdset}
        />
      </div>

      {/* Ad set rollup */}
      <AdsetBreakdownTable buckets={data.byAdset} currency={data.spend.currency} spendConfigured={data.spend.configured} />
    </div>
  );
}
