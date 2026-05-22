import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { generateSql, summarizeResult, LLMError, type ChatTurn } from '@/lib/ai/llm';
import { guardSql, MAX_ROWS } from '@/lib/ai/sql-guard';
import { executeReadOnly } from '@/lib/ai/readonly-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ChatRequest {
  question?: string;
  history?: ChatTurn[];
}

export async function POST(request: Request) {
  // Innov AI is available to any authenticated user.
  const { user, response } = await requireAuth();
  if (!user) return response;

  let payload: ChatRequest;
  try {
    payload = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const question = payload.question?.trim();
  if (!question) {
    return NextResponse.json({ error: 'Please enter a question.' }, { status: 400 });
  }
  const history = Array.isArray(payload.history) ? payload.history : [];

  try {
    // 1. Natural language -> SQL plan.
    const plan = await generateSql(question, history);

    if (!plan.canAnswer || !plan.sql) {
      return NextResponse.json({
        answer:
          plan.message ||
          "I can only answer questions about your CRM data — try asking about leads, meetings, or WhatsApp activity.",
        sql: null,
        columns: [],
        rows: [],
        rowCount: 0,
        truncated: false,
      });
    }

    // 2. Enforce read-only + single-statement + row cap before touching the DB.
    const guard = guardSql(plan.sql);
    if (!guard.ok || !guard.sql) {
      return NextResponse.json({
        answer: `I generated a query that isn't allowed (${guard.reason}). Could you rephrase your question?`,
        sql: plan.sql,
        columns: [],
        rows: [],
        rowCount: 0,
        truncated: false,
      });
    }

    // 3. Execute inside a READ ONLY transaction.
    let result;
    try {
      result = await executeReadOnly(guard.sql);
    } catch (dbError) {
      const message = dbError instanceof Error ? dbError.message : 'Query execution failed.';
      return NextResponse.json({
        answer: `I couldn't run that query against the database: ${message}. Try rephrasing your question.`,
        sql: guard.sql,
        columns: [],
        rows: [],
        rowCount: 0,
        truncated: false,
      });
    }

    // Hard cap the rows returned to the client regardless of the query's own LIMIT.
    const truncated = result.rows.length > MAX_ROWS;
    const rows = truncated ? result.rows.slice(0, MAX_ROWS) : result.rows;
    const trimmed = { columns: result.columns, rows };

    // 4. Summarize into a natural sentence (best-effort).
    const answer = await summarizeResult(question, trimmed);

    return NextResponse.json({
      answer,
      sql: guard.sql,
      columns: result.columns,
      rows,
      rowCount: rows.length,
      truncated,
    });
  } catch (error) {
    if (error instanceof LLMError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error('Innov AI chat error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
