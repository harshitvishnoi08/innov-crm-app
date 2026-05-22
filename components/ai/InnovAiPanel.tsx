'use client';

import * as React from 'react';
import { Sparkles, Plus, ArrowUp, Copy, Check, Download, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Result payload returned by /api/ai/chat for a successful query. */
interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  sql: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: QueryResult;
  isError?: boolean;
  /** Intro message is shown but never sent back as conversation history. */
  isIntro?: boolean;
}

const EXAMPLE_QUESTIONS = [
  'How many leads came in this week?',
  'Show hot leads that are not closed',
  'Top 5 cities by number of leads',
  'Meetings scheduled in the next 7 days',
];

const INTRO_MESSAGE: ChatMessage = {
  id: 'intro',
  role: 'assistant',
  isIntro: true,
  content:
    "Hi! I'm Innov AI, your data assistant. Ask me anything about your leads, meetings, and WhatsApp activity.",
};

function newId() {
  return Math.random().toString(36).slice(2);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function prettyColumn(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toUpperCase();
}

/** Builds a CSV string from a query result. */
function toCsv(result: QueryResult): string {
  const escape = (v: unknown) => {
    const s = formatCell(v) === '—' && v == null ? '' : formatCell(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = result.columns.map(escape).join(',');
  const body = result.rows.map((row) => result.columns.map((c) => escape(row[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

function ResultTable({ result }: { result: QueryResult }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    // Copy as TSV so it pastes cleanly into spreadsheets.
    const header = result.columns.map(prettyColumn).join('\t');
    const body = result.rows.map((row) => result.columns.map((c) => formatCell(row[c])).join('\t')).join('\n');
    await navigator.clipboard.writeText(`${header}\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExport = () => {
    const blob = new Blob([toCsv(result)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `innov-ai-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (result.columns.length === 0 || result.rows.length === 0) {
    return <p className="mt-1 text-sm text-muted-foreground">No matching records were found.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {result.rowCount} result{result.rowCount === 1 ? '' : 's'}
          {result.truncated && ' (showing first 100)'}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={handleCopy} className="text-muted-foreground">
            {copied ? <Check className="text-emerald-500" /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="ghost" size="xs" onClick={handleExport} className="text-muted-foreground">
            <Download />
            Export
          </Button>
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr>
              {result.columns.map((col) => (
                <th
                  key={col}
                  className="border-b px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground"
                >
                  {prettyColumn(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className="even:bg-muted/30">
                {result.columns.map((col) => (
                  <td key={col} className="border-b px-3 py-2 align-top whitespace-nowrap">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InnovAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground',
        className,
      )}
    >
      <Sparkles className="size-4" />
    </div>
  );
}

export function InnovAiPanel() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([INTRO_MESSAGE]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const resetChat = () => {
    setMessages([INTRO_MESSAGE]);
    setInput('');
  };

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { id: newId(), role: 'user', content: trimmed };
    // Build conversation history from real (non-intro, non-error) turns.
    const history = messages
      .filter((m) => !m.isIntro && !m.isError)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, history }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'assistant', content: data.error || 'Something went wrong.', isError: true },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: data.answer ?? '',
          result:
            data.sql !== null || (data.rows && data.rows.length >= 0)
              ? {
                  columns: data.columns ?? [],
                  rows: data.rows ?? [],
                  rowCount: data.rowCount ?? 0,
                  truncated: Boolean(data.truncated),
                  sql: data.sql ?? null,
                }
              : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', content: 'Could not reach the server. Please try again.', isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <InnovAvatar className="size-9 [&_svg]:size-5" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">Innov AI</p>
            <p className="truncate text-xs text-muted-foreground italic">
              Your CRM data, just ask.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={resetChat} title="New chat">
            <Plus className="size-4" />
            <span className="sr-only">New chat</span>
          </Button>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" title="Close">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((message) =>
            message.role === 'user' ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {message.content}
                </div>
              </div>
            ) : message.isIntro ? (
              <div key={message.id} className="rounded-2xl bg-muted px-4 py-3 text-sm">
                <p>{message.content} For example:</p>
                <div className="mt-3 flex flex-col gap-2">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => void send(q)}
                      disabled={loading}
                      className="rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div key={message.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <InnovAvatar />
                  <span className="text-sm font-medium text-muted-foreground">Innov replied</span>
                </div>
                <div className="pl-9">
                  <p className={cn('text-sm', message.isError && 'text-destructive')}>{message.content}</p>
                  {message.result && <ResultTable result={message.result} />}
                  {message.result?.sql && (
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none hover:text-foreground">View query</summary>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-[11px] whitespace-pre-wrap">
                        {message.result.sql}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ),
          )}

          {loading && (
            <div className="flex items-center gap-2 pl-1 text-sm text-muted-foreground">
              <InnovAvatar />
              <Loader2 className="size-4 animate-spin" />
              <span>Thinking…</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="relative"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Innov anything…"
              disabled={loading}
              className="w-full rounded-full border bg-muted/50 py-3 pr-12 pl-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon-sm"
              disabled={loading || !input.trim()}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full"
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Innov AI · Read-only · 100 row limit
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
