import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuthWithRole } from '@/lib/api-auth';

export async function GET() {
  const { response } = await requireAuthWithRole();
  if (response) return response;

  const rules = await prisma.whatsAppTemplateRule.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const { role, response } = await requireAuthWithRole();
  if (response) return response;
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, formKeyword, templateName, language, videoId, notifyNumber, isActive } = body;

  if (!name || !formKeyword || !templateName) {
    return NextResponse.json({ error: 'name, formKeyword and templateName are required' }, { status: 400 });
  }

  const rule = await prisma.whatsAppTemplateRule.create({
    data: {
      name,
      formKeyword: formKeyword.toLowerCase().trim(),
      templateName,
      language: language || 'en',
      videoId: videoId || null,
      notifyNumber: notifyNumber || null,
      isActive: isActive ?? true,
    },
  });
  return NextResponse.json(rule, { status: 201 });
}
