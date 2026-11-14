import { redirect } from 'next/navigation';
import { requireAuthWithRole } from '@/lib/api-auth';

/**
 * Server-component guard for admin-only pages (Analytics, Users, Settings).
 * Non-admins (the sales team, role USER) are sent back to the dashboard so a
 * typed-in URL can't reach a page hidden from their sidebar.
 */
export async function requireAdminPage() {
  const { user, role } = await requireAuthWithRole();
  if (!user) redirect('/login');
  if (role !== 'ADMIN') redirect('/admin/dashboard');
}
