'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Brand } from '@/components/brand';

/** 화면을 그리다 오류가 났을 때 (Next 기본 영어 오류 화면 대신). */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  // 서버 오류는 내용 대신 오류 번호(digest)만 온다. 문의할 때 알려 주면 서버 기록과 맞춰 볼 수 있다.
  const digest =
    error instanceof Error && 'digest' in error && typeof error.digest === 'string'
      ? error.digest
      : '';

  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
      </header>
      <section className="auth-card fallback-card" role="alert">
        <h1>잠시 문제가 생겼어요</h1>
        <p className="muted">일시적인 문제일 수 있어요. 다시 시도해 주세요.</p>
        <div className="fallback-actions">
          <button type="button" className="button button-primary full" onClick={() => retry()}>
            다시 시도
          </button>
          <Link className="button button-outline full" href="/">
            첫 화면으로
          </Link>
        </div>
        <p className="small-note">
          계속 같은 화면이 나오면 <Link href="/contact">문의하기</Link>로 알려 주세요.
          {digest && <> (오류 번호 {digest})</>}
        </p>
      </section>
    </main>
  );
}
