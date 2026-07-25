import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createTransporter, getAdminEmails } from "@/lib/mailer";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Today's window in IST → UTC
    const ISTOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + ISTOffsetMs);
    const todayStartUTC = new Date(
      Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - ISTOffsetMs
    );
    const todayEndUTC = new Date(todayStartUTC.getTime() + 86_400_000);

    const leads = await prisma.lead.findMany({
      where: {
        followUpDate: { gte: todayStartUTC, lt: todayEndUTC },
        activeStatus: "ACTIVE",
      },
      select: {
        id: true,
        customerName: true,
        contactNumber: true,
        city: true,
        budgetRange: true,
        followUpDate: true,
        assignedUser: { select: { name: true, email: true } },
        teamMembers: { select: { user: { select: { email: true } } } },
      },
    });

    if (leads.length === 0) {
      return NextResponse.json({ success: true, message: "No follow-ups today" });
    }

    const adminEmails = await getAdminEmails();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const transporter = createTransporter();
    const results: { lead: string; sentTo: string[] }[] = [];

    for (const lead of leads) {
      // Send to assigned user + all collaborators + all admins (deduplicated)
      const recipients = Array.from(
        new Set([
          ...(lead.assignedUser?.email ? [lead.assignedUser.email] : []),
          ...lead.teamMembers
            .map((m: { user: { email: string | null } }) => m.user.email)
            .filter((e: string | null): e is string => !!e),
          ...adminEmails,
        ])
      ).filter(Boolean);

      if (!recipients.length) continue;

      const leadUrl = `${siteUrl}/admin/leads/${lead.id}`;
      const assignedName = lead.assignedUser?.name || "Team";

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
            <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">📅 Follow-up Reminder</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 28px 8px;">
            <p style="margin:0;font-size:14px;color:#374151;">Hi ${assignedName}, you have a follow-up call scheduled today.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 16px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${[
                ["Customer", lead.customerName],
                ["Phone", lead.contactNumber || "—"],
                ["City", lead.city || "—"],
                ["Budget", lead.budgetRange || "—"],
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
            <p style="margin:0;font-size:12px;color:#9ca3af;">You are receiving this because you are an admin or assigned to this lead in Innov CRM.</p>
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
        subject: `📅 Follow-up Today: ${lead.customerName}`,
        text: `Follow-up reminder: ${lead.customerName} | ${lead.contactNumber || ""} | ${lead.city || ""}\n\nView: ${leadUrl}`,
        html,
      });

      results.push({ lead: lead.customerName, sentTo: recipients });
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${results.length} reminder(s)`,
      results,
    });
  } catch (error) {
    console.error("Follow-up cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
