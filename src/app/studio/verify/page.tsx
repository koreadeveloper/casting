import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { aiConfigured } from '@/lib/verification-ai';
import { getMyVerifications } from '@/lib/verifications';
import VerifyClient from './verify-client';

export const dynamic = 'force-dynamic';

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/studio/verify');
  if (user.role !== 'producer') redirect('/me');
  const mine = await getMyVerifications(user.id);
  return (
    <VerifyClient
      accountName={user.name}
      orgName={user.orgName}
      ready={aiConfigured()}
      school={mine.school}
      business={mine.business}
    />
  );
}
