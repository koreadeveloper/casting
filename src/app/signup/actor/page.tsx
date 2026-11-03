import { redirect } from 'next/navigation';
import SignupEntry from '@/components/signup-entry';
import { getSession, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  return <SignupEntry role="actor" />;
}
