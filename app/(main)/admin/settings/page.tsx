import { Metadata } from 'next';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { requireAdminPage } from '@/lib/page-auth';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'CRM Settings',
};

export default async function Settings() {
  await requireAdminPage();
  return (
    <div className="space-y-6 p-4 md:p-6">
      <SettingsPage />
    </div>
  );
}