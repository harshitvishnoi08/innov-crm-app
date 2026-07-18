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
