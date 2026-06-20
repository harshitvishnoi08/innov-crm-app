import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchQuickTemplates,
  createQuickTemplate,
  updateQuickTemplate,
  deleteQuickTemplate,
  type QuickTemplate,
} from '@/services/whatsapp-templates.service';

export const quickTemplateKeys = {
  all: ['whatsapp-quick-templates'],
};

export function useQuickTemplatesQuery(options = {}) {
  return useQuery<QuickTemplate[]>({
    queryKey: quickTemplateKeys.all,
    queryFn: fetchQuickTemplates,
    staleTime: 1000 * 60, // 1 min — these change rarely
    ...options,
  });
}

export function useCreateQuickTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; body: string; isActive?: boolean }) => createQuickTemplate(payload),
    onSuccess: async () => {
      toast.success('Template created.');
      await queryClient.invalidateQueries({ queryKey: quickTemplateKeys.all });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create template.'),
  });
}

export function useUpdateQuickTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; title?: string; body?: string; isActive?: boolean }) =>
      updateQuickTemplate(id, payload),
    onSuccess: async () => {
      toast.success('Template updated.');
      await queryClient.invalidateQueries({ queryKey: quickTemplateKeys.all });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update template.'),
  });
}

export function useDeleteQuickTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuickTemplate(id),
    onSuccess: async () => {
      toast.success('Template deleted.');
      await queryClient.invalidateQueries({ queryKey: quickTemplateKeys.all });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not delete template.'),
  });
}
