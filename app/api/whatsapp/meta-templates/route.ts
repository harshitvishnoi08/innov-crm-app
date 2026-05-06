import { NextResponse } from 'next/server';
import { requireAuthWithRole } from '@/lib/api-auth';

export async function GET() {
  const { response } = await requireAuthWithRole();
  if (response) return response;

  const wabaId = process.env.WHATSAPP_WABA_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!wabaId || !accessToken) {
    return NextResponse.json({ error: 'WHATSAPP_WABA_ID or WHATSAPP_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${wabaId}/message_templates?fields=name,status,category,language,components&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json() as { data?: unknown[]; error?: unknown };

  if (!res.ok) {
    return NextResponse.json({ error: data.error }, { status: res.status });
  }

  return NextResponse.json(data.data ?? []);
}
