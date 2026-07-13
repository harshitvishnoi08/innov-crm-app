import { useQuery } from '@tanstack/react-query';
import { fetchMetaAnalytics } from '@/services/analytics.service';

export const analyticsQueryKeys = {
  meta: (dateRange: string) => ['analytics', 'meta', dateRange],
};

export function useMetaAnalyticsQuery(dateRange: string, options = {}) {
  return useQuery({
    queryKey: analyticsQueryKeys.meta(dateRange),
    queryFn: () => fetchMetaAnalytics(dateRange),
    staleTime: 1000 * 60,
    ...options,
  });
}
