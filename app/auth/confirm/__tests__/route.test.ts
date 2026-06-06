import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Supabase server client so no real network/cookie work happens.
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }));

import { GET } from '@/app/auth/confirm/route';
import { createClient } from '@/utils/supabase/server';

const verifyOtp = vi.fn();

function mockSupabase() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { verifyOtp },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

function makeRequest(
  query: Record<string, string>,
  headers: Record<string, string> = {},
  base = 'http://localhost'
): NextRequest {
  const url = new URL('/auth/confirm', base);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, { headers });
}

/** The Location header of a redirect response, as an absolute URL string. */
function location(res: Response): string {
  return res.headers.get('location') ?? '';
}

beforeEach(() => {
  vi.resetAllMocks();
  mockSupabase();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /auth/confirm — happy path', () => {
  it('verifies an invite and redirects to the set-password page', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(
      makeRequest({ token_hash: 'hash123', type: 'invite', next: '/auth/reset-password' })
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'invite', token_hash: 'hash123' });
    expect(res.status).toBe(307);
    expect(location(res)).toBe('http://localhost/auth/reset-password');
  });

  it('handles a recovery (forgot-password) link the same way', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(
      makeRequest({ token_hash: 'rec1', type: 'recovery', next: '/auth/reset-password' })
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'rec1' });
    expect(location(res)).toBe('http://localhost/auth/reset-password');
  });

  it('defaults to the dashboard when no next is given', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(makeRequest({ token_hash: 'h', type: 'invite' }));

    expect(location(res)).toBe('http://localhost/admin/dashboard');
  });
});

describe('GET /auth/confirm — failures redirect to login', () => {
  it('redirects to login when token_hash is missing (never calls verifyOtp)', async () => {
    const res = await GET(makeRequest({ type: 'invite', next: '/auth/reset-password' }));

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(location(res)).toBe('http://localhost/login?error=auth_failed');
  });

  it('redirects to login when type is missing', async () => {
    const res = await GET(makeRequest({ token_hash: 'h', next: '/auth/reset-password' }));

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(location(res)).toBe('http://localhost/login?error=auth_failed');
  });

  it('redirects to login when verifyOtp fails (e.g. expired/invalid token)', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired' } });

    const res = await GET(makeRequest({ token_hash: 'expired', type: 'invite' }));

    expect(verifyOtp).toHaveBeenCalled();
    expect(location(res)).toBe('http://localhost/login?error=auth_failed');
  });
});

describe('GET /auth/confirm — open-redirect protection', () => {
  it('ignores an absolute external next and falls back to the dashboard', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(
      makeRequest({ token_hash: 'h', type: 'invite', next: 'https://evil.com/phish' })
    );

    expect(location(res)).toBe('http://localhost/admin/dashboard');
  });

  it('ignores a protocol-relative next and falls back to the dashboard', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    // Note: a protocol-relative URL like //evil.com starts with "/", so guard
    // against it explicitly — this documents the expected behaviour.
    const res = await GET(
      makeRequest({ token_hash: 'h', type: 'invite', next: '//evil.com' })
    );

    expect(location(res)).not.toContain('evil.com');
  });
});

describe('GET /auth/confirm — proxy host handling', () => {
  it('uses x-forwarded-host so redirects resolve to the public URL behind Vercel', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(
      makeRequest(
        { token_hash: 'h', type: 'invite', next: '/auth/reset-password' },
        { 'x-forwarded-host': 'innov-crm-app-puce.vercel.app', 'x-forwarded-proto': 'https' }
      )
    );

    expect(location(res)).toBe('https://innov-crm-app-puce.vercel.app/auth/reset-password');
  });
});
