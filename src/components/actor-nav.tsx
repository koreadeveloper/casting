'use client';

import Link from 'next/link';
import { BrandLogo } from './brand';
import NavCollapse from './nav-collapse';
import { confirmLogout } from '@/lib/logout';

const stroke = {
  width: 21,
  height: 21,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  'aria-hidden': true,
} as const;

export default function ActorNav({
  active,
  actorId,
}: {
  active: 'home' | 'chat' | 'profile' | 'preview';
  actorId: string;
}) {
  return (
    <nav className="pnav" aria-label="배우 메뉴">
      <div className="pnav-brand">
        <BrandLogo />
        <NavCollapse />
      </div>
      <Link href="/me" className={active === 'home' ? 'active' : ''}>
        <span className="nav-ic">
          <svg {...stroke}>
            <path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="nav-label">홈</span>
      </Link>
      <Link href="/me/chat" className={active === 'chat' ? 'active' : ''}>
        <span className="nav-ic">
          <svg {...stroke}>
            <path
              d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 4v-4h0.5A2.5 2.5 0 0 1 4 13.5v-7Z"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="nav-label">채팅</span>
      </Link>
      <Link href="/me/profile" className={active === 'profile' ? 'active' : ''}>
        <span className="nav-ic">
          <svg {...stroke}>
            <circle cx="12" cy="8" r="3.6" />
            <path d="M5 20c.8-3.8 3.7-6 7-6s6.2 2.2 7 6" strokeLinecap="round" />
          </svg>
        </span>
        <span className="nav-label">프로필 관리</span>
      </Link>
      <Link href={`/actors/${actorId}`} className={active === 'preview' ? 'active' : ''}>
        <span className="nav-ic">
          <svg {...stroke}>
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="2.8" />
          </svg>
        </span>
        <span className="nav-label">미리보기</span>
      </Link>
      {/* 휴대폰 하단바에서는 실수로 누르기 쉬워 빼고(프로필 관리 아래 '계정'에 있음), 넓은 화면 사이드바에만 둔다. */}
      <button className="desk-only" onClick={() => void confirmLogout()}>
        <span className="nav-ic">
          <svg {...stroke}>
            <path
              d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l-4 4 4 4M6 12h10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="nav-label">로그아웃</span>
      </button>
    </nav>
  );
}
