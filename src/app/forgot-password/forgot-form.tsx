'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/brand';

const COOLDOWN = 60;

/** 이메일을 넣으면 재설정 링크를 보낸다. 같은 이메일로 60초 안에 다시 누르지 못하게 버튼을 잠근다. */
export default function ForgotForm({ notice = '' }: { notice?: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice);
  const [sent, setSent] = useState('');
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);
  const left = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (left > 0) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || '요청하지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
      setSent(data.message || '메일을 보냈어요. 메일함을 확인해 주세요.');
      setWaitUntil(Date.now() + COOLDOWN * 1000);
      setNow(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '요청하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
        <Link className="button button-outline sm" href="/login">
          로그인
        </Link>
      </header>
      <section className="auth-card">
        <h1>비밀번호 찾기</h1>
        <p className="muted">
          가입한 이메일을 넣으면 비밀번호를 다시 정할 수 있는 링크를 보내 드려요.
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            이메일
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {sent && (
            <p className="form-ok" role="status">
              {sent}
            </p>
          )}
          <button className="button button-primary full" disabled={busy || left > 0}>
            {busy
              ? '보내는 중…'
              : left > 0
                ? `${left}초 뒤에 다시 보낼 수 있어요`
                : '재설정 링크 받기'}
          </button>
        </form>
        <p className="small-note center">
          메일이 오지 않으면 스팸함도 확인해 주세요. 링크는 30분 동안 한 번만 쓸 수 있어요.
        </p>
        <p className="small-note center">
          <Link href="/login">로그인으로 돌아가기</Link>
        </p>
      </section>
    </main>
  );
}
