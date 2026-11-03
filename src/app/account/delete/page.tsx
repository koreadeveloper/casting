import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserWithHash } from '@/lib/accounts';
import { getCurrentUser } from '@/lib/auth';
import { hasPassword } from '@/lib/password';
import DeleteAccountForm from './delete-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '회원 탈퇴 · 캐스팅플로우' };

export default async function DeleteAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account/delete');
  const found = await getUserWithHash(user.email);
  return (
    <DeleteAccountForm
      role={user.role}
      demo={user.email.endsWith('@demo.casting')}
      email={user.email}
      passwordless={!found || !hasPassword(found.passwordHash)}
      back={user.role === 'actor' ? '/me/profile' : '/studio'}
    />
  );
}
