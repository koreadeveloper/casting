'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** 새로 들어온 가입·문의가 바로 보이도록 목록을 다시 읽는 간격 */
export const REFRESH_MS = 30_000;

/**
 * 화면을 보고 있으면 REFRESH_MS마다, 다른 탭에 있다 돌아오면 바로 서버에서 목록을 다시 읽는다.
 * paused가 참이면(확인창이 열려 있거나 입력 중일 때) 건너뛴다.
 */
export function useAutoRefresh(paused: boolean) {
  const router = useRouter();
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    const refresh = () => {
      if (!pausedRef.current && document.visibilityState === 'visible') router.refresh();
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);
  return router;
}
