import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';
import { Metadata } from 'next';
import { requireAdminPage } from '@/lib/page-auth';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Meta ads lead analytics',
};

export default async function AnalyticsPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6 p-4 md:p-6">
      <AnalyticsOverview />
    </div>
  );
}
