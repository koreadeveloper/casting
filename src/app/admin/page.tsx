import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { dashboardStats } from '@/lib/admin-stats';
import AdminShell from './admin-shell';
import DashboardView from './dashboard-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '관리자 대시보드 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

// 관리자 첫 화면: 회원·공고·지원·문의 숫자와 최근 가입 추이
export default async function AdminDashboardPage() {
  await requireAdmin('/admin');
  const stats = await dashboardStats();
  return (
    <AdminShell current="dashboard">
      <DashboardView stats={stats} />
    </AdminShell>
  );
}
