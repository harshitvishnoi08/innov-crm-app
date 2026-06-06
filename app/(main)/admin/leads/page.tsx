import { Metadata } from 'next';
import { Suspense } from 'react';
import { LeadsTable } from '@/components/leads/LeadsTable';

export const metadata: Metadata = {
  title: 'Leads',
  description: 'Manage your leads',
};

export default function LeadsPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Suspense fallback={null}>
        <LeadsTable />
      </Suspense>
    </div>
  );
}