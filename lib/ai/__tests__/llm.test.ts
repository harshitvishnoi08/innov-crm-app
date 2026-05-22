import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSql, summarizeResult, LLMError, type ChatTurn } from '@/lib/ai/llm';

/** Minimal DeepSeek-shaped responses for the mocked fetch. */
function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function chatBody(content: string) {
  return { choices: [{ message: { content } }] };
}

/** Reads the JSON body of the nth fetch call. */
function requestBody(call: number) {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return JSON.parse(init.body as string) as {
    model: string;
    messages: { role: string; content: string }[];
    response_format?: { type: string };
    temperature: number;
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('generateSql', () => {
  it('parses a valid JSON plan and calls DeepSeek correctly', async () => {
    fetchMock.mockResolvedValue(
      okResponse(chatBody(JSON.stringify({ canAnswer: true, sql: 'SELECT 1', message: '' }))),
    );

    const plan = await generateSql('how many leads?');
    expect(plan).toEqual({ canAnswer: true, sql: 'SELECT 1', message: '' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');

    const body = requestBody(0);
    expect(body.model).toBe('deepseek-chat');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.temperature).toBe(0);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'how many leads?' });
  });

  it('includes only the last 6 history turns, mapped to roles', async () => {
    fetchMock.mockResolvedValue(
      okResponse(chatBody(JSON.stringify({ canAnswer: false, sql: '', message: 'hi' }))),
    );

    const history: ChatTurn[] = Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
    }));

    await generateSql('latest question', history);

    const body = requestBody(0);
    // system + 6 history + final user question
    expect(body.messages).toHaveLength(8);
    expect(body.messages.slice(1, 7).map((m) => m.content)).toEqual(['m2', 'm3', 'm4', 'm5', 'm6', 'm7']);
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'latest question' });
  });

  it('throws LLMError when the API key is missing (without calling fetch)', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    await expect(generateSql('q')).rejects.toBeInstanceOf(LLMError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws LLMError with the status on an HTTP error', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, { error: { message: 'invalid key' } }));
    await expect(generateSql('q')).rejects.toThrowError(/401/);
  });

  it('throws LLMError on empty content', async () => {
    fetchMock.mockResolvedValue(okResponse(chatBody('')));
    await expect(generateSql('q')).rejects.toBeInstanceOf(LLMError);
  });

  it('throws LLMError when content is not valid JSON', async () => {
    fetchMock.mockResolvedValue(okResponse(chatBody('not really json')));
    await expect(generateSql('q')).rejects.toThrowError(/unexpected/i);
  });

  it('maps an aborted request to a timeout LLMError', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(generateSql('q')).rejects.toThrowError(/timed out/i);
  });

  it('maps a network failure to a reachability LLMError', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(generateSql('q')).rejects.toThrowError(/reach/i);
  });
});

describe('summarizeResult', () => {
  it('returns the model sentence and does not request JSON mode', async () => {
    fetchMock.mockResolvedValue(okResponse(chatBody('There are 5 leads.')));
    const text = await summarizeResult('how many leads?', { columns: ['c'], rows: [{ c: 5 }] });
    expect(text).toBe('There are 5 leads.');
    expect(requestBody(0).response_format).toBeUndefined();
  });

  it('falls back to a generated count when the call fails (with rows)', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const text = await summarizeResult('q', { columns: ['c'], rows: [{ c: 1 }, { c: 2 }] });
    expect(text).toBe('Found 2 results.');
  });

  it('falls back to a no-records message when the call fails (no rows)', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const text = await summarizeResult('q', { columns: [], rows: [] });
    expect(text).toBe('No matching records were found.');
  });
});
