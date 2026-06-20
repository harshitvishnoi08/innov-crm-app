import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

// Meta template variables may not be empty — fall back to a placeholder.
const waSafe = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "N/A");

// Sends a WhatsApp nudge to the assigned salesperson at the time they set on a
// timed follow-up. Date-only follow-ups (followUpHasTime = false) are ignored
// here — those are covered by the daily morning digest cron instead.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
      },
    });

    if (leads.length === 0) {
      return NextResponse.json({ success: true, message: "No upcoming follow-ups" });
    }

    const results: { lead: string; sentTo: string }[] = [];

    for (const lead of leads) {
      // WhatsApp-only: skip if the assignee has no phone on file, but still mark
      // it handled so we don't re-scan it every run.
      const phone = lead.assignedUser?.phone;
      if (phone && lead.followUpDate) {
        const followUpTimeIST = lead.followUpDate.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        });

        try {
          const waRes = await sendWhatsAppTemplate(phone, "follow_up_reminder", "en", [
            {
              type: "body",
              parameters: [
                { type: "text", text: lead.assignedUser?.name || "Team" },
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

      // Mark as reminded so we never send twice (re-armed when the date changes).
      await prisma.lead.update({
        where: { id: lead.id },
        data: { followUpReminderSent: true },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${results.length} follow-up reminder(s)`,
      results,
    });
  } catch (error) {
    console.error("Follow-up reminder cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
