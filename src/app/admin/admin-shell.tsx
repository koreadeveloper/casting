import Link from 'next/link';
import { Brand } from '@/components/brand';
import { countNewInquiries } from '@/lib/admin-inquiries';

export type AdminSection = 'dashboard' | 'members' | 'inquiries' | 'roles' | 'notice' | 'logs';

const TABS: { key: AdminSection; label: string; href: string }[] = [
  { key: 'dashboard', label: '대시보드', href: '/admin' },
  { key: 'members', label: '회원', href: '/admin/members' },
  { key: 'inquiries', label: '문의', href: '/admin/inquiries' },
  { key: 'roles', label: '공고', href: '/admin/roles' },
  { key: 'notice', label: '공지', href: '/admin/notice' },
  { key: 'logs', label: '작업 기록', href: '/admin/logs' },
];

/** 관리자 화면 공통 틀: 머리글과 메뉴. 문의 메뉴에는 아직 손대지 않은 문의 수를 붙인다. */
export default async function AdminShell({
  current,
  children,
}: {
  current: AdminSection;
  children: React.ReactNode;
}) {
  const newInquiries = await countNewInquiries().catch(() => 0);
  return (
    <main className="admin-page">
      <header className="auth-top">
        <Brand />
        <a href="/studio" className="text-button">
          스튜디오로
        </a>
      </header>
      <nav className="admin-tabs" aria-label="관리자 메뉴">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={tab.key === current ? 'on' : ''}
            aria-current={tab.key === current ? 'page' : undefined}
          >
            {tab.label}
            {tab.key === 'inquiries' && newInquiries > 0 && <b>{newInquiries}</b>}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
