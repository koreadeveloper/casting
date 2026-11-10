'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/back-button';
import ProducerNav from '@/components/producer-nav';
import { ORG_TYPES, nameChanged, type AccountEdit } from '@/lib/account-edit';

/** 제작자 계정 정보(이름·소속) 고치기 */
export default function AccountClient({
  initial,
  email,
  schoolByDocument,
}: {
  initial: AccountEdit;
  email: string;
  /** 재학증명서로 받은 학교 인증이 있으면, 이름을 바꿀 때 다시 받아야 한다고 알린다 */
  schoolByDocument: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const set = (key: keyof AccountEdit) => (event: { target: { value: string } }) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setDone('');
  };
  const willRevoke = schoolByDocument && nameChanged(initial.name, form.name);
  // 목록에 없는 예전 소속 유형도 고르기 칸에 보이게 한다.
  const types =
    initial.orgType && !ORG_TYPES.includes(initial.orgType)
      ? [initial.orgType, ...ORG_TYPES]
      : ORG_TYPES;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      willRevoke &&
      !window.confirm('이름을 바꾸면 재학증명서로 받은 학교 인증이 해제돼요. 바꿀까요?')
    )
      return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '저장하지 못했어요.');
      setDone(
        data.schoolRevoked
          ? '저장했어요. 학교 인증은 새 이름으로 다시 받아 주세요.'
          : '저장했어요.',
      );
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell wide">
      <ProducerNav active="profile" />
      <div className="screen-pad page-top verify-page">
        <BackButton fallback="/studio?tab=profile" label="뒤로" />
        <h1 className="page-title">계정 정보</h1>
        <p className="muted verify-lead">
          이름과 소속은 공고에 제작자 정보로 보여요. 소셜 로그인으로 가입했다면 닉네임이 이름으로
          들어가 있을 수 있어요.
        </p>
        <form className="verify-card verify-biz" onSubmit={submit}>
          <label>
            이메일
            <input value={email} disabled />
          </label>
          <label>
            이름
            <input
              value={form.name}
              onChange={set('name')}
              maxLength={60}
              autoComplete="name"
              required
            />
          </label>
          {willRevoke && (
            <p className="small-note">
              재학증명서 인증은 서류의 이름과 계정 이름을 맞춰 본 것이라, 이름을 바꾸면 다시 받아야
              해요.
            </p>
          )}
          <label>
            소속 유형
            <select value={form.orgType} onChange={set('orgType')} required>
              <option value="">선택해 주세요</option>
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            소속명
            <input
              value={form.orgName}
              onChange={set('orgName')}
              maxLength={100}
              placeholder="예: 봄날 필름, 한빛대 영화과"
            />
          </label>
          <button className="button button-primary" disabled={busy}>
            {busy ? '저장하는 중…' : '저장하기'}
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p className="verify-status ok" role="status">
              {done}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
