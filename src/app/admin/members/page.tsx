import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAdmin, listMembers } from '@/lib/admin';
import MembersClient from './members-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원 관리 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

// 관리자 회원 관리. 관리자(ADMIN_EMAILS에 있는, 메일이 확인된 계정)가 아니면 이 화면이 없는 것처럼 404를 낸다.
export default async function AdminMembersPage() {
  if (!(await getCurrentUser())) redirect('/login?next=/admin/members');
  const admin = await getAdmin();
  if (!admin) notFound();
  const members = await listMembers();
  return <MembersClient members={members} adminId={admin.id} loadedAt={new Date().toISOString()} />;
}
