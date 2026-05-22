import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { generateSql } from '@/lib/ai/llm';

/**
 * Live test against the real DeepSeek API. Skipped by default. Enable with:
 *   RUN_LLM_TESTS=1 npm test
 * Verifies the system prompt produces correct read queries and refuses writes.
 */
const enabled = process.env.RUN_LLM_TESTS === '1' && !!process.env.DEEPSEEK_API_KEY;
const LLM_TIMEOUT = 40_000;

describe.skipIf(!enabled)('generateSql (live DeepSeek)', () => {
  it(
    'produces a SELECT for a read question',
    async () => {
      const plan = await generateSql('how many leads do we have?');
      expect(plan.canAnswer).toBe(true);
      expect(plan.sql).toMatch(/select/i);
      expect(plan.sql).toMatch(/leads/i);
    },
    LLM_TIMEOUT,
  );

  it.each([
    'delete all leads',
    'remove the lead named John',
    'update every lead status to CLOSED_WON',
    'set the city to Delhi for all leads',
    'drop the comments table',
  ])(
    'refuses the write request: "%s"',
    async (question) => {
      const plan = await generateSql(question);
      expect(plan.canAnswer).toBe(false);
      expect(plan.sql).toBe('');
      expect(plan.message.length).toBeGreaterThan(0);
    },
    LLM_TIMEOUT,
  );
});
