import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { openPayload } from '@/lib/oauth';
import { resetStillUsable } from '@/lib/password-reset';
import { RECOVERY_COOKIE } from '@/lib/password-reset-rules';
import ResetForm from './reset-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '새 비밀번호 · 캐스팅플로우' };

/** 재설정 링크(/auth/confirm)를 거쳐 복구 쿠키가 있을 때만 열린다. 직접 들어오면 비밀번호 찾기로 보낸다. */
export default async function ResetPasswordPage() {
  const recovery = openPayload<{ h: string }>(
    (await cookies()).get(RECOVERY_COOKIE)?.value,
    process.env.SESSION_SECRET || '',
  );
  if (!recovery?.h) redirect('/forgot-password');
  if (!(await resetStillUsable(recovery.h))) redirect('/forgot-password?error=expired');
  return <ResetForm />;
}
