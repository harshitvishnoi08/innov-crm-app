/**
 * Static safety checks for AI-generated SQL.
 *
 * This is the first line of defense; the READ ONLY transaction in readonly-db.ts
 * is the second. A query must pass BOTH to run.
 */

export const MAX_ROWS = 100;

/** Statements that must never appear, even inside a CTE or subquery. */
const FORBIDDEN_KEYWORDS = [
  'insert',
  'into', // blocks `SELECT ... INTO newtable` (table creation)
  'update',
  'delete',
  'drop',
  'alter',
  'create',
  'truncate',
  'grant',
  'revoke',
  'merge',
  'comment',
  'call',
  'copy',
  'execute',
  'vacuum',
  'analyze',
  'reindex',
  'refresh',
  'lock',
  'do',
  'set',
  'reset',
  'begin',
  'commit',
  'rollback',
  'savepoint',
  'pg_sleep',
];

export interface GuardResult {
  ok: boolean;
  /** The cleaned, limit-enforced SQL ready to execute (only when ok). */
  sql?: string;
  /** Why the query was rejected (only when !ok). */
  reason?: string;
}

/** Removes SQL line (`--`) and block (`/* *​/`) comments so they can't hide statements. */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

/**
 * Replaces the contents of string literals with placeholders so that the
 * structural checks (statement-splitting, keyword scan) don't trip on data
 * values like `ILIKE '%update kitchen%'`. Only used for analysis — the executed
 * SQL keeps its original literals.
 */
function maskStringLiterals(sql: string): string {
  return sql
    // Dollar-quoted strings: $$...$$ or $tag$...$tag$
    .replace(/\$([A-Za-z0-9_]*)\$[\s\S]*?\$\1\$/g, "''")
    // Single-quoted strings, honoring '' escapes.
    .replace(/'(?:[^']|'')*'/g, "''");
}

/**
 * Validates that `rawSql` is a single read-only SELECT/WITH statement and returns
 * a cleaned version with a row limit enforced.
 */
export function guardSql(rawSql: string): GuardResult {
  if (!rawSql || typeof rawSql !== 'string') {
    return { ok: false, reason: 'No SQL was produced.' };
  }

  let sql = stripComments(rawSql).trim();

  // Drop a single trailing semicolon. All structural checks below run against a
  // copy with string literals masked, so values can't be mistaken for syntax.
  sql = sql.replace(/;\s*$/, '').trim();
  const scan = maskStringLiterals(sql);

  // A remaining semicolon (outside a literal) means multiple statements.
  if (scan.includes(';')) {
    return { ok: false, reason: 'Only a single statement is allowed.' };
  }

  if (sql.length === 0) {
    return { ok: false, reason: 'The query was empty.' };
  }

  // Must begin with SELECT or WITH (a read CTE).
  if (!/^(select|with)\b/i.test(scan)) {
    return { ok: false, reason: 'Only SELECT queries are allowed.' };
  }

  // Whole-word scan for any data-modifying / dangerous keyword anywhere in the query.
  for (const word of FORBIDDEN_KEYWORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(scan)) {
      return { ok: false, reason: `Disallowed keyword "${word.toUpperCase()}" in query.` };
    }
  }

  // Enforce a row cap. Only append when the query has no LIMIT already
  // (checked against the masked copy so a literal "limit" doesn't count).
  if (!/\blimit\b/i.test(scan)) {
    sql = `${sql} LIMIT ${MAX_ROWS}`;
  }

  return { ok: true, sql };
}
