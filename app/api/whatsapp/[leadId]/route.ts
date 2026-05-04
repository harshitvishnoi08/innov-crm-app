import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthWithRole } from '@/lib/api-auth';
import { sendWhatsAppText, normalizePhone, WhatsAppApiResponse } from '@/lib/whatsapp';

// GET — fetch WhatsApp messages for a lead
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;

    // USER can only access their assigned leads
    if (role === 'USER') {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedTo: true } });
      if (!lead || lead.assignedTo !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const messages = await prisma.whatsAppMessage.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error('GET whatsapp messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — send a WhatsApp message to the lead
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  try {
    const { user, role, response } = await requireAuthWithRole();
    if (!user) return response!;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, contactNumber: true, assignedTo: true },
    });

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (role === 'USER' && lead.assignedTo !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!lead.contactNumber) {
      return NextResponse.json({ error: 'Lead has no contact number' }, { status: 400 });
    }

    const body = await req.json() as { message: string; templateName?: string };

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const toNumber = normalizePhone(lead.contactNumber);
    const fromNumber = process.env.WHATSAPP_PHONE_NUMBER_ID!;

    // Send via Meta API
    const apiRes: WhatsAppApiResponse = await sendWhatsAppText(lead.contactNumber, body.message);

    if (apiRes.error) {
      return NextResponse.json({ error: apiRes.error.message }, { status: 400 });
    }

    const wamid = apiRes.messages?.[0]?.id ?? null;

    // Store in DB
    const message = await prisma.whatsAppMessage.create({
      data: {
        leadId,
        wamid,
        fromNumber,
        toNumber,
        direction: 'outbound',
        messageType: 'text',
        messageBody: body.message,
        status: 'sent',
        sentBy: user.id,
        sentAt: new Date(),
      },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    console.error('POST whatsapp send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
