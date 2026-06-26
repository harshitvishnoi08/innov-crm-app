import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Supabase server client and Prisma. We control what getClaims returns
// and assert getUser (the network round-trip we're removing) is never called.
const getClaims = vi.fn();
const getUser = vi.fn();

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims, getUser },
  })),
}));

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: vi.fn() } },
}));

import { requireAuth, requireAuthWithRole } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

const findUnique = vi.mocked(prisma.user.findUnique);

/** Shape Supabase returns for a successfully verified (local) JWT. */
function validClaims(overrides: Record<string, unknown> = {}) {
  getClaims.mockResolvedValue({
    data: { claims: { sub: 'user-123', email: 'a@b.com', ...overrides } },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requireAuth', () => {
  it('verifies the JWT locally via getClaims and never calls getUser', async () => {
    validClaims();

    const { user, response } = await requireAuth();

    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(getUser).not.toHaveBeenCalled();
    expect(response).toBeNull();
    expect(user?.id).toBe('user-123');
  });

  it('exposes the email claim on the returned user', async () => {
    validClaims();
    const { user } = await requireAuth();
    expect(user?.email).toBe('a@b.com');
  });

  it('returns a 401 response when there are no claims', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });

    const { user, response } = await requireAuth();

    expect(user).toBeNull();
    expect(response?.status).toBe(401);
  });

  it('returns a 401 response when getClaims reports an error', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('bad jwt') });

    const { user, response } = await requireAuth();

    expect(user).toBeNull();
    expect(response?.status).toBe(401);
  });

  it('returns a 401 when claims exist but have no subject', async () => {
    getClaims.mockResolvedValue({ data: { claims: { email: 'a@b.com' } }, error: null });

    const { user, response } = await requireAuth();

    expect(user).toBeNull();
    expect(response?.status).toBe(401);
  });
});

describe('requireAuthWithRole', () => {
  it('returns the user and ADMIN role from the database', async () => {
    validClaims();
    findUnique.mockResolvedValue({ rolePermission: { role: 'ADMIN' } } as never);

    const { user, role, response } = await requireAuthWithRole();

    expect(getUser).not.toHaveBeenCalled();
    expect(response).toBeNull();
    expect(user?.id).toBe('user-123');
    expect(role).toBe('ADMIN');
    // role is looked up by the verified subject claim
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-123' } }),
    );
  });

  it('defaults the role to USER when the user has no role permission', async () => {
    validClaims();
    findUnique.mockResolvedValue(null as never);

    const { role, response } = await requireAuthWithRole();

    expect(response).toBeNull();
    expect(role).toBe('USER');
  });

  it('returns a 401 and skips the role lookup when unauthenticated', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });

    const { user, role, response } = await requireAuthWithRole();

    expect(user).toBeNull();
    expect(role).toBeNull();
    expect(response?.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
