import { redirect } from 'next/navigation';
import SignupEntry from '@/components/signup-entry';
import { getSession, homeFor } from '@/lib/auth';
import { safeThen } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

/** 배우 가입. ?then=/apply/… 로 오면 가입·로그인을 마친 뒤 그 화면(보던 지원 화면)으로 돌아간다. */
export default async function Page({ searchParams }: { searchParams: Promise<{ then?: string }> }) {
  const then = safeThen((await searchParams).then);
  const session = await getSession();
  if (session) redirect(session.role === 'actor' && then ? then : homeFor(session.role));
  return <SignupEntry role="actor" then={then} />;
}
