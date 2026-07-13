'use client';

import { Users, Target, Megaphone, Wallet, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { MetaAnalyticsData } from '@/services/analytics.service';
import { formatMoney } from '@/lib/format-money';

function StatCard({
  label,
  value,
  description,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
            {label}
          </p>
          <span className={`rounded-lg p-1.5 sm:p-2 ${iconBg} ${iconColor} shrink-0`}>
            {icon}
          </span>
        </div>
        <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight truncate" title={String(value)}>
          {value}
        </p>
        {description && (
          <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground truncate" title={description}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsStats({ data }: { data: MetaAnalyticsData }) {
  const topAd = data.byAd.find((a) => a.key !== 'Unknown ad');
  const topCampaign = data.byCampaign.find((c) => c.key !== 'Unknown campaign');
  const trackedPct =
    data.totals.totalLeads > 0
      ? Math.round((data.totals.leadsWithAdData / data.totals.totalLeads) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
      <StatCard
        label="Leads in range"
        value={data.totals.totalLeads}
        description={`${trackedPct}% with ad data`}
        icon={<Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        iconBg="bg-blue-500/10"
        iconColor="text-blue-400"
      />
      <StatCard
        label="Top ad"
        value={topAd ? topAd.label : '—'}
        description={topAd ? `${topAd.count} lead${topAd.count === 1 ? '' : 's'}` : 'No ad data yet'}
        icon={<Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        iconBg="bg-purple-500/10"
        iconColor="text-purple-400"
      />
      <StatCard
        label="Top campaign"
        value={topCampaign ? topCampaign.label : '—'}
        description={topCampaign ? `${topCampaign.count} lead${topCampaign.count === 1 ? '' : 's'}` : 'No campaign data yet'}
        icon={<Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        iconBg="bg-orange-500/10"
        iconColor="text-orange-400"
      />
      <StatCard
        label="Ad spend"
        value={data.spend.configured ? formatMoney(data.spend.totalSpend, data.spend.currency, 0) : '—'}
        description={data.spend.configured ? 'Meta ads insights' : 'Not connected'}
        icon={<Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        iconBg="bg-green-500/10"
        iconColor="text-green-400"
      />
      <StatCard
        label="Cost / lead"
        value={data.spend.costPerLead != null ? formatMoney(data.spend.costPerLead, data.spend.currency, 0) : '—'}
        description={data.spend.configured ? 'spend ÷ leads with ad data' : 'Not connected'}
        icon={<TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        iconBg="bg-rose-500/10"
        iconColor="text-rose-400"
      />
    </div>
  );
}
