import { NextResponse } from 'next/server';
import { requireAuthWithRole } from '@/lib/api-auth';

export async function GET() {
  const { response } = await requireAuthWithRole();
  if (response) return response;

  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: 'META_PAGE_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  // System User tokens need to go through /me/accounts to get the page token,
  // then use the page token to fetch leadgen_forms.
  const accountsRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&limit=10&access_token=${accessToken}`
  );
  const accountsData = await accountsRes.json() as {
    data?: { id: string; name: string; access_token: string }[];
    error?: unknown;
  };

  if (!accountsRes.ok || accountsData.error) {
    // Fallback: try /me/leadgen_forms directly (works with page access tokens)
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/leadgen_forms?fields=name,id,status&limit=100&access_token=${accessToken}`
    );
    const data = await res.json() as { data?: { id: string; name: string; status: string }[]; error?: unknown };
    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error ?? accountsData.error }, { status: 500 });
    }
    return NextResponse.json(data.data ?? []);
  }

  const pages = accountsData.data ?? [];
  if (pages.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch leadgen forms for all pages and combine
  const results = await Promise.all(
    pages.map(async page => {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${page.id}/leadgen_forms?fields=name,id,status&limit=100&access_token=${page.access_token}`
      );
      const data = await res.json() as { data?: { id: string; name: string; status: string }[] };
      return (data.data ?? []).map(f => ({ ...f, pageName: page.name }));
    })
  );

  return NextResponse.json(results.flat());
}
