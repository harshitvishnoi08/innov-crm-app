import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createTransporter } from "@/lib/mailer";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

// Meta template body/header variables may not be empty — fall back to a placeholder.
const waSafe = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "N/A");

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in30Min = new Date(now.getTime() + 30 * 60 * 1000);

    // Find meetings starting in the next 30 minutes that haven't been reminded yet
    const meetings = await prisma.meeting.findMany({
      where: {
        meetingDate: { gte: now, lte: in30Min },
        reminderSent: false,
      },
      select: {
        id: true,
        agenda: true,
        meetingDate: true,
        lead: { select: { id: true, customerName: true, contactNumber: true, city: true } },
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (meetings.length === 0) {
      return NextResponse.json({ success: true, message: "No upcoming meetings" });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const transporter = createTransporter();
    const results: { meeting: string; sentTo: string[] }[] = [];

    for (const meeting of meetings) {
      // Send only to the person who created the meeting
      const recipients = [meeting.user?.email].filter(Boolean) as string[];

      if (!recipients.length) continue;

      const leadUrl = `${siteUrl}/admin/leads/${meeting.lead.id}`;
      const assignedName = meeting.user?.name || "Team";

      // Format meeting time in IST
      const meetingTimeIST = meeting.meetingDate.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

      const minsRemaining = Math.max(1, Math.round((meeting.meetingDate.getTime() - now.getTime()) / 60000));

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#111827;padding:24px 28px;">
            <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;">Innov CRM</p>
            <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">⏰ Meeting in ${minsRemaining} minute${minsRemaining === 1 ? "" : "s"}</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 28px 8px;">
            <p style="margin:0;font-size:14px;color:#374151;">Hi ${assignedName}, your meeting is starting soon.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 16px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${[
                ["Customer", meeting.lead.customerName],
                ["Phone",    meeting.lead.contactNumber || "—"],
                ["City",     meeting.lead.city || "—"],
                ["Time",     meetingTimeIST],
                ["Agenda",   meeting.agenda],
              ]
                .map(
                  ([label, value]) => `<tr>
                  <td style="padding:6px 12px;font-weight:600;color:#6b7280;white-space:nowrap;font-size:13px;">${label}</td>
                  <td style="padding:6px 12px;color:#111827;font-size:13px;">${value}</td>
                </tr>`
                )
                .join("")}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px 28px;">
            <a href="${leadUrl}"
               style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:14px;font-weight:600;">
              View Lead →
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 28px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">You are receiving this because you are an admin or assigned to this meeting in Innov CRM.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

      await transporter.sendMail({
        from: `"Innov CRM" <${process.env.SMTP_FROM}>`,
        to: recipients.join(", "),
        subject: `⏰ Meeting in ${minsRemaining} min: ${meeting.lead.customerName}`,
        text: `Meeting reminder: ${meeting.lead.customerName} at ${meetingTimeIST}\nAgenda: ${meeting.agenda}\n\nView: ${leadUrl}`,
        html,
      });

      // Also send a WhatsApp reminder to the salesperson, if they have a phone on file
      const sentTo = [...recipients];
      if (meeting.user?.phone) {
        try {
          const waRes = await sendWhatsAppTemplate(
            meeting.user.phone,
            "meeting_reminder",
            "en",
            [
              // Header: {{1}} = minutes remaining
              { type: "header", parameters: [{ type: "text", text: String(minsRemaining) }] },
              // Body: {{1}}..{{6}}
              {
                type: "body",
                parameters: [
                  { type: "text", text: assignedName },
                  { type: "text", text: waSafe(meeting.lead.customerName) },
                  { type: "text", text: waSafe(meeting.lead.contactNumber) },
                  { type: "text", text: waSafe(meeting.lead.city) },
                  { type: "text", text: meetingTimeIST },
                  { type: "text", text: waSafe(meeting.agenda) },
                ],
              },
              // URL button: {{1}} = lead id (appended to the template's base URL)
              { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: meeting.lead.id }] },
            ]
          );
          if (waRes.error) {
            console.error("Meeting reminder WhatsApp error:", waRes.error);
          } else {
            sentTo.push(`whatsapp:${meeting.user.phone}`);
          }
        } catch (waErr) {
          console.error("Meeting reminder WhatsApp send failed:", waErr);
        }
      }

      // Mark as reminded so we never send twice
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { reminderSent: true },
      });

      results.push({ meeting: meeting.lead.customerName, sentTo });
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${results.length} reminder(s)`,
      results,
    });
  } catch (error) {
    console.error("Meeting reminder cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
