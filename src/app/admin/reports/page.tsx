import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { listReports } from '@/lib/reports';
import AdminShell from '../admin-shell';
import ReportsClient from './reports-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '신고 처리함 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

export default async function AdminReportsPage() {
  await requireAdmin('/admin/reports');
  const reports = await listReports();
  return (
    <AdminShell current="reports">
      <ReportsClient reports={reports} loadedAt={new Date().toISOString()} />
    </AdminShell>
  );
}
