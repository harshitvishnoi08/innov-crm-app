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

export type LiveAd = {
  adId: string;
  adName: string;
  effectiveStatus: string; // e.g. ACTIVE, PAUSED, PENDING_REVIEW, DISAPPROVED
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  spendToday: number;
  impressionsToday: number;
  clicksToday: number;
  ctrToday: number | null;
};

export type LiveAdsResult = {
  configured: boolean;
  currency: string | null;
  ads: LiveAd[];
};

// Ad accounts rarely exceed a handful of pages at these grain levels; cap
// iterations so a runaway `paging.next` chain can't hang the request.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllPages(url: string): Promise<{ rows: Record<string, any>[]; error?: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Record<string, any>[] = [];
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

/**
 * Fetches ads that are currently ACTIVE in Ads Manager, with today's spend,
 * impressions, clicks and CTR — separate from `fetchMetaAdSpend`, whose
 * results are scoped to whatever historical date range the dashboard has
 * selected. "Active" here is the ad's live `effective_status`, not "had
 * leads" — a currently-active ad may show 0 leads today if it hasn't
 * generated any yet.
 */
export async function fetchLiveAdStatus(): Promise<LiveAdsResult> {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ADS_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;

  if (!adAccountId || !accessToken) {
    return { configured: false, currency: null, ads: [] };
  }

  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  try {
    const [currencyRes, activeAdsPages, todayInsightsPages] = await Promise.all([
      fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${accountId}?fields=currency&access_token=${accessToken}`, {
        cache: 'no-store',
      }),
      fetchAllPages(
        `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/ads` +
          `?fields=id,name,effective_status,adset{id,name},campaign{id,name}` +
          `&filtering=${encodeURIComponent(JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]))}` +
          `&limit=500&access_token=${accessToken}`
      ),
      fetchAllPages(
        `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights` +
          `?level=ad&fields=ad_id,spend,impressions,clicks,ctr` +
          `&date_preset=today&limit=500&access_token=${accessToken}`
      ),
    ]);
    const currencyData = await currencyRes.json();
    const currency = currencyData?.currency ?? null;

    if (activeAdsPages.error) {
      console.error('[meta-ads-insights] API error (active ads):', JSON.stringify(activeAdsPages.error));
      return { configured: true, currency, ads: [] };
    }
    if (todayInsightsPages.error) {
      console.error('[meta-ads-insights] API error (today insights):', JSON.stringify(todayInsightsPages.error));
    }

    const todayById = new Map(
      (todayInsightsPages.error ? [] : todayInsightsPages.rows).map((row) => [row.ad_id as string, row])
    );

    const ads: LiveAd[] = activeAdsPages.rows.map((row) => {
      const today = todayById.get(row.id as string);
      return {
        adId: row.id,
        adName: row.name ?? row.id,
        effectiveStatus: row.effective_status ?? 'ACTIVE',
        campaignId: row.campaign?.id ?? null,
        campaignName: row.campaign?.name ?? null,
        adsetId: row.adset?.id ?? null,
        adsetName: row.adset?.name ?? null,
        spendToday: parseFloat(today?.spend ?? '0') || 0,
        impressionsToday: parseInt(today?.impressions ?? '0', 10) || 0,
        clicksToday: parseInt(today?.clicks ?? '0', 10) || 0,
        ctrToday: today?.ctr != null ? parseFloat(today.ctr) : null,
      };
    });

    return { configured: true, currency, ads };
  } catch (error) {
    console.error('[meta-ads-insights] fetch failed (live ads):', error);
    return { configured: true, currency: null, ads: [] };
  }
}
