import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { passwordLoginEnabled } from '@/lib/password';
import { RESET_EXPIRED_MESSAGE } from '@/lib/password-reset-rules';
import ForgotForm from './forgot-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '비밀번호 찾기 · 캐스팅플로우' };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // 메일 발송 설정이 없으면 재설정 링크를 보낼 수 없어서 로그인 화면으로 돌려보낸다.
  if (!passwordLoginEnabled()) redirect('/login');
  const { error } = await searchParams;
  return <ForgotForm notice={error === 'expired' ? RESET_EXPIRED_MESSAGE : ''} />;
}
