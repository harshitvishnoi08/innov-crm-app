import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/whatsapp';

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const OUR_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;

// GET — Meta webhook verification
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// POST — receive inbound messages and delivery status updates
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ success: true });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const value = change.value;

        // ── Status updates (delivered, read, failed) ──
        for (const status of value.statuses ?? []) {
          const update: Record<string, unknown> = { status: status.status };
          if (status.status === 'delivered') update.deliveredAt = new Date(Number(status.timestamp) * 1000);
          if (status.status === 'read') update.readAt = new Date(Number(status.timestamp) * 1000);
          if (status.status === 'failed') {
            update.failedAt = new Date(Number(status.timestamp) * 1000);
            update.failureReason = status.errors?.[0]?.title ?? 'Unknown error';
          }

          await prisma.whatsAppMessage.updateMany({
            where: { wamid: status.id },
            data: update,
          });
        }

        // ── Inbound messages ──
        for (const msg of value.messages ?? []) {
          const fromNumber = normalizePhone(msg.from);

          // Find lead by contact number
          const lead = await prisma.lead.findFirst({
            where: {
              OR: [
                { contactNumber: fromNumber },
                { contactNumber: msg.from },
                { contactNumber: { endsWith: fromNumber.slice(-10) } },
              ],
            },
            select: { id: true },
          });

          if (!lead) {
            console.log(`Inbound WhatsApp from unknown number: ${msg.from}`);
            continue;
          }

          const messageBody =
            msg.type === 'text' ? msg.text?.body :
            msg.type === 'button' ? msg.button?.text :
            msg.type === 'interactive' ? (msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title) :
            null;

          // Deduplicate by wamid
          const existing = await prisma.whatsAppMessage.findUnique({ where: { wamid: msg.id } });
          if (existing) continue;

          await prisma.whatsAppMessage.create({
            data: {
              leadId: lead.id,
              wamid: msg.id,
              fromNumber,
              toNumber: OUR_PHONE_NUMBER_ID,
              direction: 'inbound',
              messageType: msg.type ?? 'text',
              messageBody,
              mediaUrl: msg.image?.id ?? msg.document?.id ?? null,
              isReply: !!msg.context?.id,
              replyToWamid: msg.context?.id ?? null,
              buttonText: msg.button?.text ?? null,
              status: 'read',
              sentAt: new Date(Number(msg.timestamp) * 1000),
              readAt: new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
