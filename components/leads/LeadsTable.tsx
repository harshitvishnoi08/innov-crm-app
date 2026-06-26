'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useLeadsQuery, useLeadsMetaQuery, useCreateLead, usePrefetchLead, leadQueryKeys, type LeadsResponse } from '@/queries/leads';
import { fetchLeads } from '@/services/leads.service';
import { useQueryClient } from '@tanstack/react-query';
import { useUsersQuery } from '@/queries/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Trash2, ChevronRight, X, Download, Phone, ChevronLeft, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { WhatsAppLinkMenu } from '@/components/leads/WhatsAppLinkMenu';
import { LeadStatusCell } from '@/components/leads/LeadStatusCell';
import { DateCreatedFilter, dateCreatedLabel } from '@/components/leads/DateCreatedFilter';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];


function getPageNums(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const TEMP_EMOJI: Record<string, string> = { HOT: '🔥', WARM: '🌡️', COLD: '❄️' };
const TEMP_COLOR: Record<string, string> = {
  HOT: 'bg-red-500/10 text-red-400 border-red-500/20',
  WARM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  COLD: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};
const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'NOT_ANSWERED', label: 'Not Answered' },
  { value: 'MEETING_FIXED', label: 'Meeting Fixed' },
  { value: 'CONTACT_IN_FUTURE', label: 'Contact in Future' },
  { value: 'CLOSED_WON', label: 'Closed Won' },
  { value: 'CLOSED_LOST', label: 'Closed Lost' },
  { value: 'JUNK', label: 'Junk' },
];
const ACTIVE_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'HOLD', label: 'Hold' },
];

function ContactButtons({
  phone,
  customerName,
  size = 'md',
}: {
  phone: string;
  customerName?: string | null;
  size?: 'sm' | 'md';
}) {
  const [confirmCall, setConfirmCall] = useState(false);
  const btnCls = size === 'sm'
    ? 'rounded p-1 transition-colors active:scale-90 active:opacity-60'
    : 'rounded-lg p-1.5 transition-colors active:scale-90 active:opacity-60';
  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setConfirmCall(true); }}
        className={`${btnCls} text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500`}
        title="Call"
      >
        <Phone className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </button>
      <WhatsAppLinkMenu
        phone={phone}
        customerName={customerName}
        size={size}
        onClick={e => e.stopPropagation()}
      />
      <Dialog open={confirmCall} onOpenChange={setConfirmCall}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Call {phone}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will open your phone dialer to make a call.</p>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => setConfirmCall(false)}>Cancel</Button>
            <a href={`tel:${phone}`} onClick={() => setConfirmCall(false)}>
              <Button size="sm"><Phone className="mr-1.5 h-4 w-4" /> Call now</Button>
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="ml-0.5 rounded-full hover:text-destructive transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function LeadsTableSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

type LeadRowProps = {
  lead: Record<string, unknown>;
  isSelected: boolean;
  isAdmin: boolean;
  users: { id: string; name: string }[];
  onOpen: (id: string) => void;
  onPrefetch: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onInlinePatch: (id: string, data: Record<string, unknown>) => void;
  onInlineUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string) => void;
};

