import "dotenv/config";
import prisma from "../lib/prisma.js";

/**
 * Backfills ad/campaign/adset fields on existing leads using their stored
 * leadgenId. Meta only keeps a leadgen record queryable for a limited window
 * after the lead came in, so older leads will fail with an API error and are
 * left untouched (they keep showing as "Unknown ad" in analytics).
 *
 * Run with: npx tsx scripts/backfill-meta-ad-data.js
 */

const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAdData(leadgenId) {
  const url =
    "https://graph.facebook.com/v19.0/" +
    leadgenId +
    "?fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name&access_token=" +
    accessToken;
  const res = await fetch(url);
  return res.json();
}

async function main() {
  if (!accessToken) {
    console.error("META_PAGE_ACCESS_TOKEN is not set. Aborting.");
    process.exit(1);
  }

  const leads = await prisma.lead.findMany({
    where: { leadgenId: { not: null }, adId: null },
    select: { id: true, leadgenId: true },
  });

  console.log(`Found ${leads.length} lead(s) with a leadgenId but no ad data.`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (lead) => {
        try {
          const data = await fetchAdData(lead.leadgenId);
          if (data.error) {
            failed++;
            console.warn(`  [skip] ${lead.id}: ${data.error.message}`);
            return;
          }
          if (!data.ad_id) {
            failed++;
            console.warn(`  [skip] ${lead.id}: no ad_id in response`);
            return;
          }
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              adId: data.ad_id ?? null,
              adName: data.ad_name ?? null,
              adsetId: data.adset_id ?? null,
              adsetName: data.adset_name ?? null,
              campaignId: data.campaign_id ?? null,
              campaignName: data.campaign_name ?? null,
            },
          });
          updated++;
        } catch (err) {
          failed++;
          console.error(`  [error] ${lead.id}:`, err instanceof Error ? err.message : err);
        }
      })
    );
    if (i + BATCH_SIZE < leads.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`Done. Updated: ${updated}. Skipped/failed: ${failed}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
