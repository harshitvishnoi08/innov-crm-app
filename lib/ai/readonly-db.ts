import pg from 'pg';

const { Pool } = pg;

/**
 * Dedicated connection pool for Innov AI.
 *
 * Mirrors the pg setup in lib/prisma.js (same DATABASE_URL, no explicit SSL so
 * it behaves identically against the Supabase pooler). Every query runs inside a
 * READ ONLY transaction with a statement timeout, so even if a write somehow slips
 * past the SQL guard the database itself rejects it. This is the safety backstop.
 */
function createReadonlyPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 30_000,
    // Keep AI queries from holding a connection forever while establishing.
    connectionTimeoutMillis: 10_000,
  });
}

// Reuse the pool across hot reloads in development to avoid leaking connections.
const globalForAiPool = globalThis as unknown as { innovAiPool?: pg.Pool };
const pool = globalForAiPool.innovAiPool ?? createReadonlyPool();
if (process.env.NODE_ENV !== 'production') globalForAiPool.innovAiPool = pool;

export interface ReadonlyResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

/** How long a single AI query may run before Postgres cancels it. */
const STATEMENT_TIMEOUT_MS = 15_000;

/**
 * Runs a single SQL statement inside a READ ONLY transaction and rolls back.
 *
 * The SQL must already be validated by sql-guard. READ ONLY mode means any
 * INSERT/UPDATE/DELETE/DDL — including data-modifying CTEs — fails at the DB level.
 */
export async function executeReadOnly(sql: string): Promise<ReadonlyResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const result = await client.query(sql);
    await client.query('ROLLBACK');

    const columns = result.fields?.map((f) => f.name) ?? [];
    const rows = (result.rows ?? []) as Record<string, unknown>[];
    return { columns, rows };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Connection may already be aborted; nothing more to do.
    }
    throw error;
  } finally {
    client.release();
  }
}
