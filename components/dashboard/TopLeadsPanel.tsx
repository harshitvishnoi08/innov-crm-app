'use client';

import { useMemo, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { parseMessage } from '@/utils/string.utils';
import { ChevronRight, Phone } from 'lucide-react';

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
  });
}

function formatIndiaDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const datePart = date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

const TEMP_EMOJI: Record<string, string> = { HOT: '🔥', WARM: '🌡️', COLD: '❄️' };
const TEMP_COLOR: Record<string, string> = {
  HOT: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  WARM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  COLD: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};
const STATUS_COLOR: Record<string, string> = {
  NEW: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  FOLLOW_UP: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  NOT_ANSWERED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  MEETING_FIXED: 'bg-green-500/10 text-green-400 border-green-500/20',
  CONTACT_IN_FUTURE: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  CLOSED_WON: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CLOSED_LOST: 'bg-red-500/10 text-red-400 border-red-500/20',
  JUNK: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

type Lead = {
  id: string;
  name?: string | null;
  phone?: string | null;
  status?: string | null;
  temperature?: string | null;
  isActive: boolean;
  createdAt?: string | null;
};

export function TopLeadsPanel({
  recentLeads,
  onViewAll,
}: {
  recentLeads: Lead[];
  onViewAll: () => void;
}) {
  const hasLeads = useMemo(() => !!recentLeads?.length, [recentLeads]);
  const router = useRouter();
  const openLead = (id: string, e?: MouseEvent) => {
    const url = `/admin/leads/${id}`;
    // Ctrl/Cmd+click or middle-click should open in a new tab, like a real link.
    if (e && (e.ctrlKey || e.metaKey || e.button === 1)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    router.push(url);
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Recent leads</CardTitle>
          <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs">
            View all →
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {!hasLeads ? (
          <div className="px-6 pb-6">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground text-center">
              No leads yet. Once added, they will appear here.
            </div>
          </div>
        ) : (
          <>
            {/* ── Mobile card list (hidden md+) ── */}
            <div className="divide-y md:hidden">
              {recentLeads.map((lead) => {
                const temp = lead.temperature ?? '';
                const status = lead.status ?? '';
                const relTime = formatRelativeTime(lead.createdAt);
                return (
                  <div
                    key={lead.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 active:bg-muted/50"
                    onClick={e => openLead(lead.id, e)}
                    onAuxClick={e => { if (e.button === 1) openLead(lead.id, e); }}
                  >
                    {/* Temperature dot */}
                    <div
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        temp === 'HOT' ? 'bg-orange-400' :
                        temp === 'WARM' ? 'bg-yellow-400' :
                        temp === 'COLD' ? 'bg-blue-400' : 'bg-muted-foreground/30'
                      }`}
                    />

                    {/* Main info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">
                        {lead.name || 'Unnamed lead'}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {lead.phone && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Phone className="h-2.5 w-2.5" />
                            {lead.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: badges + time */}
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {status && (
                        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${STATUS_COLOR[status] ?? 'bg-muted text-muted-foreground'}`}>
                          {parseMessage(status)}
                        </span>
                      )}
                      {relTime && (
                        <span className="text-[10px] text-muted-foreground">{relTime}</span>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </div>
                );
              })}
              {/* Footer tap target */}
              <button
                onClick={onViewAll}
                className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View all leads
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* ── Desktop table (hidden below md) ── */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Temp</TableHead>
                    <TableHead className="pr-6 text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={e => openLead(lead.id, e)}
                      onAuxClick={e => { if (e.button === 1) openLead(lead.id, e); }}
                    >
                      <TableCell className="pl-6 font-medium">
                        {lead.name || 'Unnamed lead'}
                        <div className="text-xs text-muted-foreground">
                          {lead.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.phone || '—'}
                      </TableCell>
                      <TableCell>
                        {lead.status ? (
                          <Badge variant="outline" className="whitespace-nowrap">
                            {parseMessage(lead.status)}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {lead.temperature ? (
                          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${TEMP_COLOR[lead.temperature] ?? ''}`}>
                            {TEMP_EMOJI[lead.temperature]} {parseMessage(lead.temperature)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right text-muted-foreground whitespace-nowrap">
                        {formatIndiaDateTime(lead.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function TopLeadsPanelSkeleton() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
