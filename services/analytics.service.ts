export type AnalyticsBucket = {
  key: string;
  label: string;
  campaignName?: string;
  count: number;
};

export type AnalyticsSpendBucket = AnalyticsBucket & {
  spend: number;
  costPerLead: number | null;
};

export type AnalyticsTrendPoint = {
  date: string;
  count: number;
  spend: number;
};

export type LiveAd = {
  adId: string;
  adName: string;
  effectiveStatus: string;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  spendToday: number;
  impressionsToday: number;
  clicksToday: number;
  ctrToday: number | null;
  leadsToday: number;
};

export type MetaAnalyticsData = {
  totals: { totalLeads: number; leadsWithAdData: number };
  spend: {
    configured: boolean;
    currency: string | null;
    totalSpend: number;
    costPerLead: number | null;
  };
  byAd: AnalyticsSpendBucket[];
  byCampaign: AnalyticsSpendBucket[];
  byAdset: AnalyticsSpendBucket[];
  trend: AnalyticsTrendPoint[];
  live: {
    configured: boolean;
    currency: string | null;
    ads: LiveAd[];
  };
};

export async function fetchMetaAnalytics(dateRange: string): Promise<MetaAnalyticsData> {
  const response = await fetch(`/api/analytics/meta?dateRange=${encodeURIComponent(dateRange)}`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch analytics data');
  }
  const json = await response.json();
  return json?.data ?? json;
}
