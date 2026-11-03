import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import DeleteAccountForm from './delete-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '회원 탈퇴 · 캐스팅플로우' };

export default async function DeleteAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account/delete');
  return (
    <DeleteAccountForm
      role={user.role}
      demo={user.email.endsWith('@demo.casting')}
      back={user.role === 'actor' ? '/me/profile' : '/studio'}
    />
  );
}
