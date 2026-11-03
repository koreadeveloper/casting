import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { isInquiryKind } from '@/lib/inquiry';
import ContactForm from './contact-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '문의하기 · 캐스팅플로우' };

/** ?type=report&link=/apply/... 처럼 들어오면 종류와 관련 링크를 미리 채운다. */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const link = typeof params.link === 'string' && params.link.startsWith('/') ? params.link : '';
  return (
    <ContactForm
      initialKind={isInquiryKind(params.type) ? params.type : 'general'}
      initialEmail={user?.email.endsWith('@demo.casting') ? '' : (user?.email ?? '')}
      initialLink={link.slice(0, 300)}
    />
  );
}
