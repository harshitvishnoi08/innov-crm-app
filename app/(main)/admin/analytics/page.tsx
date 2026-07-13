import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Meta ads lead analytics',
};

export default async function AnalyticsPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <AnalyticsOverview />
    </div>
  );
}
