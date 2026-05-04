import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

export function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/** Fetch all admin email addresses from the DB */
export async function getAdminEmails(): Promise<string[]> {
  // Allow override via env var (comma-separated)
  if (process.env.LEAD_NOTIFICATION_EMAILS) {
    return process.env.LEAD_NOTIFICATION_EMAILS.split(",").map((e) => e.trim()).filter(Boolean);
  }
  const admins = await prisma.user.findMany({
    where: { rolePermission: { role: "ADMIN" } },
    select: { email: true },
  });
  return admins.map((a: { email: string }) => a.email);
}

type NewLeadData = {
  id: string;
  customerName: string;
  contactNumber: string;
  city?: string | null;
  platform?: string | null;
  leadSource?: string | null;
  propertyType?: string | null;
  status: string;
  assignedUser?: { name: string } | null;
};

export async function sendNewLeadNotification(lead: NewLeadData) {
  try {
    const recipients = await getAdminEmails();
    if (!recipients.length) return;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const leadUrl = `${siteUrl}/admin/leads/${lead.id}`;

    const rows = [
      ["Name",     lead.customerName],
      ["Phone",    lead.contactNumber || "—"],
      ["City",     lead.city || "—"],
      ["Platform", lead.platform || "—"],
      ["Source",   lead.leadSource || "—"],
      ["Property", lead.propertyType || "—"],
      ["Assigned", lead.assignedUser?.name || "Unassigned"],
    ]
      .map(
        ([label, value]) =>
          `<tr>
            <td style="padding:6px 12px;font-weight:600;color:#6b7280;white-space:nowrap;font-size:13px;">${label}</td>
            <td style="padding:6px 12px;color:#111827;font-size:13px;">${value}</td>
          </tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:24px 28px;">
            <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;">Innov CRM</p>
            <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">🆕 New Lead Received</h1>
          </td>
        </tr>

        <!-- Lead details -->
        <tr>
          <td style="padding:24px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${rows}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 28px 28px;">
            <a href="${leadUrl}"
               style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:14px;font-weight:600;">
              View Lead →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">You are receiving this because you are an admin of Innov CRM.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Innov CRM" <${process.env.SMTP_FROM}>`,
      to: recipients.join(", "),
      subject: `🆕 New Lead Notifications — Innov CRM`,
      text: `New lead received: ${lead.customerName} | ${lead.contactNumber} | ${lead.city || ""} | ${lead.platform || ""}\n\nView: ${leadUrl}`,
      html,
    });
  } catch (err) {
    // Never throw — email failure must not break lead creation
    console.error("sendNewLeadNotification failed:", err);
  }
}
