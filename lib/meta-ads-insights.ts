const GRAPH_VERSION = 'v19.0';

export type AdSpend = {
  adId: string;
  adName: string;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  spend: number;
};

export type DailySpend = {
  date: string; // YYYY-MM-DD, account reporting timezone
  spend: number;
};

export type AdsInsightsResult = {
  configured: boolean;
  currency: string | null;
  byAd: AdSpend[];
  daily: DailySpend[];
};

// Ad accounts rarely exceed a handful of pages at these grain levels; cap
// iterations so a runaway `paging.next` chain can't hang the request.
async function fetchAllPages(url: string): Promise<{ rows: Record<string, string>[]; error?: unknown }> {
  const rows: Record<string, string>[] = [];
  for (let page = 0; page < 20 && url; page++) {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.error) return { rows, error: data.error };
    rows.push(...(data.data ?? []));
    url = data.paging?.next ?? '';
  }
  return { rows };
}

/**
 * Fetches per-ad spend and a daily account-level spend series from Meta's
 * Marketing API (Ads Insights) for a date range. Separate token/permission
 * from the Lead Ads webhook — that one only needs leads_retrieval, this needs
 * ads_read on the ad account.
 * Never throws: returns `configured: false` if env vars are missing, and
 * logs (without throwing) on API errors so a spend outage never breaks the
 * rest of the analytics page.
 */
export async function fetchMetaAdSpend(range: { since: string; until: string } | null): Promise<AdsInsightsResult> {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ADS_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;

  if (!adAccountId || !accessToken) {
    return { configured: false, currency: null, byAd: [], daily: [] };
  }

  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const timeParam = range
    ? `&time_range=${encodeURIComponent(JSON.stringify(range))}`
    : `&date_preset=maximum`;

  try {
    const [currencyRes, adPages, dailyPages] = await Promise.all([
      fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${accountId}?fields=currency&access_token=${accessToken}`, {
        cache: "no-store",
      }),
      fetchAllPages(
        `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights` +
          `?level=ad&fields=ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,spend` +
          `${timeParam}&limit=500&access_token=${accessToken}`
      ),
      // Account-level, one row per day — cheap and enough to plot a daily
      // spend line; a per-ad daily breakdown isn't needed for that chart.
      fetchAllPages(
        `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights` +
          `?level=account&fields=spend&time_increment=1` +
          `${timeParam}&limit=500&access_token=${accessToken}`
      ),
    ]);
    const currencyData = await currencyRes.json();
    const currency = currencyData?.currency ?? null;

    if (adPages.error) {
      console.error('[meta-ads-insights] API error (ad-level):', JSON.stringify(adPages.error));
      return { configured: true, currency, byAd: [], daily: [] };
    }
    if (dailyPages.error) {
      console.error('[meta-ads-insights] API error (daily):', JSON.stringify(dailyPages.error));
    }

    const byAd: AdSpend[] = adPages.rows.map((row) => ({
      adId: row.ad_id,
      adName: row.ad_name ?? row.ad_id,
      campaignId: row.campaign_id ?? null,
      campaignName: row.campaign_name ?? null,
      adsetId: row.adset_id ?? null,
      adsetName: row.adset_name ?? null,
      spend: parseFloat(row.spend ?? '0') || 0,
    }));

    const daily: DailySpend[] = dailyPages.error
      ? []
      : dailyPages.rows.map((row) => ({ date: row.date_start, spend: parseFloat(row.spend ?? '0') || 0 }));

    return { configured: true, currency, byAd, daily };
  } catch (error) {
    console.error('[meta-ads-insights] fetch failed:', error);
    return { configured: true, currency: null, byAd: [], daily: [] };
  }
}
