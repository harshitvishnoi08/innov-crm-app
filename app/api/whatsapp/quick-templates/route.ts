import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireAuthWithRole } from '@/lib/api-auth';

const templateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(80, 'Title is too long.'),
  body: z.string().trim().min(1, 'Message body is required.').max(4000, 'Message is too long.'),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// GET — any authenticated user (the lead WhatsApp menu reads active templates).
export async function GET() {
  const { user, response } = await requireAuthWithRole();
  if (!user) return response!;

  const templates = await prisma.whatsAppQuickTemplate.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ success: true, data: { templates } });
}

// POST — admin only.
export async function POST(request: Request) {
  const { user, role, response } = await requireAuthWithRole();
  if (!user) return response!;
  if (role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = templateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payload.' }, { status: 400 });
  }

  const template = await prisma.whatsAppQuickTemplate.create({ data: parsed.data });
  return NextResponse.json({ success: true, data: { template } }, { status: 201 });
}
