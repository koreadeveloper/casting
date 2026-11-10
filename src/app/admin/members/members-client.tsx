'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  | { kind: 'delete'; member: Member }
  | { kind: 'verify'; member: Member }
  | { kind: 'unverify'; member: Member; badge: BadgeKind };

type BadgeKind = 'school' | 'business';
const BADGE_LABEL: Record<BadgeKind, string> = { school: '학교 인증', business: '제작사 인증' };

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

/** 새로 가입한 회원이 바로 보이도록 목록을 다시 읽는 간격 */
const REFRESH_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const timeFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export default function MembersClient({
  members,
  adminId,
  loadedAt,
}: {
  members: Member[];
  adminId: string;
  /** 서버가 목록을 읽은 시각. '새 가입' 표시와 마지막 갱신 시각의 기준 */
  loadedAt: string;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<MemberFilter>({
    query: '',
    method: '',
    role: '',
    status: '',
  });
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  // 제작진 인증 주기 입력: 종류·학교(제작사) 이름·학과
  const [verifyForm, setVerifyForm] = useState({
    kind: 'business' as BadgeKind,
    orgName: '',
    detail: '',
  });
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

  // 확인창이 열려 있거나 화면을 보고 있지 않을 때는 다시 읽지 않는다.
  const paused = useRef(false);
  paused.current = Boolean(pending) || busy;
  useEffect(() => {
    const refresh = () => {
      if (!paused.current && document.visibilityState === 'visible') router.refresh();
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);
  useEffect(() => setRefreshing(false), [loadedAt]);

  const loadedTime = new Date(loadedAt).getTime();
  const isNew = (member: Member) => loadedTime - new Date(member.createdAt).getTime() < DAY_MS;
  const newCount = members.filter(isNew).length;

  const set = (patch: Partial<MemberFilter>) => setFilter((current) => ({ ...current, ...patch }));

  function open(next: Pending) {
    setPending(next);
    setConfirmEmail('');
    setError('');
    if (next.kind === 'verify')
      setVerifyForm({ kind: 'business', orgName: next.member.orgName, detail: '' });
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
              : pending.kind === 'verify'
                ? { action: 'verify', ...verifyForm }
                : pending.kind === 'unverify'
                  ? { action: 'unverify', kind: pending.badge }
                  : { action: pending.kind },
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '처리하지 못했어요. 다시 시도해 주세요.');
      setToast(
        pending.kind === 'verify'
          ? `${pending.member.name || pending.member.email}에게 ${BADGE_LABEL[verifyForm.kind]}을 줬어요.`
          : pending.kind === 'unverify'
            ? `${BADGE_LABEL[pending.badge]}을 취소했어요.`
            : pending.kind === 'delete'
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
          {newCount > 0 && (
            <span className="count-pill admin-pill-new">최근 24시간 가입 {newCount}</span>
          )}
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
            <span className="small-note">
              {shown.length}명 표시 · {timeFormat.format(new Date(loadedAt))} 기준 (30초마다 갱신)
            </span>
            <button
              type="button"
              className="button button-outline admin-refresh"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true);
                router.refresh();
              }}
            >
              {refreshing ? '불러오는 중…' : '새로고침'}
            </button>
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
                      {isNew(member) && <span className="status-chip admin-chip-new">새 가입</span>}
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
                      {member.badges.map((badge) => (
                        <span key={badge.kind} className={`admin-method m-badge-${badge.kind}`}>
                          {badge.label}
                          <button
                            type="button"
                            aria-label={`${BADGE_LABEL[badge.kind]} 취소`}
                            onClick={() => open({ kind: 'unverify', member, badge: badge.kind })}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="admin-meta">
                      <span>가입 {day(member.createdAt)}</span>
                      <span>{member.emailVerified ? '메일 확인됨' : '메일 미확인'}</span>
                      {member.role === 'producer' && !member.badges.length && (
                        <span>제작진 인증 없음</span>
                      )}
                      {member.orgName && <span>{member.orgName}</span>}
                      {member.phone && <span>{member.phone}</span>}
                    </div>
                  </div>
                  {(!locked || member.role === 'producer') && (
                    <div className="admin-actions">
                      {member.role === 'producer' && (
                        <button
                          type="button"
                          className="button button-soft"
                          onClick={() => open({ kind: 'verify', member })}
                        >
                          인증 주기
                        </button>
                      )}
                      {!locked && (
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() =>
                            open({ kind: member.suspendedAt ? 'unsuspend' : 'suspend', member })
                          }
                        >
                          {member.suspendedAt ? '정지 해제' : '정지'}
                        </button>
                      )}
                      {!locked && !member.demo && (
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
            {pending.kind === 'verify' && (
              <div className="admin-confirm-input">
                <div className="chip-pick" role="group" aria-label="인증 종류">
                  {(['business', 'school'] as BadgeKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={verifyForm.kind === kind ? 'on' : ''}
                      aria-pressed={verifyForm.kind === kind}
                      onClick={() => setVerifyForm((form) => ({ ...form, kind }))}
                    >
                      {BADGE_LABEL[kind]}
                    </button>
                  ))}
                </div>
                <input
                  value={verifyForm.orgName}
                  onChange={(event) =>
                    setVerifyForm((form) => ({ ...form, orgName: event.target.value }))
                  }
                  placeholder={
                    verifyForm.kind === 'school' ? '학교 이름 (예: 세종대학교)' : '제작사 이름'
                  }
                  maxLength={100}
                  autoFocus
                />
                {verifyForm.kind === 'school' && (
                  <input
                    value={verifyForm.detail}
                    onChange={(event) =>
                      setVerifyForm((form) => ({ ...form, detail: event.target.value }))
                    }
                    placeholder="학과 (선택)"
                    maxLength={100}
                  />
                )}
              </div>
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
                  pending.kind === 'unsuspend' || pending.kind === 'verify'
                    ? 'button button-primary'
                    : 'button button-danger'
                }
                disabled={
                  busy ||
                  (pending.kind === 'delete' &&
                    confirmEmail.trim().toLowerCase() !== pending.member.email.toLowerCase()) ||
                  (pending.kind === 'verify' && !verifyForm.orgName.trim())
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
    case 'verify':
      return `${who}에게 제작진 인증을 줄까요?`;
    case 'unverify':
      return `${who}의 ${BADGE_LABEL[pending.badge]}을 취소할까요?`;
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
    case 'verify':
      return '공고와 제작진 소개에 인증 배지가 붙어요. 학교 인증은 1년, 제작사 인증은 취소할 때까지 유지돼요. 같은 종류 인증이 이미 있으면 새 내용으로 바뀌어요.';
    case 'unverify':
      return '공고에서 인증 배지가 바로 사라져요. 기록은 남고, 언제든 다시 줄 수 있어요.';
  }
}

function confirmLabel(pending: Pending) {
  return {
    suspend: '정지',
    unsuspend: '정지 해제',
    unlink: '연결 해제',
    delete: '삭제',
    verify: '인증 주기',
    unverify: '인증 취소',
  }[pending.kind];
}
