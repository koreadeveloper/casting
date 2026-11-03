import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/lib/auth';
import { SOCIAL_NOTICE, SocialButtons } from '@/components/social-buttons';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '';
  return (
    <LoginForm
      next={safeNext}
      notice={(error && SOCIAL_NOTICE[error]) || ''}
      social={<SocialButtons next={safeNext} />}
    />
  );
}
