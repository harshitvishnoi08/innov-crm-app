import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendNewLeadNotification } from "@/lib/mailer";
import { ActivityType, logLeadActivity } from "@/lib/lead-activity-log";
import { normalizeIndianPhone } from "@/lib/phone";
import { runNewLeadAutomations } from "@/lib/lead-automations";

/**
 * Website form intake — weinnovarch.com's submit.php forwards every enquiry
 * here (see website_setup.md). Authenticated with a shared secret header so
 * the endpoint can't be used to inject junk leads.
 *
 * Attribution (gclid + UTMs) is captured on the site by js/attribution.js
 * into a cookie and passed through by submit.php, so Google Ads clicks land
 * here tagged with the click id needed for offline conversion upload later.
 */

const SECRET = process.env.WEBSITE_FORM_SECRET;

// A visitor double-clicking submit, or re-posting after a slow redirect,
// shouldn't create two leads. Same phone inside this window = same lead.
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

const str = (v: unknown, max = 500): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

export async function POST(req: NextRequest) {
  if (!SECRET) {
    console.error("WEBSITE_FORM_SECRET is not set — refusing website lead");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (req.headers.get("x-website-secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const customerName = str(body.name, 120);
  const contactNumber = normalizeIndianPhone(str(body.phone, 40) ?? "");
  if (!customerName || !contactNumber) {
    return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
  }

  const gclid = str(body.gclid, 200);
  const utmSource = str(body.utm_source, 120);
  const utmCampaign = str(body.utm_campaign, 200);

  // A gclid is definitive; a plain utm_source=google covers manually-tagged
  // URLs where auto-tagging is off. Anything else is an organic form fill.
  const isGoogleAds = !!gclid || /^google$/i.test(utmSource ?? "");
  const platform = isGoogleAds ? "Google Ads" : "Website";
  // Mirrors the Meta route's "ad name as source" — the campaign is what reps
  // want to filter/report by. Falls back to a fixed label so the Source
  // column never goes blank for organic fills.
  const leadSource = utmCampaign || "Website Form";

  try {
    const existing = await prisma.lead.findFirst({
      where: { contactNumber, createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) } },
      select: { id: true },
    });
    if (existing) {
      console.log("Website lead deduped against", existing.id);
      return NextResponse.json({ success: true, leadId: existing.id, deduped: true });
    }

    const newLead = await prisma.lead.create({
      data: {
        customerName,
        contactNumber,
        email: str(body.email, 200),
        city: str(body.city, 120) ?? "",
        serviceRequired: str(body.requirement, 200) ?? "",
        budgetRange: str(body.budget, 120) ?? "",
        propertySize: str(body.landArea, 120) ?? "",
        requirement: str(body.message, 5000),
        platform,
        leadSource,
        campaignName: utmCampaign,
        adName: str(body.utm_content, 200),
        gclid,
        utmSource,
        utmMedium: str(body.utm_medium, 120),
        utmCampaign,
        utmTerm: str(body.utm_term, 200),
        utmContent: str(body.utm_content, 200),
        landingPage: str(body.landingPage, 1000),
        referrer: str(body.referrer, 1000),
        status: "NEW",
        leadCreatedDate: new Date(),
        userId: null,
      },
    });

    console.log("New website lead saved:", newLead.id, platform, leadSource);

    await logLeadActivity({
      leadId: newLead.id,
      userId: null,
      type: ActivityType.LEAD_CREATED,
      content: `Lead created from Website Form (${platform})${
        str(body.page, 300) ? ` — ${str(body.page, 300)}` : ""
      }`,
    });

    void sendNewLeadNotification({
      id: newLead.id,
      customerName: newLead.customerName,
      contactNumber: newLead.contactNumber ?? "",
      city: newLead.city,
      platform: newLead.platform,
      leadSource: newLead.leadSource,
      propertyType: newLead.propertyType,
      status: newLead.status,
      assignedUser: null,
    });

    // Rules keyed on "website" fire for every site lead; a rule keyed on a
    // campaign name only fires for that campaign.
    void runNewLeadAutomations(newLead, `website ${utmCampaign ?? ""}`);

    return NextResponse.json({ success: true, leadId: newLead.id });
  } catch (error) {
    console.error("Website webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
