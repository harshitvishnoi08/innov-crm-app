import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthWithRole } from "@/lib/api-auth";
import { fetchMetaAdSpend } from "@/lib/meta-ads-insights";

// Always compute fresh — leads and spend change constantly, and this route
// must never be served from Next's Data/Route Cache (dev or Vercel prod).
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ISTOffsetMs = 5.5 * 60 * 60 * 1000;
const UNKNOWN_AD = "Unknown ad";
const UNKNOWN_CAMPAIGN = "Unknown campaign";
const UNKNOWN_ADSET = "Unknown ad set";

// GET aggregated Meta ad-performance analytics: leads per ad, trend over time,
// and campaign/adset rollups. Only leads created after the ad-tracking fields
// were added to the webhook carry adId/campaignId/adsetId — older leads are
// folded into "Unknown ad" / "Unknown campaign" buckets rather than dropped.
export async function GET(req: NextRequest) {
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange") || "last_30";

    const nowIST = new Date(Date.now() + ISTOffsetMs);
    const todayStartUTC = new Date(
      Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - ISTOffsetMs
    );
    const monthStartUTC = new Date(
      Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), 1) - ISTOffsetMs
    );
    const lastMonthStartUTC = new Date(
      Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth() - 1, 1) - ISTOffsetMs
    );

    let fromUTC: Date | undefined;
    let toUTC: Date | undefined;
    const rangeMatch = /^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(dateRange);
    if (rangeMatch) {
      const [fy, fm, fd] = rangeMatch[1].split("-").map(Number);
      const [ty, tm, td] = rangeMatch[2].split("-").map(Number);
      fromUTC = new Date(Date.UTC(fy, fm - 1, fd) - ISTOffsetMs);
      toUTC = new Date(Date.UTC(ty, tm - 1, td) - ISTOffsetMs + 86400000);
    } else if (dateRange === "today") {
      fromUTC = todayStartUTC;
    } else if (dateRange === "week") {
      fromUTC = new Date(todayStartUTC.getTime() - 6 * 86400000);
    } else if (dateRange === "month") {
      fromUTC = monthStartUTC;
    } else if (dateRange === "last_month") {
      fromUTC = lastMonthStartUTC;
      toUTC = monthStartUTC;
    } else if (dateRange === "last_90") {
      fromUTC = new Date(todayStartUTC.getTime() - 89 * 86400000);
    } else if (dateRange === "all") {
      fromUTC = undefined;
    } else {
      // "last_30" and any unrecognized value fall back to a rolling 30-day window.
      fromUTC = new Date(todayStartUTC.getTime() - 29 * 86400000);
    }

    // Meta's Insights API takes calendar-date strings in the ad account's
    // reporting timezone; this app runs its date math in IST, so re-apply the
    // offset to recover the IST calendar date each UTC boundary represents.
    const toISTDateStr = (d: Date) => new Date(d.getTime() + ISTOffsetMs).toISOString().slice(0, 10);
    const spendRange = fromUTC
      ? {
          since: toISTDateStr(fromUTC),
          until: toISTDateStr(new Date((toUTC ?? new Date(todayStartUTC.getTime() + 86400000)).getTime() - 86400000)),
        }
      : null;

    const [leads, adSpend] = await Promise.all([
      prisma.lead.findMany({
        where: {
          ...(fromUTC && { leadCreatedDate: { gte: fromUTC, ...(toUTC && { lt: toUTC }) } }),
        },
        select: {
          leadCreatedDate: true,
          status: true,
          adId: true,
          adName: true,
          adsetId: true,
          adsetName: true,
          campaignId: true,
          campaignName: true,
        },
      }),
      fetchMetaAdSpend(spendRange),
    ]);

    type Bucket = { key: string; label: string; campaignName?: string; count: number };
    const adMap = new Map<string, Bucket>();
    const campaignMap = new Map<string, Bucket>();
    const adsetMap = new Map<string, Bucket>();
    const trendMap = new Map<string, number>();

    for (const lead of leads) {
      const adKey = lead.adId ?? UNKNOWN_AD;
      const adLabel = lead.adName ?? UNKNOWN_AD;
      const ad = adMap.get(adKey) ?? { key: adKey, label: adLabel, campaignName: lead.campaignName ?? undefined, count: 0 };
      ad.count += 1;
      adMap.set(adKey, ad);

      const campaignKey = lead.campaignId ?? UNKNOWN_CAMPAIGN;
      const campaignLabel = lead.campaignName ?? UNKNOWN_CAMPAIGN;
      const campaign = campaignMap.get(campaignKey) ?? { key: campaignKey, label: campaignLabel, count: 0 };
      campaign.count += 1;
      campaignMap.set(campaignKey, campaign);

      const adsetKey = lead.adsetId ?? UNKNOWN_ADSET;
      const adsetLabel = lead.adsetName ?? UNKNOWN_ADSET;
      const adset = adsetMap.get(adsetKey) ?? { key: adsetKey, label: adsetLabel, campaignName: lead.campaignName ?? undefined, count: 0 };
      adset.count += 1;
      adsetMap.set(adsetKey, adset);

      const dayIST = new Date(lead.leadCreatedDate.getTime() + ISTOffsetMs);
      const dateKey = dayIST.toISOString().slice(0, 10);
      trendMap.set(dateKey, (trendMap.get(dateKey) ?? 0) + 1);
    }

    // Roll ad-level spend up to campaigns and ad sets; entities with spend but
    // no leads in range still show up (0 leads, real spend) — that's the point.
    const spendByAd = new Map<string, number>();
    const spendByCampaign = new Map<string, number>();
    const spendByAdset = new Map<string, number>();
    for (const row of adSpend.byAd) {
      spendByAd.set(row.adId, (spendByAd.get(row.adId) ?? 0) + row.spend);
      const campaignKey = row.campaignId ?? UNKNOWN_CAMPAIGN;
      spendByCampaign.set(campaignKey, (spendByCampaign.get(campaignKey) ?? 0) + row.spend);
      const adsetKey = row.adsetId ?? UNKNOWN_ADSET;
      spendByAdset.set(adsetKey, (spendByAdset.get(adsetKey) ?? 0) + row.spend);
      // The Insights API always reflects the current name in Ads Manager; the
      // name on a lead record is a permanent snapshot from when the lead came
      // in, so it goes stale the moment someone renames the ad/adset/campaign.
      // Prefer the live name here — overwrite, don't just fill in gaps.
      const existingAd = adMap.get(row.adId);
      adMap.set(row.adId, {
        key: row.adId,
        label: row.adName,
        campaignName: row.campaignName ?? existingAd?.campaignName,
        count: existingAd?.count ?? 0,
      });
      const existingCampaign = campaignMap.get(campaignKey);
      campaignMap.set(campaignKey, {
        key: campaignKey,
        label: row.campaignName ?? UNKNOWN_CAMPAIGN,
        count: existingCampaign?.count ?? 0,
      });
      const existingAdset = adsetMap.get(adsetKey);
      adsetMap.set(adsetKey, {
        key: adsetKey,
        label: row.adsetName ?? UNKNOWN_ADSET,
        campaignName: row.campaignName ?? existingAdset?.campaignName,
        count: existingAdset?.count ?? 0,
      });
    }

    const withSpend = <T extends { key: string; count: number }>(bucket: T, spendMap: Map<string, number>) => {
      const spend = spendMap.get(bucket.key) ?? 0;
      return { ...bucket, spend, costPerLead: spend > 0 && bucket.count > 0 ? spend / bucket.count : null };
    };

    const byAd = [...adMap.values()].map((b) => withSpend(b, spendByAd)).sort((a, b) => b.count - a.count || b.spend - a.spend);
    const byCampaign = [...campaignMap.values()].map((b) => withSpend(b, spendByCampaign)).sort((a, b) => b.count - a.count || b.spend - a.spend);
    const byAdset = [...adsetMap.values()].map((b) => withSpend(b, spendByAdset)).sort((a, b) => b.spend - a.spend || b.count - a.count);

    const spendByDate = new Map(adSpend.daily.map((d) => [d.date, d.spend]));
    const trendDates = new Set([...trendMap.keys(), ...spendByDate.keys()]);
    const trend = [...trendDates]
      .sort()
      .map((date) => ({ date, count: trendMap.get(date) ?? 0, spend: spendByDate.get(date) ?? 0 }));

    const totalLeads = leads.length;
    const leadsWithAdData = leads.filter((l: (typeof leads)[number]) => l.adId).length;
    const totalSpend = adSpend.byAd.reduce((sum, row) => sum + row.spend, 0);

    return NextResponse.json({
      success: true,
      data: {
        totals: { totalLeads, leadsWithAdData },
        spend: {
          configured: adSpend.configured,
          currency: adSpend.currency,
          totalSpend,
          costPerLead: totalSpend > 0 && leadsWithAdData > 0 ? totalSpend / leadsWithAdData : null,
        },
        byAd,
        byCampaign,
        byAdset,
        trend,
      },
    });
  } catch (error) {
    console.error("GET analytics/meta error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