// Memoised so a change to one row (selection, inline edit) only re-renders that
// row, not the whole list — important at large page sizes where each row mounts
// several Radix selects.
const MobileLeadCard = React.memo(function MobileLeadCard({
  lead, isSelected, isAdmin, users, onOpen, onPrefetch, onToggleSelect, onInlinePatch, onInlineUpdate, onDelete,
}: LeadRowProps) {
  const id = lead.id as string;
  const temp = lead.temperature as string;
  const leadStatus = lead.status as string;
  const active = lead.activeStatus as string;
  return (
    <Card
      className={`overflow-hidden gap-0 py-0 cursor-pointer transition-all duration-150 hover:bg-muted/30 active:bg-muted/50 ${isSelected ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20' : ''}`}
      onMouseEnter={() => onPrefetch(id)}
      onClick={() => onOpen(id)}
    >
      <CardContent className="p-4">
        {/* Row 1: checkbox + name + temp + delete */}
        <div className="flex items-start gap-2">
          <div className="pt-1 shrink-0" onClick={e => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(id)}
              className="size-5 border-2 border-muted-foreground/50 transition-all duration-150 data-[state=checked]:border-primary data-[state=checked]:scale-105"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight truncate">
              {(lead.customerName as string) || 'Unnamed lead'}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">
                {(lead.contactNumber as string) || '—'}
                {(lead.city as string) && (
                  <span className="before:mx-1.5 before:content-['·']">{lead.city as string}</span>
                )}
              </span>
              {(lead.contactNumber as string) && (
                <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                  <ContactButtons
                    phone={lead.contactNumber as string}
                    customerName={lead.customerName as string}
                    size="sm"
                  />
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="mt-0.5" onClick={e => e.stopPropagation()}>
                <Select
                  value={((lead.assignedUser as Record<string, string> | null)?.id) || '__none__'}
                  onValueChange={v => onInlineUpdate(id, 'assignedTo', v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="h-6 w-auto border-0 bg-transparent p-0 text-xs text-muted-foreground focus:ring-0 gap-1">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isAdmin && (lead.assignedUser as Record<string, string> | null)?.name && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {(lead.assignedUser as Record<string, string>).name}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {temp && (
              <span className={`rounded-md border px-1.5 py-0.5 text-xs font-medium ${TEMP_COLOR[temp] ?? ''}`}>
                {TEMP_EMOJI[temp]} {temp.charAt(0) + temp.slice(1).toLowerCase()}
              </span>
            )}
            {isAdmin && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(id); }}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Delete lead"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: property + source */}
        {((lead.propertyType as string) || (lead.platform as string)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {(lead.propertyType as string) && (
              <span className="text-xs text-muted-foreground">{lead.propertyType as string}</span>
            )}
            {(lead.platform as string) && (
              <Badge variant="outline" className="text-xs">{lead.platform as string}</Badge>
            )}
          </div>
        )}

        {/* Remarks */}
        {(lead.initialNotes as string) && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground italic">
            {lead.initialNotes as string}
          </p>
        )}

        {/* Row 3: inline status selects + nav arrow */}
        <div className="mt-3 flex items-center gap-2">
          <div
            className="flex flex-1 flex-wrap items-center gap-2"
            onClick={e => e.stopPropagation()}
          >
            <LeadStatusCell
              status={leadStatus || ''}
              followUpDate={(lead.followUpDate as string) || null}
              followUpHasTime={!!lead.followUpHasTime}
              onPatch={data => onInlinePatch(id, data)}
              triggerClassName="h-7 w-auto min-w-[110px] border-dashed text-xs"
            />
            <Select
              value={active || ''}
              onValueChange={v => onInlineUpdate(id, 'activeStatus', v)}
            >
              <SelectTrigger className="h-7 w-auto min-w-[90px] border-dashed text-xs">
                <SelectValue placeholder="Active..." />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
});

const DesktopLeadRow = React.memo(function DesktopLeadRow({
  lead, isSelected, isAdmin, users, onOpen, onPrefetch, onToggleSelect, onInlinePatch, onInlineUpdate, onDelete,
}: LeadRowProps) {
  const id = lead.id as string;
  return (
    <TableRow
      className={`cursor-pointer transition-colors duration-150 hover:bg-muted/50 ${isSelected ? 'bg-primary/10 hover:bg-primary/15' : ''}`}
      onMouseEnter={() => onPrefetch(id)}
      onClick={() => onOpen(id)}
    >
      <TableCell onClick={e => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(id)}
          className="size-[18px] border-2 border-muted-foreground/50 transition-all duration-150 data-[state=checked]:border-primary data-[state=checked]:scale-105"
        />
      </TableCell>
      <TableCell className="font-medium truncate max-w-0">{(lead.customerName as string) || '—'}</TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-0.5">
          <span className="text-sm text-muted-foreground whitespace-nowrap mr-1">{(lead.contactNumber as string) || '—'}</span>
          {(lead.contactNumber as string) && (
            <ContactButtons
              phone={lead.contactNumber as string}
              customerName={lead.customerName as string}
              size="sm"
            />
          )}
        </div>
      </TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        {isAdmin ? (
          <Select
            value={((lead.assignedUser as Record<string, string> | null)?.id) || '__none__'}
            onValueChange={v => onInlineUpdate(id, 'assignedTo', v === '__none__' ? '' : v)}
          >
            <SelectTrigger className="h-7 w-full border-0 bg-muted/60 pl-2 pr-1 py-0 text-xs focus:ring-0 shadow-none">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">
            {(lead.assignedUser as Record<string, string> | null)?.name ?? '—'}
          </span>
        )}
      </TableCell>

      <TableCell onClick={e => e.stopPropagation()}>
        <LeadStatusCell
          status={(lead.status as string) || ''}
          followUpDate={(lead.followUpDate as string) || null}
          followUpHasTime={!!lead.followUpHasTime}
          onPatch={data => onInlinePatch(id, data)}
          triggerClassName="h-7 min-w-0 flex-1 border-0 bg-muted/60 pl-2 pr-1 py-0 text-xs focus:ring-0 shadow-none"
        />
      </TableCell>

      <TableCell onClick={e => e.stopPropagation()}>
        <Select
          value={(lead.temperature as string) || ''}
          onValueChange={v => onInlineUpdate(id, 'temperature', v)}
        >
          <SelectTrigger className="h-7 w-full border-0 bg-muted/60 pl-2 pr-1 py-0 text-xs focus:ring-0 shadow-none">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HOT">🔥 Hot</SelectItem>
            <SelectItem value="WARM">🌡️ Warm</SelectItem>
            <SelectItem value="COLD">❄️ Cold</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell className="text-muted-foreground truncate max-w-0">{(lead.city as string) || '—'}</TableCell>
      <TableCell className="text-muted-foreground truncate max-w-0">{(lead.propertyType as string) || '—'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {(lead.leadSource as string) && (
            <span className="text-sm text-muted-foreground truncate">{lead.leadSource as string}</span>
          )}
          {(lead.platform as string) && (
            <Badge variant="outline" className="text-xs shrink-0">
              {lead.platform as string}
            </Badge>
          )}
        </div>
      </TableCell>

      <TableCell className="max-w-0 truncate text-sm text-muted-foreground" title={(lead.initialNotes as string) || ''}>
        {(lead.initialNotes as string) || '—'}
      </TableCell>

      <TableCell className="text-muted-foreground text-xs">{formatDateTime(lead.createdAt as string)}</TableCell>

      <TableCell onClick={e => e.stopPropagation()}>
        <Select
          value={(lead.activeStatus as string) || ''}
          onValueChange={v => onInlineUpdate(id, 'activeStatus', v)}
        >
          <SelectTrigger className="h-7 w-full border-0 bg-muted/60 pl-2 pr-1 py-0 text-xs focus:ring-0 shadow-none">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {ACTIVE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell onClick={e => e.stopPropagation()} className="text-right">
        {isAdmin && (
          <button
            onClick={() => onDelete(id)}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete lead"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </TableCell>
    </TableRow>
  );
});

export function LeadsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const authUser = useAuth();
  const prefetchLead = usePrefetchLead();
  const queryClient = useQueryClient();
  const isAdmin = authUser?.role === 'ADMIN';
  // Initialise all filters/page from the URL so state survives navigating into a
  // lead and pressing back (the browser restores the query string).
  // `searchInput` drives the text field immediately; `search` is the debounced
  // value that actually triggers the query + URL sync, so typing doesn't fire a
  // request (and reset the page) on every keystroke.
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [temperature, setTemperature] = useState(() => searchParams.get('temp') ?? '');
  const [activeStatus, setActiveStatus] = useState(() => searchParams.get('active') ?? '');
  const [assigneeFilter, setAssigneeFilter] = useState(() => searchParams.get('assignee') ?? '');
  const [platformFilter, setPlatformFilter] = useState(() => searchParams.get('platform') ?? '');
  const [sourceFilter, setSourceFilter] = useState(() => searchParams.get('source') ?? '');
  const [dateFilter, setDateFilter] = useState(() => searchParams.get('date') ?? '');
  const [followUpFilter, setFollowUpFilter] = useState(() => searchParams.get('followup') ?? '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newLead, setNewLead] = useState({
    customerName: '',
    contactNumber: '',
    city: '',
    propertyType: 'Banquet Hall',
    budgetRange: '',
    temperature: 'WARM',
    platform: 'Meta Ads',
  });
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1));
  const [pageSize, setPageSize] = useState(() => {
    const fromUrl = Number(searchParams.get('pageSize'));
    return PAGE_SIZE_OPTIONS.includes(fromUrl) ? fromUrl : 25;
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    const currentIds = leads.map((l: Record<string, unknown>) => l.id as string);
    const allSelected = currentIds.every((id: string) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentIds.forEach((id: string) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentIds.forEach((id: string) => next.add(id));
        return next;
      });
    }
  };

  const handleBulkUpdate = async (data: Record<string, string | null>) => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), data }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      toast.success(`Updated ${json.data.count} lead(s).`);
      setSelectedIds(new Set());
      void refetch();
    } catch {
      toast.error('Bulk update failed.');
    } finally {
      setBulkUpdating(false);
    }
  };

  // Debounce the search box into `search` so we issue at most one request after
  // the user pauses typing, instead of one per keystroke.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  // Reset to page 1 only when the filters/page-size genuinely CHANGE — compared
  // by value, not by render count. (A render-count guard is unreliable because
  // React Strict Mode double-invokes effects in dev, which would wrongly reset
  // the page restored from the URL on back-navigation.)
  const filterSig = JSON.stringify([search, status, temperature, activeStatus, assigneeFilter, platformFilter, sourceFilter, dateFilter, followUpFilter, pageSize]);
  const filterSigRef = useRef(filterSig);
  useEffect(() => {
    if (filterSigRef.current !== filterSig) {
      filterSigRef.current = filterSig;
      setPage(1);
    }
  }, [filterSig]);

  // Mirror filters + page into the URL query string so the state is preserved
  // when the user opens a lead and navigates back. Uses the native History API
  // (which Next integrates with useSearchParams) instead of router.replace() so
  // changing page/filters does NOT trigger a server round-trip / RSC refetch —
  // that round-trip was the main source of pagination lag.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search)          params.set('q', search);
    if (status)          params.set('status', status);
    if (temperature)     params.set('temp', temperature);
    if (activeStatus)    params.set('active', activeStatus);
    if (assigneeFilter)  params.set('assignee', assigneeFilter);
    if (platformFilter)  params.set('platform', platformFilter);
    if (sourceFilter)    params.set('source', sourceFilter);
    if (dateFilter)      params.set('date', dateFilter);
    if (followUpFilter)  params.set('followup', followUpFilter);
    if (page > 1)        params.set('page', String(page));
    if (pageSize !== 25) params.set('pageSize', String(pageSize));
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
  }, [search, status, temperature, activeStatus, assigneeFilter, platformFilter, sourceFilter, dateFilter, followUpFilter, page, pageSize, pathname]);

  const { data: usersData } = useUsersQuery();
  const users = useMemo(() => (usersData ?? []) as { id: string; name: string }[], [usersData]);

  const { data: metaData } = useLeadsMetaQuery();
  const platforms = metaData?.platforms ?? [];
  const sources   = metaData?.sources   ?? [];

  const queryParams = useMemo(() => ({
    search:      search      || undefined,
    status:      status      || undefined,
    temperature: temperature || undefined,
    activeStatus: activeStatus || undefined,
    assignedTo:  assigneeFilter || undefined,
    platform:    platformFilter || undefined,
    leadSource:  sourceFilter   || undefined,
    dateCreated: dateFilter     || undefined,
    followUp:    followUpFilter || undefined,
    page,
    pageSize,
  }), [search, status, temperature, activeStatus, assigneeFilter, platformFilter, sourceFilter, dateFilter, followUpFilter, page, pageSize]);

  const { data, isLoading, isError, refetch } = useLeadsQuery(queryParams);

  const leads      = data?.data      ?? [];
  const pagination = data?.pagination;

  // Warm the cache for the neighbouring pages so Prev/Next render instantly from
  // cache instead of waiting on a fresh request each click.
  useEffect(() => {
    const totalPages = pagination?.totalPages ?? 1;
    for (const target of [page + 1, page - 1]) {
      if (target < 1 || target > totalPages || target === page) continue;
      const params = { ...queryParams, page: target };
      void queryClient.prefetchQuery({
        queryKey: leadQueryKeys.list(params),
        queryFn: () => fetchLeads(params),
        staleTime: 1000 * 30,
      });
    }
  }, [queryParams, page, pagination?.totalPages, queryClient]);

  const totalActiveFilters = [temperature, status, activeStatus, assigneeFilter, platformFilter, sourceFilter, dateFilter, followUpFilter].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchInput(''); setSearch(''); setStatus(''); setTemperature(''); setActiveStatus('');
    setAssigneeFilter(''); setPlatformFilter(''); setSourceFilter(''); setDateFilter(''); setFollowUpFilter('');
  };

  const fetchAllForExport = async () => {
    const { fetchLeads } = await import('@/services/leads.service');
    const result = await fetchLeads({
      search: search || undefined, status: status || undefined,
      temperature: temperature || undefined, activeStatus: activeStatus || undefined,
      assignedTo: assigneeFilter || undefined, platform: platformFilter || undefined,
      leadSource: sourceFilter || undefined, dateCreated: dateFilter || undefined,
      followUp: followUpFilter || undefined, all: true,
    });
    return (result.data as Record<string, unknown>[]).map(lead => ({
      Name: (lead.customerName as string) || '',
      Phone: (lead.contactNumber as string) || '',
      'Alternate Contact': (lead.alternateContact as string) || '',
      Email: (lead.email as string) || '',
      City: (lead.city as string) || '',
      State: (lead.state as string) || '',
      Platform: (lead.platform as string) || '',
      Source: (lead.leadSource as string) || '',
      Status: (lead.status as string) || '',
      Temperature: (lead.temperature as string) || '',
      'Active Status': (lead.activeStatus as string) || '',
      'Property Type': (lead.propertyType as string) || '',
      'Budget Range': (lead.budgetRange as string) || '',
      Requirement: (lead.requirement as string) || '',
      Remarks: (lead.initialNotes as string) || '',
      Assignee: ((lead.assignedUser as Record<string, string> | null)?.name) || '',
      'Follow-up Date': (lead.followUpDate as string) ? new Date(lead.followUpDate as string).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      'Created At': (lead.createdAt as string) ? new Date(lead.createdAt as string).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
    }));
  };

  const downloadCSV = async () => {
    const rows = await fetchAllForExport();
    if (!rows.length) { toast.error('No leads to export.'); return; }
    const hdrs = Object.keys(rows[0]);
    const csvContent = [
      hdrs.join(','),
      ...rows.map(row => hdrs.map(h => `"${String((row as Record<string, string>)[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} leads as CSV.`);
  };

  const downloadExcel = async () => {
    const rows = await fetchAllForExport();
    if (!rows.length) { toast.error('No leads to export.'); return; }
    const { utils, writeFile } = await import('xlsx');
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Leads');
    ws['!cols'] = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as Record<string, string>)[key] ?? '').length)) + 2,
    }));
    writeFile(wb, `leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${rows.length} leads as Excel.`);
  };

  const createLead = useCreateLead();

  const handleAddLead = async () => {
    if (!newLead.customerName || !newLead.contactNumber) return;
    await createLead.mutateAsync({
      ...newLead,
      leadCreatedDate: new Date().toISOString(),
    });
    setShowAddModal(false);
    setNewLead({
      customerName: '',
      contactNumber: '',
      city: '',
      propertyType: 'Banquet Hall',
      budgetRange: '',
      temperature: 'WARM',
      platform: 'Meta Ads',
    });
  };

  const handleDeleteLead = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Lead deleted.');
      setDeleteId(null);
      void refetch();
    } catch {
      toast.error('Failed to delete lead.');
    } finally {
      setDeleting(false);
    }
  };

  const handleInlinePatch = useCallback(async (id: string, data: Record<string, unknown>) => {
    // Optimistically patch the row in every cached leads list so the dropdown/
    // chip updates instantly instead of waiting on the network + a full refetch.
    const snapshots = queryClient.getQueriesData<LeadsResponse>({ queryKey: ['leads', 'list'] });
    queryClient.setQueriesData<LeadsResponse>({ queryKey: ['leads', 'list'] }, (old) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((l) => ((l as { id?: string }).id === id ? { ...l, ...data } : l)) };
    });

    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Update failed');
      // Reconcile server-derived fields (e.g. assignee name) in the background.
      void queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
    } catch {
      // Roll back the optimistic change and tell the user.
      for (const [key, value] of snapshots) queryClient.setQueryData(key, value);
      toast.error('Could not update the lead. Please try again.');
    }
  }, [queryClient]);

  const handleInlineUpdate = useCallback((id: string, field: string, value: string) =>
    handleInlinePatch(id, { [field]: value }), [handleInlinePatch]);

  // Stable handlers passed to the memoised rows so toggling one row (selection,
  // inline edit) doesn't re-render every other row.
  const prefetchLeadRef = useRef(prefetchLead);
  prefetchLeadRef.current = prefetchLead;
  // On hover warm BOTH the lead data (React Query) and the detail route itself
  // (its RSC payload + JS chunk). Rows navigate via router.push(), which — unlike
  // <Link> — doesn't prefetch the route, so without this the click still
  // round-trips for the route even when the data is already cached.
  const onPrefetch = useCallback((id: string) => {
    prefetchLeadRef.current(id);
    router.prefetch(`/admin/leads/${id}`);
  }, [router]);
  const onOpen = useCallback((id: string) => router.push(`/admin/leads/${id}`), [router]);

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage and track your leads</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-1 sm:flex-none">
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadCSV}>
                  Download as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadExcel}>
                  Download as Excel (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isAdmin && (
            <Button onClick={() => setShowAddModal(true)} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" /> Add Lead
            </Button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            className="pl-9"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        {/* All filters — single scrollable row */}
        <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <Select value={temperature || 'ALL'} onValueChange={v => setTemperature(v === 'ALL' ? '' : v)}>
            <SelectTrigger className={`h-9 w-[120px] shrink-0${temperature ? 'border-primary/50 text-primary' : ''}`}>
              <SelectValue placeholder="All Temps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Temps</SelectItem>
              <SelectItem value="HOT">🔥 Hot</SelectItem>
              <SelectItem value="WARM">🌡️ Warm</SelectItem>
              <SelectItem value="COLD">❄️ Cold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status || 'ALL'} onValueChange={v => setStatus(v === 'ALL' ? '' : v)}>
            <SelectTrigger className={`h-9 w-[130px] shrink-0${status ? 'border-primary/50 text-primary' : ''}`}>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={activeStatus || 'ALL'} onValueChange={v => setActiveStatus(v === 'ALL' ? '' : v)}>
            <SelectTrigger className={`h-9 w-[120px] shrink-0${activeStatus ? 'border-primary/50 text-primary' : ''}`}>
              <SelectValue placeholder="All Active" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Active</SelectItem>
              {ACTIVE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={assigneeFilter || 'ALL'} onValueChange={v => setAssigneeFilter(v === 'ALL' ? '' : v)}>
              <SelectTrigger className={`h-9 w-[135px] shrink-0${assigneeFilter ? 'border-primary/50 text-primary' : ''}`}>
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Assignees</SelectItem>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={platformFilter || 'ALL'} onValueChange={v => setPlatformFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger className={`h-9 w-[135px] shrink-0${platformFilter ? 'border-primary/50 text-primary' : ''}`}>
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Platforms</SelectItem>
              {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceFilter || 'ALL'} onValueChange={v => setSourceFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger className={`h-9 w-[130px] shrink-0${sourceFilter ? 'border-primary/50 text-primary' : ''}`}>
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sources</SelectItem>
              {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateCreatedFilter value={dateFilter} onChange={setDateFilter} />
          <Select value={followUpFilter || 'ALL'} onValueChange={v => setFollowUpFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger className={`h-9 w-[135px] shrink-0${followUpFilter ? 'border-primary/50 text-primary' : ''}`}>
              <SelectValue placeholder="Follow-up" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Any Follow-up</SelectItem>
              <SelectItem value="overdue">⚠️ Overdue</SelectItem>
              <SelectItem value="today">📅 Due today</SelectItem>
              <SelectItem value="week">📆 Due this week</SelectItem>
              <SelectItem value="no_date">— No date set</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filter chips */}
        {totalActiveFilters > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Active:</span>
            {temperature && <FilterChip label={`Temp: ${temperature}`} onRemove={() => setTemperature('')} />}
            {status && <FilterChip label={`Status: ${STATUS_OPTIONS.find(o => o.value === status)?.label ?? status}`} onRemove={() => setStatus('')} />}
            {activeStatus && <FilterChip label={`Active: ${ACTIVE_OPTIONS.find(o => o.value === activeStatus)?.label ?? activeStatus}`} onRemove={() => setActiveStatus('')} />}
            {assigneeFilter && <FilterChip label={`Assignee: ${assigneeFilter === 'UNASSIGNED' ? 'Unassigned' : (users.find(u => u.id === assigneeFilter)?.name ?? assigneeFilter)}`} onRemove={() => setAssigneeFilter('')} />}
            {platformFilter && <FilterChip label={`Platform: ${platformFilter}`} onRemove={() => setPlatformFilter('')} />}
            {sourceFilter && <FilterChip label={`Source: ${sourceFilter}`} onRemove={() => setSourceFilter('')} />}
            {dateFilter && <FilterChip label={`Created: ${dateCreatedLabel(dateFilter)}`} onRemove={() => setDateFilter('')} />}
            {followUpFilter && <FilterChip label={`Follow-up: ${followUpFilter === 'overdue' ? 'Overdue' : followUpFilter === 'today' ? 'Today' : followUpFilter === 'week' ? 'This week' : 'No date'}`} onRemove={() => setFollowUpFilter('')} />}
            <button onClick={clearAllFilters} className="ml-1 text-xs text-muted-foreground underline hover:text-foreground">Clear all</button>
          </div>
        )}
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        {isLoading ? 'Loading...' : pagination ? `${pagination.total} lead${pagination.total !== 1 ? 's' : ''} found` : ''}
      </p>

      {/* ── Bulk Action Bar ── */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 animate-in slide-in-from-top-2 fade-in duration-200 rounded-lg border border-primary/30 bg-primary/5 backdrop-blur-sm p-3 shadow-lg shadow-primary/5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 border-r border-primary/20 pr-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15">
                <CheckSquare className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold tabular-nums">{selectedIds.size} selected</span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select onValueChange={v => void handleBulkUpdate({ status: v })} disabled={bulkUpdating}>
                <SelectTrigger className="h-8 w-[140px] border-muted-foreground/25 bg-background/50 text-xs">
                  <SelectValue placeholder="Change Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select onValueChange={v => void handleBulkUpdate({ temperature: v })} disabled={bulkUpdating}>
                <SelectTrigger className="h-8 w-[130px] border-muted-foreground/25 bg-background/50 text-xs">
                  <SelectValue placeholder="Change Temp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOT">🔥 Hot</SelectItem>
                  <SelectItem value="WARM">🌡️ Warm</SelectItem>
                  <SelectItem value="COLD">❄️ Cold</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={v => void handleBulkUpdate({ activeStatus: v })} disabled={bulkUpdating}>
                <SelectTrigger className="h-8 w-[135px] border-muted-foreground/25 bg-background/50 text-xs">
                  <SelectValue placeholder="Active Status" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Select onValueChange={v => void handleBulkUpdate({ assignedTo: v === '__none__' ? null : v })} disabled={bulkUpdating}>
                  <SelectTrigger className="h-8 w-[140px] border-muted-foreground/25 bg-background/50 text-xs">
                    <SelectValue placeholder="Assign To" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {bulkUpdating && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Updating...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <LeadsTableSkeleton />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-red-500">
          Failed to load leads.{' '}
          <button className="underline" onClick={() => refetch()}>Try again</button>
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No leads found. Add your first lead!
        </div>
      ) : (
        <>
          {/* ── Mobile card list (hidden md+) ── */}
          <div className="md:hidden space-y-2">
            {leads.map((lead: Record<string, unknown>) => (
              <MobileLeadCard
                key={lead.id as string}
                lead={lead}
                isSelected={selectedIds.has(lead.id as string)}
                isAdmin={isAdmin}
                users={users}
                onOpen={onOpen}
                onPrefetch={onPrefetch}
                onToggleSelect={toggleSelect}
                onInlinePatch={handleInlinePatch}
                onInlineUpdate={handleInlineUpdate}
                onDelete={setDeleteId}
              />
            ))}
          </div>

          {/* ── Desktop table (hidden below md) ── */}
          <Card className="hidden md:block py-0 gap-0 overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="table-fixed min-w-[1440px] [&_th:first-child]:pl-6 [&_td:first-child]:pl-6 [&_th:last-child]:pr-6 [&_td:last-child]:pr-6 [&_th]:h-9">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[48px]">
                        <Checkbox
                          checked={leads.length > 0 && leads.every((l: Record<string, unknown>) => selectedIds.has(l.id as string))}
                          onCheckedChange={toggleSelectAll}
                          className="size-[18px] border-2 border-muted-foreground/50 data-[state=checked]:border-primary"
                        />
                      </TableHead>
                      <TableHead className="w-[180px]">Customer</TableHead>
                      <TableHead className="w-[170px]">Phone</TableHead>
                      <TableHead className="w-[130px]">Assignee</TableHead>
                      <TableHead className="w-[200px]">Status</TableHead>
                      <TableHead className="w-[90px]">Temp</TableHead>
                      <TableHead className="w-[110px]">City</TableHead>
                      <TableHead className="w-[130px]">Property</TableHead>
                      <TableHead className="w-[180px]">Source</TableHead>
                      <TableHead className="w-[200px]">Remarks</TableHead>
                      <TableHead className="w-[150px]">Created</TableHead>
                      <TableHead className="w-[110px]">Active</TableHead>
                      <TableHead className="w-[48px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead: Record<string, unknown>) => (
                      <DesktopLeadRow
                        key={lead.id as string}
                        lead={lead}
                        isSelected={selectedIds.has(lead.id as string)}
                        isAdmin={isAdmin}
                        users={users}
                        onOpen={onOpen}
                        onPrefetch={onPrefetch}
                        onToggleSelect={toggleSelect}
                        onInlinePatch={handleInlinePatch}
                        onInlineUpdate={handleInlineUpdate}
                        onDelete={setDeleteId}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Pagination ── */}
      {pagination && (
        <div className="flex flex-col items-center gap-3 py-2 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total > 0
              ? `Showing ${((pagination.page - 1) * pagination.pageSize) + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total} leads`
              : `${pagination.total} leads`}
          </p>
          <div className="flex items-center gap-2">
            {/* Rows per page */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
              <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[80px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Page nav — only shown when there's more than 1 page */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={pagination.page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Prev</span>
                </Button>
                {getPageNums(pagination.page, pagination.totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === pagination.page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(p as number)}
                      className="h-8 w-8 p-0"
                    >
                      {p}
                    </Button>
                  )
                )}
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={pagination.page === pagination.totalPages}>
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete confirm dialog ── */}
      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this lead? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteLead} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add lead dialog ── */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={newLead.customerName} onChange={e => setNewLead(p => ({ ...p, customerName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input value={newLead.contactNumber} onChange={e => setNewLead(p => ({ ...p, contactNumber: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={newLead.city} onChange={e => setNewLead(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Budget Range</Label>
              <Input value={newLead.budgetRange} onChange={e => setNewLead(p => ({ ...p, budgetRange: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Property Type</Label>
              <Select value={newLead.propertyType} onValueChange={v => setNewLead(p => ({ ...p, propertyType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Banquet Hall', 'Resort / Farmhouse', 'Residential', 'Hotel', 'Other'].map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Temperature</Label>
              <Select value={newLead.temperature} onValueChange={v => setNewLead(p => ({ ...p, temperature: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOT">🔥 Hot</SelectItem>
                  <SelectItem value="WARM">🌡️ Warm</SelectItem>
                  <SelectItem value="COLD">❄️ Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddLead} disabled={createLead.isPending}>
              {createLead.isPending ? 'Saving...' : 'Save Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
