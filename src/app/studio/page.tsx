import { redirect } from 'next/navigation';
import { isAdminAccount } from '@/lib/admin-rules';
import { getCurrentUser } from '@/lib/auth';
import Studio from './studio';

export const dynamic = 'force-dynamic';

const TABS = ['home', 'applicants', 'messages', 'profile'] as const;

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/studio');
  if (user.role !== 'producer') redirect('/me');
  const { tab } = await searchParams;
  const initialTab = TABS.find((item) => item === tab) ?? 'home';
  return (
    <Studio
      initialTab={initialTab}
      userName={user.name}
      orgName={user.orgName || user.orgType}
      email={user.email}
      admin={isAdminAccount(user)}
    />
  );
}
