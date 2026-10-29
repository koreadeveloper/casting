'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/brand';

async function post(url: string, body: object) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
  return data;
}

/** 1단계: 가입한 이메일로 재설정 링크 받기 */
function RequestLink() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [minutes, setMinutes] = useState(30);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await post('/api/auth/reset/request', { email });
      setMinutes(Number(data.minutes) || 30);
      setSentTo(email);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  if (sentTo)
    return (
      <>
        <h1>메일을 확인해 주세요</h1>
        <p className="muted">
          <strong>{sentTo}</strong>(으)로 가입된 계정이 있으면 비밀번호 재설정 링크를 보냈어요.
          링크는 {minutes}분 동안 한 번만 쓸 수 있어요.
        </p>
        <p className="small-note">
          메일이 안 보이면 스팸함도 확인해 주세요. 그래도 없으면 이메일 주소를 다시 확인하고 한 번
          더 요청해 주세요.
        </p>
        <div className="reset-actions">
          <button className="button button-outline full" onClick={() => setSentTo('')}>
            다른 이메일로 다시 보내기
          </button>
          <Link className="button button-primary full" href="/login">
            로그인으로 돌아가기
          </Link>
        </div>
      </>
    );

  return (
    <>
      <h1>비밀번호 찾기</h1>
      <p className="muted">가입한 이메일을 적으면 새 비밀번호를 정할 수 있는 링크를 보내 드려요.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          이메일
          <input
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
        <button className="button button-primary full" disabled={busy || !email.trim()}>
          {busy ? '보내는 중…' : '재설정 링크 받기'}
        </button>
      </form>
      <p className="small-note center">
        비밀번호가 생각났나요? <Link href="/login">로그인</Link>
      </p>
    </>
  );
}

/** 2단계: 메일의 링크로 들어와 새 비밀번호 정하기 */
function SetPassword({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // 토큰이 주소창·방문 기록에 남지 않게 지운다(값은 이미 화면이 들고 있다).
  useEffect(() => {
    window.history.replaceState(null, '', '/reset');
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('두 비밀번호가 서로 달라요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await post('/api/auth/reset/confirm', { token, password });
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <>
        <h1>비밀번호를 바꿨어요</h1>
        <p className="muted">새 비밀번호로 로그인해 주세요.</p>
        <Link className="button button-primary full" href="/login">
          로그인하기
        </Link>
      </>
    );

  return (
    <>
      <h1>새 비밀번호 정하기</h1>
      <p className="muted">영문과 숫자를 섞어 8자 이상으로 정해 주세요.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          새 비밀번호
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          새 비밀번호 확인
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
            {error.includes('만료') && (
              <>
                {' '}
                {/* 같은 주소라 화면을 새로 불러와 처음(링크 받기) 단계로 돌아간다 */}
                <a href="/reset">링크 다시 받기</a>
              </>
            )}
          </p>
        )}
        <button className="button button-primary full" disabled={busy || !password || !confirm}>
          {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
        </button>
      </form>
    </>
  );
}

export default function ResetForm({ token }: { token: string }) {
  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
        <Link className="button button-outline sm" href="/login">
          로그인
        </Link>
      </header>
      <section className="auth-card">
        {token ? <SetPassword token={token} /> : <RequestLink />}
      </section>
    </main>
  );
}
