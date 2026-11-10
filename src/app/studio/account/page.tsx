import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyVerifications } from '@/lib/verifications';
import AccountClient from './account-client';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/studio/account');
  if (user.role !== 'producer') redirect('/me/profile');
  const { school } = await getMyVerifications(user.id);
  return (
    <AccountClient
      initial={{ name: user.name, orgType: user.orgType, orgName: user.orgName }}
      email={user.email}
      schoolByDocument={school.approved?.method === 'document'}
    />
  );
}
