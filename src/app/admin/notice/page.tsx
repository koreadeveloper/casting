import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { getNotice } from '@/lib/site-notice';
import AdminShell from '../admin-shell';
import NoticeClient from './notice-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '공지 띠 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

export default async function AdminNoticePage() {
  await requireAdmin('/admin/notice');
  return (
    <AdminShell current="notice">
      <NoticeClient initial={await getNotice()} />
    </AdminShell>
  );
}
