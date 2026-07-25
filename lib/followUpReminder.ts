import prisma from "@/lib/prisma";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

// Meta template variables may not be empty — fall back to a placeholder.
const waSafe = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "N/A");

/**
 * Sends a WhatsApp nudge to the assigned salesperson and every collaborator on
 * the lead at the time they set on a timed follow-up. Date-only follow-ups
 * (followUpHasTime = false) are ignored here — those are covered by the daily
 * morning digest cron instead.
 *
 * Shared by /api/cron/follow-up-reminder and /api/cron/meeting-reminder so a
 * single external cron can drive both.
 */
export async function runFollowUpReminders() {
  const now = new Date();
  const in10Min = new Date(now.getTime() + 10 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: {
      followUpDate: { gte: now, lte: in10Min },
      followUpHasTime: true,
      followUpReminderSent: false,
      activeStatus: "ACTIVE",
    },
    select: {
      id: true,
      customerName: true,
      contactNumber: true,
      city: true,
      followUpDate: true,
      assignedUser: { select: { name: true, phone: true } },
      teamMembers: { select: { user: { select: { name: true, phone: true } } } },
    },
  });

  const results: { lead: string; sentTo: string }[] = [];

  for (const lead of leads) {
    if (lead.followUpDate) {
      const followUpTimeIST = lead.followUpDate.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

      // Assignee + every collaborator on the lead, deduped by phone (covers
      // the assignee also being listed as a collaborator).
      const recipients = [
        lead.assignedUser,
        ...lead.teamMembers.map((m: { user: { name: string; phone: string | null } }) => m.user),
      ];
      const seenPhones = new Set<string>();

      for (const recipient of recipients) {
        const phone = recipient?.phone;
        if (!phone || seenPhones.has(phone)) continue;
        seenPhones.add(phone);

        try {
          const waRes = await sendWhatsAppTemplate(phone, "follow_up_reminder", "en", [
            {
              type: "body",
              parameters: [
                { type: "text", text: recipient?.name || "Team" },
                { type: "text", text: waSafe(lead.customerName) },
                { type: "text", text: waSafe(lead.contactNumber) },
                { type: "text", text: waSafe(lead.city) },
                { type: "text", text: followUpTimeIST },
              ],
            },
            // URL button: {{1}} = lead id (appended to the template's base URL)
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: lead.id }] },
          ]);

          if (waRes.error) {
            console.error("Follow-up reminder WhatsApp error:", waRes.error);
          } else {
            results.push({ lead: lead.customerName, sentTo: `whatsapp:${phone}` });
          }
        } catch (waErr) {
          console.error("Follow-up reminder WhatsApp send failed:", waErr);
        }
      }
    }

    // Mark as reminded so we never send twice (re-armed when the date changes).
    await prisma.lead.update({
      where: { id: lead.id },
      data: { followUpReminderSent: true },
    });
  }

  return results;
}
