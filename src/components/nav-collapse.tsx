'use client';

import { useEffect, useState } from 'react';

/** 넓은 화면에서 왼쪽 메뉴를 접고 펴는 단추. 고른 상태는 이 브라우저에 기억한다. */
export const NAV_KEY = 'cf-nav';

/** 첫 화면이 그려지기 전에 접힘 상태를 적용하는 짧은 스크립트(깜빡임 방지). */
export const NAV_BOOT_SCRIPT = `try{if(localStorage.getItem('${NAV_KEY}')==='collapsed')document.documentElement.dataset.nav='collapsed'}catch(e){}`;

export default function NavCollapse() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.nav === 'collapsed');
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    if (next) document.documentElement.dataset.nav = 'collapsed';
    else delete document.documentElement.dataset.nav;
    try {
      if (next) localStorage.setItem(NAV_KEY, 'collapsed');
      else localStorage.removeItem(NAV_KEY);
    } catch {
      // 저장이 막힌 브라우저에서는 이번 화면에서만 적용한다.
    }
  }

  return (
    <button
      type="button"
      className="nav-collapse"
      onClick={toggle}
      aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
      aria-expanded={!collapsed}
      title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path d="M9.5 4.5v15" />
        <path
          d={collapsed ? 'm13.5 10 2 2-2 2' : 'm16 10-2 2 2 2'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
