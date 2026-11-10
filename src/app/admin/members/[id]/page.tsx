import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { memberDetail, requireAdmin } from '@/lib/admin';
import { listAdminLogs } from '@/lib/admin-log';
import AdminShell from '../../admin-shell';
import MemberView from './member-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원 상세 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin(`/admin/members/${id}`);
  const detail = await memberDetail(id);
  if (!detail) notFound();
  const logs = await listAdminLogs({ targetId: id, limit: 50 });
  return (
    <AdminShell current="members">
      <MemberView detail={detail} logs={logs} adminId={admin.id} />
    </AdminShell>
  );
}
