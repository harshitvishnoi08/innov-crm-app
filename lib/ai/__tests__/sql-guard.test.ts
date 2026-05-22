import { describe, it, expect } from 'vitest';
import { guardSql, MAX_ROWS } from '@/lib/ai/sql-guard';

describe('guardSql — accepting valid read queries', () => {
  it('accepts a simple SELECT and appends a row limit', () => {
    const result = guardSql('SELECT * FROM leads');
    expect(result.ok).toBe(true);
    expect(result.sql).toBe(`SELECT * FROM leads LIMIT ${MAX_ROWS}`);
  });

  it('accepts a WITH/CTE query', () => {
    const result = guardSql('WITH x AS (SELECT 1 AS a) SELECT * FROM x');
    expect(result.ok).toBe(true);
    expect(result.sql).toBe(`WITH x AS (SELECT 1 AS a) SELECT * FROM x LIMIT ${MAX_ROWS}`);
  });

  it('does not add a second LIMIT when one already exists', () => {
    const result = guardSql('SELECT * FROM leads LIMIT 5');
    expect(result.ok).toBe(true);
    expect(result.sql).toBe('SELECT * FROM leads LIMIT 5');
  });

  it('strips a trailing semicolon', () => {
    const result = guardSql('SELECT 1;');
    expect(result.ok).toBe(true);
    expect(result.sql).toBe(`SELECT 1 LIMIT ${MAX_ROWS}`);
  });

  it('is case-insensitive about the leading keyword', () => {
    expect(guardSql('select 1').ok).toBe(true);
    expect(guardSql('  With t As (select 1 as a) select * from t').ok).toBe(true);
  });

  it('does not flag real camelCase columns that contain keyword substrings', () => {
    // "updatedAt"/"createdAt" contain update/create but are not whole words.
    const result = guardSql('SELECT "updatedAt", "createdAt" FROM leads');
    expect(result.ok).toBe(true);
  });
});

describe('guardSql — string literals are not mistaken for syntax', () => {
  it('allows a forbidden keyword inside a string literal', () => {
    const result = guardSql("SELECT * FROM leads WHERE requirement ILIKE '%update kitchen%'");
    expect(result.ok).toBe(true);
    expect(result.sql).toContain("ILIKE '%update kitchen%'");
  });

  it('allows a semicolon inside a string literal', () => {
    const result = guardSql("SELECT * FROM leads WHERE city = 'a;b'");
    expect(result.ok).toBe(true);
  });

  it('handles doubled single-quote escapes', () => {
    const result = guardSql("SELECT * FROM leads WHERE \"customerName\" = 'O''Brien delete'");
    expect(result.ok).toBe(true);
  });
});

describe('guardSql — rejecting writes and dangerous input', () => {
  it.each([
    ['UPDATE leads SET city = null', /SELECT queries/],
    ['DELETE FROM leads', /SELECT queries/],
    ['INSERT INTO leads (id) VALUES (1)', /SELECT queries/],
    ['DROP TABLE leads', /SELECT queries/],
    ['TRUNCATE leads', /SELECT queries/],
  ])('rejects %s', (sql, reason) => {
    const result = guardSql(sql);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(reason);
  });

  it('rejects multiple statements', () => {
    const result = guardSql('SELECT 1; DROP TABLE leads');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/single statement/);
  });

  it('rejects a data-modifying CTE even though it starts with WITH', () => {
    const result = guardSql('WITH x AS (DELETE FROM leads RETURNING id) SELECT * FROM x');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/DELETE/);
  });

  it('rejects an INSERT hidden in a CTE', () => {
    const result = guardSql("WITH x AS (INSERT INTO leads(id) VALUES ('a') RETURNING id) SELECT * FROM x");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/INSERT/);
  });

  it('strips comments before scanning so they cannot hide a statement', () => {
    const lineComment = guardSql('SELECT 1 -- ; DROP TABLE leads');
    expect(lineComment.ok).toBe(true);
    expect(lineComment.sql).toBe(`SELECT 1 LIMIT ${MAX_ROWS}`);

    const blockComment = guardSql('SELECT 1 /* DROP TABLE leads */ FROM leads');
    expect(blockComment.ok).toBe(true);
  });

  it('blocks pg_sleep and other dangerous functions', () => {
    const result = guardSql('SELECT pg_sleep(10)');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/PG_SLEEP/);
  });

  it('blocks SELECT ... INTO (table creation) even though it starts with SELECT', () => {
    const result = guardSql('SELECT * INTO backup_leads FROM leads');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/INTO/);
  });

  it('blocks SELECT ... FOR UPDATE (locking read)', () => {
    const result = guardSql('SELECT * FROM leads FOR UPDATE');
    expect(result.ok).toBe(false);
  });

  it('rejects empty / whitespace / non-string input', () => {
    expect(guardSql('').ok).toBe(false);
    expect(guardSql('   ').ok).toBe(false);
    expect(guardSql(null as unknown as string).ok).toBe(false);
  });
});
