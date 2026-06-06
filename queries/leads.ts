import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLeads,
  fetchLead,
  fetchLeadsMeta,
  createLead,
  updateLead,
  addComment,
  scheduleMeeting,
  updateMeeting,
  deleteMeeting,
} from '@/services/leads.service';

export const leadQueryKeys = {
  all: ['leads'],
  list: (params?: object) => ['leads', 'list', params],
  detail: (id: string) => ['leads', 'detail', id],
  meta: ['leads', 'meta'],
};

export type LeadPagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LeadsResponse = {
  data: Record<string, unknown>[];
  pagination: LeadPagination;
};

export function useLeadsQuery(params?: {
  search?: string;
  status?: string;
  temperature?: string;
  activeStatus?: string;
  assignedTo?: string;
  platform?: string;
  leadSource?: string;
  dateCreated?: string;
  followUp?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery<LeadsResponse>({
    queryKey: leadQueryKeys.list(params),
    queryFn: () => fetchLeads(params),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

export function useLeadsMetaQuery() {
  return useQuery<{ platforms: string[]; sources: string[] }>({
    queryKey: leadQueryKeys.meta,
    queryFn: fetchLeadsMeta,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

export function useLeadQuery(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: leadQueryKeys.detail(id),
    queryFn: () => fetchLead(id),
    enabled: !!id,
    staleTime: 1000 * 30,
    // Seed from any cached leads list so the header/info fields render instantly
    // instead of a full-page skeleton; the fresh fetch (comments, meetings,
    // activities, team) then fills in the rest.
    placeholderData: () => {
      const lists = queryClient.getQueriesData<LeadsResponse>({
        queryKey: ['leads', 'list'],
      });
      for (const [, list] of lists) {
        const found = list?.data?.find((l) => (l as { id?: string }).id === id);
        if (found) return found;
      }
      return undefined;
    },
  });
}

/**
 * Returns a function that warms the detail cache for a lead — call it on row
 * hover so the lead is already loading (or loaded) by the time the user clicks.
 * Reuses the same staleTime, so it won't refetch a lead opened seconds ago.
 */
export function usePrefetchLead() {
  const queryClient = useQueryClient();
  return (id: string) => {
    if (!id) return;
    void queryClient.prefetchQuery({
      queryKey: leadQueryKeys.detail(id),
      queryFn: () => fetchLead(id),
      staleTime: 1000 * 30,
    });
  };
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createLead(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadQueryKeys.all });
    },
  });
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => updateLead(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: leadQueryKeys.detail(id) });
    },
  });
}

export function useAddComment(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, type }: { content: string; type?: string }) =>
      addComment(leadId, content, type),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadQueryKeys.detail(leadId) });
    },
  });
}

export function useScheduleMeeting(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { agenda: string; meetingDate: string }) =>
      scheduleMeeting({ leadId, ...data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadQueryKeys.detail(leadId) });
    },
  });
}

export function useUpdateMeeting(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; agenda: string; meetingDate: string }) =>
      updateMeeting(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadQueryKeys.detail(leadId) });
    },
  });
}

export function useDeleteMeeting(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string }) => deleteMeeting(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadQueryKeys.detail(leadId) });
    },
  });
}
