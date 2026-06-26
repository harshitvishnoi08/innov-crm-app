import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/** The authenticated user, derived from verified JWT claims (not the Auth server). */
export type AuthUser = { id: string; email: string | null };

/**
 * Verifies the session JWT locally via `getClaims()` and returns the user.
 *
 * Unlike `getUser()`, this does NOT make a network round-trip to the Supabase
 * Auth server on every request — the project uses asymmetric (ES256) signing
 * keys, so the signature is verified against a cached JWKS. The `sub` claim is
 * the user id; that's the only field the app reads off this user.
 */
async function getVerifiedUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub as string, email: (claims.email as string) ?? null };
}

/** Returns the authenticated user or a 401 response. */
export async function requireAuth() {
  const user = await getVerifiedUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, response: null };
}

/** Returns the authenticated user with their role ('ADMIN' | 'USER'), or a 401. */
export async function requireAuthWithRole() {
  const user = await getVerifiedUser();
  if (!user) {
    return { user: null, role: null as never, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { rolePermission: { select: { role: true } } },
  });
  const role = (dbUser?.rolePermission?.role ?? 'USER') as 'ADMIN' | 'USER';
  return { user, role, response: null };
}

/** Supabase Admin client (service role) — for server-side user management. */
export function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
