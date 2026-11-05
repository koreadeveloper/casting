'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

// 이 탭에서 앱 안 화면 이동이 있었는지 센다. 새로 고치면 0부터 다시 센다.
let navigations = 0;
let lastPath: string | null = null;

/** 루트 레이아웃에 한 번만 둔다. 화면을 그리지 않고 경로 변화만 센다. */
export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (lastPath !== null && lastPath !== pathname) navigations += 1;
    lastPath = pathname;
  }, [pathname]);
  return null;
}

/**
 * 하위 화면 상단의 '‹' 버튼.
 * 앱 안에서 이동해 왔으면 진짜 뒤로 가고, 링크로 바로 들어왔으면 상위 화면(fallback)으로 간다.
 * 홈 화면에 설치한 앱(iPhone)은 브라우저 뒤로 버튼이 없어서 이 버튼이 뒤로가기 역할을 한다.
 */
export default function BackButton({ fallback, label }: { fallback: string; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="back-link"
      onClick={() => {
        if (navigations > 0) router.back();
        else router.push(fallback);
      }}
    >
      {label}
    </button>
  );
}
