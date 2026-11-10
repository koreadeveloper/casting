import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { listBusinessVerifications } from '@/lib/admin-verifications';
import AdminShell from '../admin-shell';
import VerificationsClient from './verifications-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '인증 확인 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

export default async function AdminVerificationsPage() {
  await requireAdmin('/admin/verifications');
  const items = await listBusinessVerifications();
  return (
    <AdminShell current="verifications">
      <VerificationsClient items={items} loadedAt={new Date().toISOString()} />
    </AdminShell>
  );
}
