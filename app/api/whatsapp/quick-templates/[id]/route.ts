import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireAuthWithRole } from '@/lib/api-auth';

const updateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function requireAdmin() {
  const { user, role, response } = await requireAuthWithRole();
  if (!user) return { ok: false as const, response: response! };
  if (role !== 'ADMIN') {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payload.' }, { status: 400 });
  }

  const existing = await prisma.whatsAppQuickTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Template not found.' }, { status: 404 });
  }

  const template = await prisma.whatsAppQuickTemplate.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, data: { template } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const { id } = await params;
  const existing = await prisma.whatsAppQuickTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Template not found.' }, { status: 404 });
  }

  await prisma.whatsAppQuickTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { deletedId: id } });
}
