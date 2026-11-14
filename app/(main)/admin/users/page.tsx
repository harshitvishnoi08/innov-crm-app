import { UsersOverview } from '@/components/users/UsersOverview';
import { Metadata } from 'next';
import { requireAdminPage } from '@/lib/page-auth';

export const metadata: Metadata = {
  title: 'Users',
  description: 'Manage platform users',
};

export default async function UsersPage() {
  await requireAdminPage();
  return <UsersOverview />;
}
