'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Action = { kind: 'role'; role: 'producer' | 'actor' } | { kind: 'suspend' | 'unsuspend' };

const ROLE_LABEL = { producer: '제작진', actor: '배우' } as const;

/** 회원 상세의 작업 단추: 역할 바꾸기·정지. 둘 다 확인창을 거친다. */
export default function MemberActions({
  id,
  name,
  role,
  suspended,
  locked,
}: {
  id: string;
  name: string;
  role: 'producer' | 'actor';
  suspended: boolean;
  /** 본인·다른 관리자면 바꿀 수 없다 */
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const other = role === 'producer' ? 'actor' : 'producer';

  if (locked) return <p className="small-note">본인·관리자 계정은 여기서 바꿀 수 없어요.</p>;

  async function run() {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          pending.kind === 'role'
            ? { action: 'role', role: pending.role }
            : { action: pending.kind },
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '처리하지 못했어요.');
      setPending(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-actions">
        <button
          type="button"
          className="button button-soft"
          onClick={() => {
            setError('');
            setPending({ kind: 'role', role: other });
          }}
        >
          {ROLE_LABEL[other]}로 바꾸기
        </button>
        <button
          type="button"
          className="button button-outline"
          onClick={() => {
            setError('');
            setPending({ kind: suspended ? 'unsuspend' : 'suspend' });
          }}
        >
          {suspended ? '정지 해제' : '정지'}
        </button>
      </div>
      {pending && (
        <div
          className="confirm-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) setPending(null);
          }}
        >
          <div className="confirm-card admin-confirm">
            <p>
              {pending.kind === 'role'
                ? `${name} 계정을 ${ROLE_LABEL[pending.role]}로 바꿀까요?`
                : pending.kind === 'suspend'
                  ? `${name} 계정을 정지할까요?`
                  : `${name} 계정의 정지를 풀까요?`}
            </p>
            <div className="small-note">
              {pending.kind === 'role'
                ? `지금 ${ROLE_LABEL[role]}로 만든 자료(공고·지원서·제안 등)가 없을 때만 바뀌어요. 바꾸면 다시 로그인해야 해요.`
                : pending.kind === 'suspend'
                  ? '정지하면 바로 로그아웃되고, 풀어 줄 때까지 로그인할 수 없어요. 자료는 그대로 남아요.'
                  : '다시 로그인할 수 있게 돼요.'}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="confirm-actions">
              <button
                type="button"
                className="button button-soft"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                취소
              </button>
              <button
                type="button"
                className={
                  pending.kind === 'suspend' ? 'button button-danger' : 'button button-primary'
                }
                disabled={busy}
                onClick={run}
              >
                {busy ? '처리 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
