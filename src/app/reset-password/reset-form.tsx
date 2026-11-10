'use client';

import { useState } from 'react';
import { Brand } from '@/components/brand';

export default function ResetForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.');
    if (password !== confirm) return setError('새 비밀번호와 확인 입력이 서로 달라요.');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.expired) {
        location.href = '/forgot-password?error=expired';
        return;
      }
      if (!response.ok) throw new Error(data.error || '바꾸지 못했어요.');
      location.href = data.next || '/';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '바꾸지 못했어요.');
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
      </header>
      <section className="auth-card">
        <h1>새 비밀번호 정하기</h1>
        <p className="muted">
          8자 이상, 영문과 숫자를 섞어 주세요. 바꾸면 다른 기기에서는 자동으로 로그아웃돼요.
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            새 비밀번호
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            새 비밀번호 확인
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary full" disabled={busy}>
            {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
          </button>
        </form>
      </section>
    </main>
  );
}
