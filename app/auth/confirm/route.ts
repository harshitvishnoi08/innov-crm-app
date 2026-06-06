import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Server-side email confirmation endpoint for Supabase email links
 * (invite, password recovery, magic link, signup confirmation).
 *
 * Email templates point here with `?token_hash=...&type=...&next=...`. We verify
 * the OTP server-side via `verifyOtp`, which establishes the session by setting
 * auth cookies directly — unlike the PKCE `code` flow, this needs no client-side
 * code-verifier, so it works for admin-generated invites (where the flow was
 * never started in the invitee's browser).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  // Only allow same-origin relative redirects to avoid open-redirect abuse.
  // Must start with a single "/" — reject "//evil.com" and "/\evil.com", which
  // resolve to an external host.
  const nextParam = searchParams.get('next') ?? '/admin/dashboard';
  const isSafeNext =
    nextParam.startsWith('/') && nextParam[1] !== '/' && nextParam[1] !== '\\';
  const next = isSafeNext ? nextParam : '/admin/dashboard';

  // Honour the forwarded host so redirects resolve to the public URL when
  // running behind Vercel's proxy, not the internal one.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error('verifyOtp error:', error);
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', origin));
}
