import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthWithRole } from '@/lib/api-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { role, response } = await requireAuthWithRole();
  if (response) return response;
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, formKeyword, templateName, language, videoId, isActive } = body;

  const rule = await prisma.whatsAppTemplateRule.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(formKeyword !== undefined && { formKeyword: formKeyword.toLowerCase().trim() }),
      ...(templateName !== undefined && { templateName }),
      ...(language !== undefined && { language }),
      ...(videoId !== undefined && { videoId: videoId || null }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  return NextResponse.json(rule);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { role, response } = await requireAuthWithRole();
  if (response) return response;
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await prisma.whatsAppTemplateRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
