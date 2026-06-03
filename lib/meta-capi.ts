/**
 * Meta Conversions API for CRM — a.k.a. "Conversion Leads".
 *
 * Sends lead-quality feedback back to Meta so its ad algorithm learns which
 * leads are genuine (qualified / converted) vs junk (disqualified). Over time
 * this shifts ad delivery toward audiences that produce better leads.
 *
 * Setup + Events Manager mapping: see meta_capi_setup.md.
 *
 * SAFE BY DEFAULT: if META_DATASET_ID is not set, every call is a no-op, so this
 * can ship to production before the Ads Manager / Events Manager side is ready.
 * Failures NEVER throw — a Meta outage can't block a rep from saving a lead.
 */

// Match the Graph API version used elsewhere in the app (lib/whatsapp.ts, webhook).
const API_VERSION = 'v19.0';

/** Label attached to every event so Meta attributes it to this CRM. */
const LEAD_EVENT_SOURCE = 'Innov CRM';

/**
 * Maps a CRM LeadStatus to the Meta funnel event we report.
 *
 * IMPORTANT: these event names must EXACTLY match the custom conversions you
 * create in Meta Events Manager (Conversion Leads setup). If you rename one
 * here, rename it there too — Meta matches events by name.
 *
 * Positive signal = "this lead was good, find me more like it".
 * Negative signal = "this lead was bad, find me fewer like it".
 */
export const STATUS_EVENT_MAP: Record<string, string> = {
  MEETING_FIXED: 'Qualified', // genuine, sales-ready lead → positive
  CLOSED_WON: 'Converted', // became a paying customer → strongest positive
  JUNK: 'Disqualified', // fake / spam / wrong number → negative
  CLOSED_LOST: 'Disqualified', // real lead but didn't convert → negative
};

/** Returns the Meta event name for a CRM status, or null if we don't report it. */
export function eventNameForStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  return STATUS_EVENT_MAP[status] ?? null;
}

export interface CrmEventInput {
  /** Meta's leadgen_id captured from the lead webhook (the matching key). */
  leadgenId: string | null | undefined;
  /** The CRM LeadStatus the lead just moved to. */
  status: string;
  /** When the change happened, in epoch ms. Defaults to now. */
  at?: number;
}

// Placeholder swapped for the raw leadgen_id so it serializes as an unquoted
// JSON number without precision loss (Meta IDs can exceed Number.MAX_SAFE_INTEGER).
const LEAD_ID_TOKEN = '__LEAD_ID__';

/**
 * Sends one CRM lead event to Meta. Returns true if an event was sent,
 * false if it was skipped (status not reported / not a Meta lead / not
 * configured) or failed. Never throws.
 */
export async function sendLeadCrmEvent({ leadgenId, status, at }: CrmEventInput): Promise<boolean> {
  const eventName = eventNameForStatus(status);
  if (!eventName) return false; // status we don't report to Meta
  if (!leadgenId || !/^\d+$/.test(leadgenId)) return false; // not a (valid) Meta lead

  const datasetId = process.env.META_DATASET_ID;
  // CAPI typically needs a System User token with dataset access; fall back to
  // the page token if a dedicated one isn't configured.
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
  if (!datasetId || !accessToken) {
    console.warn(`[meta-capi] skipped "${eventName}" — META_DATASET_ID/token not configured`);
    return false;
  }

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor((at ?? Date.now()) / 1000),
        action_source: 'system_generated', // required for CRM/offline lead events
        // Dedupes repeated identical transitions within Meta's matching window.
        event_id: `${leadgenId}:${eventName}`,
        user_data: { lead_id: LEAD_ID_TOKEN },
        custom_data: { event_source: 'crm', lead_event_source: LEAD_EVENT_SOURCE },
      },
    ],
  };
  // Inject the raw numeric id (unquoted) to preserve full 64-bit precision.
  const body = JSON.stringify(payload).replace(`"${LEAD_ID_TOKEN}"`, leadgenId);

  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${datasetId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: unknown };
    if (!res.ok || json.error) {
      console.error(
        `[meta-capi] "${eventName}" for lead ${leadgenId} failed:`,
        JSON.stringify(json.error ?? json),
      );
      return false;
    }
    console.log(`[meta-capi] sent "${eventName}" for lead ${leadgenId}`);
    return true;
  } catch (err) {
    console.error(`[meta-capi] "${eventName}" for lead ${leadgenId} error:`, err);
    return false;
  }
}
