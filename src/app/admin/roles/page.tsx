import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { listAllRoles } from '@/lib/admin-roles';
import AdminShell from '../admin-shell';
import RolesClient from './roles-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '공고 관리 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

export default async function AdminRolesPage() {
  await requireAdmin('/admin/roles');
  const roles = await listAllRoles();
  return (
    <AdminShell current="roles">
      <RolesClient
        roles={roles}
        today={new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)}
      />
    </AdminShell>
  );
}
