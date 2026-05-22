import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock external dependencies; keep the real sql-guard so its enforcement is exercised.
vi.mock('@/lib/api-auth', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/readonly-db', () => ({ executeReadOnly: vi.fn() }));
vi.mock('@/lib/ai/llm', () => {
  class LLMError extends Error {}
  return { generateSql: vi.fn(), summarizeResult: vi.fn(), LLMError };
});

import { POST } from '@/app/api/ai/chat/route';
import { requireAuth } from '@/lib/api-auth';
import { executeReadOnly } from '@/lib/ai/readonly-db';
import { generateSql, summarizeResult, LLMError } from '@/lib/ai/llm';

type RequireAuthReturn = Awaited<ReturnType<typeof requireAuth>>;

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function authed() {
  vi.mocked(requireAuth).mockResolvedValue({
    user: { id: 'u1' },
    response: null,
  } as unknown as RequireAuthReturn);
}

beforeEach(() => {
  vi.resetAllMocks();
  authed();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/ai/chat — request validation', () => {
  it('returns the 401 response when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    } as unknown as RequireAuthReturn);

    const res = await POST(makeRequest({ question: 'x' }));
    expect(res.status).toBe(401);
    expect(generateSql).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid JSON body', async () => {
    const res = await POST(makeRequest('{ not json'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on an empty question', async () => {
    const res = await POST(makeRequest({ question: '   ' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/ai/chat — query flow', () => {
  it('returns the assistant message and runs no query when canAnswer is false', async () => {
    vi.mocked(generateSql).mockResolvedValue({ canAnswer: false, sql: '', message: 'Hi there!' });

    const res = await POST(makeRequest({ question: 'hello' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.answer).toBe('Hi there!');
    expect(json.sql).toBeNull();
    expect(executeReadOnly).not.toHaveBeenCalled();
  });

  it('rejects a disallowed generated query before touching the database', async () => {
    vi.mocked(generateSql).mockResolvedValue({ canAnswer: true, sql: 'DELETE FROM leads', message: '' });

    const res = await POST(makeRequest({ question: 'delete all leads' }));
    const json = await res.json();
    expect(json.answer).toMatch(/isn't allowed/);
    expect(json.sql).toBe('DELETE FROM leads');
    expect(executeReadOnly).not.toHaveBeenCalled();
    expect(summarizeResult).not.toHaveBeenCalled();
  });

  it('enforces a LIMIT on the executed query and surfaces DB errors gracefully', async () => {
    vi.mocked(generateSql).mockResolvedValue({ canAnswer: true, sql: 'SELECT * FROM leads', message: '' });
    vi.mocked(executeReadOnly).mockRejectedValue(new Error('boom'));

    const res = await POST(makeRequest({ question: 'all leads' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.answer).toMatch(/couldn't run that query/);
    expect(json.answer).toMatch(/boom/);
    expect(executeReadOnly).toHaveBeenCalledWith('SELECT * FROM leads LIMIT 100');
  });

  it('returns rows and a summary on success', async () => {
    vi.mocked(generateSql).mockResolvedValue({
      canAnswer: true,
      sql: 'SELECT "customerName" FROM leads',
      message: '',
    });
    vi.mocked(executeReadOnly).mockResolvedValue({
      columns: ['customerName'],
      rows: [{ customerName: 'A' }, { customerName: 'B' }],
    });
    vi.mocked(summarizeResult).mockResolvedValue('There are 2 leads.');

    const res = await POST(makeRequest({ question: 'lead names' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.answer).toBe('There are 2 leads.');
    expect(json.rowCount).toBe(2);
    expect(json.columns).toEqual(['customerName']);
    expect(json.rows).toHaveLength(2);
    expect(json.truncated).toBe(false);
    expect(json.sql).toBe('SELECT "customerName" FROM leads LIMIT 100');
  });

  it('caps rows at 100 and flags truncation', async () => {
    const rows = Array.from({ length: 105 }, (_, i) => ({ n: i }));
    vi.mocked(generateSql).mockResolvedValue({ canAnswer: true, sql: 'SELECT n FROM t LIMIT 1000', message: '' });
    vi.mocked(executeReadOnly).mockResolvedValue({ columns: ['n'], rows });
    vi.mocked(summarizeResult).mockResolvedValue('many');

    const res = await POST(makeRequest({ question: 'lots' }));
    const json = await res.json();
    expect(json.rowCount).toBe(100);
    expect(json.rows).toHaveLength(100);
    expect(json.truncated).toBe(true);
  });
});

describe('POST /api/ai/chat — error handling', () => {
  it('returns 502 on an LLMError', async () => {
    vi.mocked(generateSql).mockRejectedValue(new LLMError('AI is down'));
    const res = await POST(makeRequest({ question: 'x' }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('AI is down');
  });

  it('returns 500 on an unexpected error', async () => {
    vi.mocked(generateSql).mockRejectedValue(new Error('weird'));
    const res = await POST(makeRequest({ question: 'x' }));
    expect(res.status).toBe(500);
  });
});
