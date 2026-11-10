'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Brand } from '@/components/brand';
import type { Member } from '@/lib/admin';
import {
  LOGIN_METHODS,
  METHOD_LABEL,
  matchesMember,
  type LoginMethod,
  type MemberFilter,
} from '@/lib/admin-rules';

type Pending =
  | { kind: 'suspend' | 'unsuspend'; member: Member }
  | { kind: 'unlink'; member: Member; provider: LoginMethod }
  | { kind: 'delete'; member: Member };

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function day(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : dateFormat.format(date).replace(/\s/g, '').replace(/\.$/, '');
}

const ROLE_LABEL = { producer: '제작진', actor: '배우' } as const;

export default function MembersClient({
  members,
  adminId,
}: {
  members: Member[];
  adminId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<MemberFilter>({
    query: '',
    method: '',
    role: '',
    status: '',
  });
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const shown = useMemo(
    () => members.filter((member) => matchesMember(member, filter)),
    [members, filter],
  );
  const counts = useMemo(() => {
    const byMethod = Object.fromEntries(
      LOGIN_METHODS.map((method) => [
        method,
        members.filter((member) => member.methods.includes(method)).length,
      ]),
    ) as Record<LoginMethod, number>;
    return {
      all: members.length,
      byMethod,
      none: members.filter((member) => !member.methods.length).length,
      suspended: members.filter((member) => member.suspendedAt).length,
    };
  }, [members]);

  const set = (patch: Partial<MemberFilter>) => setFilter((current) => ({ ...current, ...patch }));

  function open(next: Pending) {
    setPending(next);
    setConfirmEmail('');
    setError('');
  }

  async function run() {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      const url = `/api/admin/members/${encodeURIComponent(pending.member.id)}`;
      const response = await fetch(url, {
        method: pending.kind === 'delete' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          pending.kind === 'delete'
            ? { confirmEmail }
            : pending.kind === 'unlink'
              ? { action: 'unlink', provider: pending.provider }
              : { action: pending.kind },
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '처리하지 못했어요. 다시 시도해 주세요.');
      setToast(
        pending.kind === 'delete'
          ? `${pending.member.email} 계정을 삭제했어요.`
          : pending.kind === 'unlink'
            ? `${METHOD_LABEL[pending.provider]} 연결을 해제했어요.`
            : pending.kind === 'suspend'
              ? `${pending.member.email} 계정을 정지했어요.`
              : `${pending.member.email} 계정의 정지를 풀었어요.`,
      );
      setTimeout(() => setToast(''), 3000);
      setPending(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-page">
      <header className="auth-top">
        <Brand />
        <a href="/studio" className="text-button">
          스튜디오로
        </a>
      </header>
      <section className="admin-body">
        <h1 className="page-title">회원 관리</h1>
        <p className="muted admin-lead">
          이메일로 가입한 회원과 Google·Kakao로 가입한 회원을 함께 봐요. 가입 방식은 지금 로그인할
          수 있는 방법이에요(이메일 = 비밀번호가 있는 계정).
        </p>

        <div className="admin-stats">
          <span className="count-pill">전체 {counts.all}명</span>
          {LOGIN_METHODS.map((method) => (
            <span key={method} className="count-pill">
              {METHOD_LABEL[method]} {counts.byMethod[method]}
            </span>
          ))}
          {counts.suspended > 0 && (
            <span className="count-pill admin-pill-warn">정지 {counts.suspended}</span>
          )}
        </div>

        <div className="admin-tools">
          <label className="search-box">
            <span aria-hidden>⌕</span>
            <input
              type="search"
              placeholder="이메일·이름·연락처·소속으로 찾기"
              value={filter.query}
              onChange={(event) => set({ query: event.target.value })}
            />
          </label>
          <div className="chip-pick" role="group" aria-label="가입 방식">
            {(['', ...LOGIN_METHODS, 'none'] as MemberFilter['method'][]).map((method) => (
              <button
                key={method || 'all'}
                type="button"
                className={filter.method === method ? 'on' : ''}
                aria-pressed={filter.method === method}
                onClick={() => set({ method })}
              >
                {method === ''
                  ? '전체'
                  : method === 'none'
                    ? `로그인 수단 없음 ${counts.none}`
                    : METHOD_LABEL[method]}
              </button>
            ))}
          </div>
          <div className="admin-selects">
            <select
              className="sort-select"
              value={filter.role}
              onChange={(event) => set({ role: event.target.value as MemberFilter['role'] })}
              aria-label="역할"
            >
              <option value="">모든 역할</option>
              <option value="producer">제작진</option>
              <option value="actor">배우</option>
            </select>
            <select
              className="sort-select"
              value={filter.status}
              onChange={(event) => set({ status: event.target.value as MemberFilter['status'] })}
              aria-label="상태"
            >
              <option value="">모든 상태</option>
              <option value="active">정상</option>
              <option value="suspended">정지</option>
            </select>
            <span className="small-note">{shown.length}명 표시</span>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="empty-card">조건에 맞는 회원이 없어요.</div>
        ) : (
          <ul className="admin-list">
            {shown.map((member) => {
              const locked = member.id === adminId || member.admin;
              return (
                <li key={member.id} className={member.suspendedAt ? 'admin-row off' : 'admin-row'}>
                  <div className="admin-main">
                    <div className="admin-name">
                      <strong>{member.name || '(이름 없음)'}</strong>
                      <span className="status-chip">{ROLE_LABEL[member.role]}</span>
                      {member.admin && <span className="status-chip chip-new">관리자</span>}
                      {member.demo && <span className="status-chip">체험</span>}
                      {member.suspendedAt && (
                        <span className="status-chip admin-chip-off">
                          정지 {day(member.suspendedAt)}
                        </span>
                      )}
                    </div>
                    <div className="admin-email">{member.email}</div>
                    <div className="admin-methods">
                      {member.hasPassword && <span className="admin-method m-email">이메일</span>}
                      {member.socials.map((social) => (
                        <span
                          key={social.provider}
                          className={`admin-method m-${social.provider}`}
                          title={
                            social.email && social.email !== member.email
                              ? `연결된 계정: ${social.email}`
                              : `연결: ${day(social.createdAt)}`
                          }
                        >
                          {METHOD_LABEL[social.provider as LoginMethod] ?? social.provider}
                          {!locked &&
                            (social.provider === 'google' || social.provider === 'kakao') && (
                              <button
                                type="button"
                                aria-label={`${METHOD_LABEL[social.provider]} 연결 해제`}
                                onClick={() =>
                                  open({
                                    kind: 'unlink',
                                    member,
                                    provider: social.provider as LoginMethod,
                                  })
                                }
                              >
                                ×
                              </button>
                            )}
                        </span>
                      ))}
                      {!member.methods.length && (
                        <span className="admin-method m-none">로그인 수단 없음</span>
                      )}
                    </div>
                    <div className="admin-meta">
                      <span>가입 {day(member.createdAt)}</span>
                      <span>{member.emailVerified ? '메일 확인됨' : '메일 미확인'}</span>
                      {member.role === 'producer' && (
                        <span>
                          {member.badges.length ? member.badges.join(' / ') : '제작진 인증 없음'}
                        </span>
                      )}
                      {member.orgName && <span>{member.orgName}</span>}
                      {member.phone && <span>{member.phone}</span>}
                    </div>
                  </div>
                  {!locked && (
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() =>
                          open({ kind: member.suspendedAt ? 'unsuspend' : 'suspend', member })
                        }
                      >
                        {member.suspendedAt ? '정지 해제' : '정지'}
                      </button>
                      {!member.demo && (
                        <button
                          type="button"
                          className="button button-danger"
                          onClick={() => open({ kind: 'delete', member })}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
            <p>{confirmTitle(pending)}</p>
            <div className="small-note">{confirmDetail(pending)}</div>
            {pending.kind === 'delete' && (
              <label className="admin-confirm-input">
                <span className="small-note">
                  확인을 위해 <strong>{pending.member.email}</strong>을 그대로 입력해 주세요.
                </span>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  placeholder={pending.member.email}
                  autoComplete="off"
                  autoFocus
                />
              </label>
            )}
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
                  pending.kind === 'unsuspend' ? 'button button-primary' : 'button button-danger'
                }
                disabled={
                  busy ||
                  (pending.kind === 'delete' &&
                    confirmEmail.trim().toLowerCase() !== pending.member.email.toLowerCase())
                }
                onClick={run}
              >
                {busy ? '처리 중…' : confirmLabel(pending)}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function confirmTitle(pending: Pending) {
  const who = pending.member.name || pending.member.email;
  switch (pending.kind) {
    case 'suspend':
      return `${who} 계정을 정지할까요?`;
    case 'unsuspend':
      return `${who} 계정의 정지를 풀까요?`;
    case 'unlink':
      return `${who} 계정의 ${METHOD_LABEL[pending.provider]} 연결을 해제할까요?`;
    case 'delete':
      return `${who} 계정을 삭제할까요?`;
  }
}

function confirmDetail(pending: Pending) {
  switch (pending.kind) {
    case 'suspend':
      return '정지하면 바로 로그아웃되고, 풀어 줄 때까지 이메일·소셜 로그인 모두 막혀요. 자료는 그대로 남아요.';
    case 'unsuspend':
      return '다시 로그인할 수 있게 돼요. 정지 전에 로그인해 있던 기기는 새로 로그인해야 해요.';
    case 'unlink': {
      const last = pending.member.methods.length === 1;
      return last
        ? '이 연결이 유일한 로그인 수단이에요. 해제하면 비밀번호가 없어서 이 방법으로는 로그인할 수 없어요. 다만 같은 메일이 확인된 계정으로 다시 소셜 로그인하면 자동으로 다시 연결돼요.'
        : '해제해도 다른 방법으로는 계속 로그인할 수 있어요. 같은 소셜 계정으로 다시 로그인하면 메일이 같을 때 다시 연결돼요.';
    }
    case 'delete':
      return pending.member.role === 'producer'
        ? '계정과 만든 프로젝트·공고, 들어온 지원서와 대화·첨부 파일, 팀 보드 기록이 모두 지워지고 되돌릴 수 없어요.'
        : '계정과 배우 프로필·사진·자료, 낸 지원서와 대화·첨부 파일, 받은 제안이 모두 지워지고 되돌릴 수 없어요.';
  }
}

function confirmLabel(pending: Pending) {
  return { suspend: '정지', unsuspend: '정지 해제', unlink: '연결 해제', delete: '삭제' }[
    pending.kind
  ];
}
