import type { Metadata } from 'next';
import ResetForm from './reset-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '비밀번호 찾기 · 캐스팅플로우',
  // 주소에 담긴 재설정 토큰이 다른 사이트로 넘어가지 않게 한다.
  referrer: 'no-referrer',
};

/**
 * 비밀번호 찾기.
 * - 주소에 token이 없으면: 이메일을 받아 재설정 링크를 보낸다.
 * - 메일의 링크(/reset?token=…)로 들어오면: 새 비밀번호를 정한다.
 */
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const safe = typeof token === 'string' && /^[\w-]{20,100}$/.test(token) ? token : '';
  return <ResetForm token={safe} />;
}
