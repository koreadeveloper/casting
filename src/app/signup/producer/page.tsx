import { redirect } from 'next/navigation';
import SignupEntry from '@/components/signup-entry';
import { getSession, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** 제작자 가입. ?method=email 이면 이메일 가입 양식(메일 발송 설정이 있을 때만). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ method?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  return <SignupEntry role="producer" method={(await searchParams).method ?? ''} />;
}
