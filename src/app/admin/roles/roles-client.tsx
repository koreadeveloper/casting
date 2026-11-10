'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdminRole } from '@/lib/admin-roles';
import { NO_SPECIAL_SCENE, specialScenesLabel } from '@/lib/project-meta';
import { formatDay } from '../format';
import { useAutoRefresh } from '../use-auto-refresh';

type View = 'open' | 'closed' | 'hidden' | 'special' | '';
type Pending = { role: AdminRole; action: 'hide' | 'unhide' | 'close' | 'reopen' };

const ACTION_TEXT = {
  hide: {
    title: '이 공고를 내릴까요?',
    detail:
      '배우 쪽 공고 목록·검색·맞춤 공고에서 사라지고, 지원 링크로 들어와도 없는 공고로 보이며, 새 지원을 받지 않아요. 이미 들어온 지원서와 제작진 화면은 그대로예요. 언제든 다시 올릴 수 있어요.',
    label: '내리기',
    danger: true,
  },
  unhide: {
    title: '이 공고를 다시 올릴까요?',
    detail: '배우 쪽 목록과 지원 링크에 다시 보여요(마감 전이면 지원도 다시 받아요).',
    label: '다시 올리기',
    danger: false,
  },
  close: {
    title: '이 공고를 마감할까요?',
    detail: '목록에서 빠지고 새 지원을 받지 않아요. 공고 화면은 "모집 마감"으로 남아요.',
    label: '마감',
    danger: true,
  },
  reopen: {
    title: '마감을 풀까요?',
    detail: '마감일이 지나지 않았으면 다시 지원을 받아요.',
    label: '마감 해제',
    danger: false,
  },
} as const;

const hasSpecial = (role: AdminRole) =>
  role.specialScenes.length > 0 && !role.specialScenes.includes(NO_SPECIAL_SCENE);

export default function RolesClient({ roles, today }: { roles: AdminRole[]; today: string }) {
  const [view, setView] = useState<View>('');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useAutoRefresh(Boolean(pending) || busy);

  // 배우 쪽 목록에 실제로 보이는 공고(대시보드 숫자와 같다)
  const isOpen = (role: AdminRole) =>
    !role.closed &&
    !role.hiddenAt &&
    !role.archived &&
    !role.testListing &&
    (!role.deadline || role.deadline >= today);
  const counts = {
    open: roles.filter(isOpen).length,
    closed: roles.filter((r) => !isOpen(r) && !r.hiddenAt).length,
    hidden: roles.filter((r) => r.hiddenAt).length,
    special: roles.filter(hasSpecial).length,
  };
  const shown = roles.filter((role) => {
    if (view === 'open' && !isOpen(role)) return false;
    if (view === 'closed' && (isOpen(role) || role.hiddenAt)) return false;
    if (view === 'hidden' && !role.hiddenAt) return false;
    if (view === 'special' && !hasSpecial(role)) return false;
    const q = query.trim().toLowerCase();
    return (
      !q ||
      [role.title, role.projectTitle, role.ownerName, role.ownerEmail].some((t) =>
        t.toLowerCase().includes(q),
      )
    );
  });

  async function run() {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/roles/${encodeURIComponent(pending.role.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pending.action, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '처리하지 못했어요.');
      setPending(null);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-body">
      <h1 className="page-title">공고 관리</h1>
      <p className="muted admin-lead">
        모든 제작진의 공고예요. 허위·부적절한 공고는 &lsquo;내리기&rsquo;로 배우 쪽에서 바로 감출 수
        있어요. 지우지 않으니 언제든 다시 올릴 수 있어요.
      </p>
      <div className="admin-tools">
        <label className="search-box">
          <span aria-hidden>⌕</span>
          <input
            type="search"
            placeholder="공고·작품·제작진 이름·이메일로 찾기"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="chip-pick" role="group" aria-label="공고 상태">
          {(
            [
              ['', `전체 ${roles.length}`],
              ['open', `배우에게 보임 ${counts.open}`],
              ['closed', `안 보임(마감·보관·테스트) ${counts.closed}`],
              ['hidden', `내린 공고 ${counts.hidden}`],
              ['special', `특수 장면 있음 ${counts.special}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              className={view === value ? 'on' : ''}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty-card">조건에 맞는 공고가 없어요.</div>
      ) : (
        <ul className="admin-list">
          {shown.map((role) => (
            <li key={role.id} className={role.hiddenAt ? 'admin-row off' : 'admin-row'}>
              <div className="admin-main">
                <div className="admin-name">
                  <strong>{role.projectTitle}</strong>
                  <span>· {role.title}</span>
                  {role.hiddenAt ? (
                    <span className="status-chip admin-chip-off">
                      내림 {formatDay(role.hiddenAt)}
                    </span>
                  ) : isOpen(role) ? (
                    <span className="status-chip admin-chip-new">배우에게 보임</span>
                  ) : (
                    <span className="status-chip">
                      {role.archived
                        ? '보관'
                        : role.closed || (role.deadline && role.deadline < today)
                          ? '마감'
                          : '배우에게 안 보임'}
                    </span>
                  )}
                  {role.testListing && <span className="status-chip">테스트·파일럿 전 공고</span>}
                  {hasSpecial(role) && (
                    <span className="status-chip chip-hold">
                      {specialScenesLabel(role.specialScenes)}
                    </span>
                  )}
                </div>
                <div className="admin-meta">
                  {role.ownerId ? (
                    <Link href={`/admin/members/${role.ownerId}`}>
                      {role.ownerName || '(이름 없음)'} · {role.ownerEmail}
                    </Link>
                  ) : (
                    <span>제작진 없음</span>
                  )}
                  <span>등록 {formatDay(role.createdAt)}</span>
                  {role.deadline && <span>마감일 {role.deadline}</span>}
                  <span>지원 {role.applicants}건</span>
                  <a href={`/apply/${role.slug}`} target="_blank" rel="noreferrer">
                    공고 화면 ↗
                  </a>
                </div>
              </div>
              <div className="admin-actions">
                {role.hiddenAt ? (
                  <button
                    type="button"
                    className="button button-soft"
                    onClick={() => setPending({ role, action: 'unhide' })}
                  >
                    다시 올리기
                  </button>
                ) : (
                  <>
                    {role.closed ? (
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => setPending({ role, action: 'reopen' })}
                      >
                        마감 해제
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => setPending({ role, action: 'close' })}
                      >
                        마감
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() => setPending({ role, action: 'hide' })}
                    >
                      내리기
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

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
            <p>{ACTION_TEXT[pending.action].title}</p>
            <div className="small-note">
              <strong>
                {pending.role.projectTitle} · {pending.role.title}
              </strong>
              <br />
              {ACTION_TEXT[pending.action].detail}
            </div>
            <label className="admin-confirm-input">
              <span className="small-note">사유 (작업 기록에 남아요, 선택)</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={300}
                placeholder="예: 허위 공고 신고 접수"
              />
            </label>
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
                onClick={() => {
                  setPending(null);
                  setReason('');
                }}
              >
                취소
              </button>
              <button
                type="button"
                className={
                  ACTION_TEXT[pending.action].danger
                    ? 'button button-danger'
                    : 'button button-primary'
                }
                disabled={busy}
                onClick={async () => {
                  await run();
                  setReason('');
                }}
              >
                {busy ? '처리 중…' : ACTION_TEXT[pending.action].label}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
