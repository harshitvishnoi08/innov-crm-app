import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { executeReadOnly } from '@/lib/ai/readonly-db';

/**
 * Integration test that hits the real database. Skipped by default so the normal
 * `npm test` run stays hermetic. Enable with:
 *   RUN_DB_TESTS=1 npm test
 */
const enabled = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)('executeReadOnly (integration)', () => {
  it('runs a read query and returns rows', async () => {
    const result = await executeReadOnly('SELECT 1 AS x');
    expect(result.columns).toContain('x');
    expect(result.rows[0]).toEqual({ x: 1 });
  });

  // Every one of these is fed DIRECTLY to executeReadOnly, bypassing the SQL guard,
  // to prove the database itself refuses to write regardless of what SQL reaches it.
  it.each([
    ['UPDATE', 'UPDATE leads SET city = city'],
    ['DELETE', 'DELETE FROM comments WHERE id IS NULL'],
    ['INSERT', "INSERT INTO comments (\"leadId\", content) VALUES ('x', 'y')"],
    ['TRUNCATE', 'TRUNCATE comments'],
    ['DROP', 'DROP TABLE IF EXISTS comments'],
    ['ALTER', 'ALTER TABLE leads ADD COLUMN hacked text'],
    ['CREATE', 'CREATE TABLE innov_ai_hack (id int)'],
    ['SELECT INTO', 'SELECT * INTO innov_ai_hack FROM leads'],
    ['data-modifying CTE', 'WITH d AS (DELETE FROM comments RETURNING id) SELECT * FROM d'],
    ['GRANT', 'GRANT ALL ON leads TO PUBLIC'],
  ])('rejects %s at the database level', async (_label, sql) => {
    await expect(executeReadOnly(sql)).rejects.toThrow(/read-only/i);
  });
});
