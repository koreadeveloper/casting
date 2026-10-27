'use client';

import Link from 'next/link';
import { BrandLogo } from './brand';

// 지원자 화면은 프로젝트 아래 화면이라 메뉴에 따로 두지 않는다(프로젝트 카드의 [지원자 검토하기]로 들어간다).
export type ProducerSection =
  | 'home'
  | 'messages'
  | 'profile'
  | 'actors'
  | 'new-project'
  | 'recommend'
  | 'compare'
  | 'board'
  | 'calendar';

const stroke = {
  width: 21,
  height: 21,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  'aria-hidden': true,
} as const;

const icons: Record<ProducerSection, React.ReactNode> = {
  home: (
    <svg {...stroke}>
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  actors: (
    <svg {...stroke}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" strokeLinecap="round" />
    </svg>
  ),
  messages: (
    <svg {...stroke}>
      <path d="M21 12a8 8 0 0 1-8 8H4l1.5-3A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
    </svg>
  ),
  'new-project': (
    <svg {...stroke}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" strokeLinecap="round" />
    </svg>
  ),
  recommend: (
    <svg {...stroke}>
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  compare: (
    <svg {...stroke}>
      <rect x="3" y="6" width="8" height="12" rx="2" />
      <rect x="13" y="6" width="8" height="12" rx="2" />
    </svg>
  ),
  board: (
    <svg {...stroke}>
      <rect x="3.5" y="4.5" width="5" height="15" rx="1.6" />
      <rect x="9.7" y="4.5" width="5" height="10" rx="1.6" />
      <rect x="15.9" y="4.5" width="5" height="7" rx="1.6" />
    </svg>
  ),
  calendar: (
    <svg {...stroke}>
      <rect x="4" y="5.5" width="16" height="15" rx="3" />
      <path d="M8 3.5v4M16 3.5v4M4 10.5h16" strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg {...stroke}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.8 3.7-6 7-6s6.2 2.2 7 6" strokeLinecap="round" />
    </svg>
  ),
};

const items: { key: ProducerSection; label: string; href: string; mobile: boolean }[] = [
  { key: 'home', label: '프로젝트', href: '/studio', mobile: true },
  { key: 'actors', label: '배우 찾기', href: '/studio/actors', mobile: true },
  { key: 'messages', label: '메시지', href: '/studio?tab=messages', mobile: true },
  { key: 'recommend', label: '배우 추천', href: '/studio/recommend', mobile: false },
  { key: 'compare', label: '이상형 월드컵', href: '/studio/compare', mobile: false },
  { key: 'board', label: '팀 보드', href: '/studio/board', mobile: false },
  { key: 'calendar', label: '캘린더', href: '/studio/calendar', mobile: false },
  { key: 'new-project', label: '프로젝트 등록', href: '/studio/projects/new', mobile: false },
  { key: 'profile', label: '내 정보', href: '/studio?tab=profile', mobile: true },
];

type StudioTab = 'home' | 'messages' | 'profile';

export default function ProducerNav({
  active,
  onTab,
  badge,
}: {
  active: ProducerSection;
  onTab?: (tab: StudioTab) => void;
  badge?: Partial<Record<ProducerSection, boolean>>;
}) {
  return (
    <nav className="pnav" aria-label="제작자 메뉴">
      <div className="pnav-brand">
        <Link href="/" className="pnav-brand-link" aria-label="Casting Flow 첫 화면으로">
          <BrandLogo />
        </Link>
      </div>
      {items.map((item) => {
        const content = (
          <>
            <span className="nav-ic">
              {icons[item.key]}
              {badge?.[item.key] && <span className="nav-dot" />}
            </span>
            {item.label}
          </>
        );
        const className = `${active === item.key ? 'active' : ''}${item.mobile ? '' : ' desk-only'}`;
        const isTab = ['home', 'messages', 'profile'].includes(item.key);
        return onTab && isTab ? (
          <button key={item.key} className={className} onClick={() => onTab(item.key as StudioTab)}>
            {content}
          </button>
        ) : (
          <Link key={item.key} href={item.href} className={className}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
