import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { listAdminLogs } from '@/lib/admin-log';
import AdminShell from '../admin-shell';
import LogsView from './logs-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '작업 기록 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

// 관리자 작업 기록: 최근 300건. 지우거나 고칠 수 없다(근거로 남기는 기록이라서).
export default async function AdminLogsPage() {
  await requireAdmin('/admin/logs');
  const logs = await listAdminLogs({ limit: 300 });
  return (
    <AdminShell current="logs">
      <LogsView logs={logs} />
    </AdminShell>
  );
}
