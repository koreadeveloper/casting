'use client';

import Link from 'next/link';
import { useState } from 'react';
import BackButton from '@/components/back-button';
import { Brand } from '@/components/brand';
import { PRIVACY_PATH } from '@/lib/legal';

/** 회원 탈퇴. 지워지는 내용을 보여 주고, 확인 체크와 비밀번호를 받은 뒤 DELETE /api/me를 부른다. */
export default function DeleteAccountForm({
  role,
  demo,
  back,
}: {
  role: 'producer' | 'actor';
  demo: boolean;
  back: string;
}) {
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '탈퇴하지 못했어요. 다시 시도해 주세요.');
      location.href = '/';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '탈퇴하지 못했어요.');
      setBusy(false);
    }
  }

  const removed =
    role === 'actor'
      ? [
          '계정과 배우 프로필',
          '올린 프로필 사진과 PDF 자료',
          '지금까지 낸 지원서와 제작진과 주고받은 메시지·첨부 파일',
          '받은 캐스팅 제안과 촬영 참석 응답',
        ]
      : [
          '계정과 제작진 인증 결과',
          '내가 만든 프로젝트·공고와 거기에 들어온 지원서 전부',
          '지원자와 주고받은 메시지·첨부 파일, 오디션 일정',
          '팀 보드의 후보·메모·투표, 저장한 비교 결과와 관심 배우',
        ];

  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
      </header>
      <section className="auth-card">
        <BackButton fallback={back} label="뒤로" />
        <h1>회원 탈퇴</h1>
        <p className="muted">탈퇴하면 아래 내용이 바로 삭제되고, 되돌릴 수 없어요.</p>
        <ul className="delete-list">
          {removed.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {role === 'producer' && (
          <p className="small-note">
            함께 쓰던 프로젝트라도 내가 만든 프로젝트면 팀원 화면에서도 사라져요. 남겨야 할 자료가
            있으면 먼저 정리해 주세요.
          </p>
        )}
        {demo ? (
          <p className="form-error" role="alert">
            체험 계정은 탈퇴할 수 없어요.
          </p>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label>
              비밀번호 확인
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={agree}
                onChange={(event) => setAgree(event.target.checked)}
              />
              <span>위 내용이 모두 삭제되는 것을 확인했어요</span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-danger full" disabled={busy || !agree || !password}>
              {busy ? '탈퇴 처리 중…' : '탈퇴하기'}
            </button>
            <Link className="button button-outline full" href={back}>
              취소
            </Link>
          </form>
        )}
        <p className="small-note center">
          개인정보 처리에 대한 자세한 내용은 <Link href={PRIVACY_PATH}>개인정보처리방침</Link>을
          확인해 주세요.
        </p>
      </section>
    </main>
  );
}
