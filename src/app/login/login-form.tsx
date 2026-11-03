'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Brand } from '@/components/brand';

export default function LoginForm({
  next,
  notice = '',
  social = null,
}: {
  next: string;
  notice?: string;
  social?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '로그인하지 못했습니다.');
      const target =
        next &&
        (data.role === 'producer' ? next.startsWith('/studio') : !next.startsWith('/studio'))
          ? next
          : data.next;
      location.href = target;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '로그인하지 못했습니다.');
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
        <Link className="button button-outline sm" href="/signup">
          회원가입
        </Link>
      </header>
      <section className="auth-card">
        <h1>다시 만나서 반가워요</h1>
        <p className="muted">이메일과 비밀번호로 로그인하세요.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            이메일
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            비밀번호
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary full" disabled={busy}>
            {busy ? '로그인 중…' : '로그인'}
          </button>
        </form>
        {social && (
          <>
            <div className="divider-text">
              <span>또는 간편하게 로그인</span>
            </div>
            {social}
          </>
        )}
        <p className="small-note center">
          아직 계정이 없나요? <Link href="/signup">회원가입</Link>
        </p>
      </section>
    </main>
  );
}
