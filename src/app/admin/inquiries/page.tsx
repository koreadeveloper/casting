import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { listInquiries } from '@/lib/admin-inquiries';
import AdminShell from '../admin-shell';
import InquiriesClient from './inquiries-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '문의 처리함 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

export default async function AdminInquiriesPage() {
  await requireAdmin('/admin/inquiries');
  const inquiries = await listInquiries();
  return (
    <AdminShell current="inquiries">
      <InquiriesClient inquiries={inquiries} loadedAt={new Date().toISOString()} />
    </AdminShell>
  );
}
