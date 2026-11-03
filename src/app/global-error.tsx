'use client';

import { useEffect, type CSSProperties } from 'react';

/**
 * 맨 바깥 레이아웃까지 실패했을 때의 마지막 화면. 이때는 전역 스타일이 들어오지 않으므로
 * 모양을 이 파일 안에 직접 넣는다(색은 globals.css의 브랜드 색과 같다).
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={styles.body}>
        <title>잠시 문제가 생겼어요 · 캐스팅플로우</title>
        <main style={styles.card} role="alert">
          <h1 style={styles.title}>잠시 문제가 생겼어요</h1>
          <p style={styles.text}>일시적인 문제일 수 있어요. 잠시 뒤에 다시 시도해 주세요.</p>
          <button type="button" style={styles.primary} onClick={() => retry()}>
            다시 시도
          </button>
          {/* 레이아웃이 망가진 상태라 Link 대신 새로 불러오는 링크를 쓴다 */}
          <a href="/" style={styles.link}>
            첫 화면으로
          </a>
        </main>
      </body>
    </html>
  );
}

const styles = {
  body: {
    margin: 0,
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    boxSizing: 'border-box',
    background: '#e9edf5',
    color: '#0b0d12',
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, 'Noto Sans KR', sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: 420,
    boxSizing: 'border-box',
    background: '#fff',
    border: '1px solid #dde2ec',
    borderRadius: 26,
    padding: '28px 22px',
    textAlign: 'center',
    display: 'grid',
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: 800, letterSpacing: -0.8, margin: 0 },
  text: { fontSize: 13, lineHeight: 1.6, color: '#6b7384', margin: '0 0 12px' },
  primary: {
    border: 0,
    borderRadius: 14,
    padding: '15px 18px',
    fontSize: 14,
    fontWeight: 700,
    background: '#0b0d12',
    color: '#c5ff45',
    cursor: 'pointer',
  },
  link: { fontSize: 13, color: '#6b7384', padding: 8 },
} satisfies Record<string, CSSProperties>;
