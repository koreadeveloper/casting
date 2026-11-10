'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdminVerification } from '@/lib/admin-verifications';
import { formatDateTime } from '../format';
import { useAutoRefresh } from '../use-auto-refresh';

/**
 * 제작사 인증 확인함. 국세청 기록만 맞으면 바로 승인되므로, 남의 사업자로 받은 인증이 아닌지
 * 관리자가 한 건씩 보고 '문제없음' 또는 '인증 취소'를 누른다.
 */
export default function VerificationsClient({
  items,
  loadedAt,
}: {
  items: AdminVerification[];
  loadedAt: string;
}) {
  const [showReviewed, setShowReviewed] = useState(false);
  const [revoking, setRevoking] = useState<AdminVerification | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const router = useAutoRefresh(Boolean(revoking) || Boolean(busy));

  const pending = items.filter((item) => !item.reviewedAt);
  const shown = showReviewed ? items : pending;

  async function act(item: AdminVerification, action: 'review' | 'revoke') {
    setBusy(item.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/verifications/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '처리하지 못했어요. 다시 시도해 주세요.');
      setToast(action === 'review' ? '문제없음으로 표시했어요.' : '인증을 취소했어요.');
      setTimeout(() => setToast(''), 2500);
      setRevoking(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '처리하지 못했어요.');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="admin-body">
      <h1 className="page-title">인증 확인</h1>
      <p className="muted admin-lead">
        국세청 조회로 바로 승인된 제작사 인증이에요. 사업자번호·대표자·개업일만 맞으면 누구나 인증될
        수 있어서, 회원 정보와 상호가 어울리는지 한 번씩 봐 주세요. 수상하면 &lsquo;인증
        취소&rsquo;를 누르고, 필요하면 회원 화면에서 연락하거나 정지해 주세요.
      </p>

      <div className="admin-tools">
        <div className="chip-pick" role="group" aria-label="보기">
          <button
            type="button"
            className={!showReviewed ? 'on' : ''}
            aria-pressed={!showReviewed}
            onClick={() => setShowReviewed(false)}
          >
            확인 전 {pending.length}
          </button>
          <button
            type="button"
            className={showReviewed ? 'on' : ''}
            aria-pressed={showReviewed}
            onClick={() => setShowReviewed(true)}
          >
            유효한 인증 전체 {items.length}
          </button>
        </div>
        <span className="small-note">{formatDateTime(loadedAt)} 기준 (30초마다 갱신)</span>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="empty-card">
          {showReviewed ? '유효한 제작사 인증이 없어요.' : '확인할 인증이 없어요.'}
        </div>
      ) : (
        <ul className="admin-list">
          {shown.map((item) => (
            <li key={item.id} className={`admin-row${item.reviewedAt ? ' off' : ''}`}>
              <div className="admin-main">
                <div className="admin-name">
                  <span
                    className={
                      item.reviewedAt ? 'status-chip chip-excluded' : 'status-chip admin-chip-new'
                    }
                  >
                    {item.reviewedAt ? '확인함' : '확인 전'}
                  </span>
                  <strong>{item.orgName || '(상호 없음)'}</strong>
                  <span className="status-chip admin-chip-off">
                    {item.method === 'nts' ? '국세청 조회' : '서류'}
                  </span>
                </div>
                <div className="admin-meta">
                  <Link href={`/admin/members/${item.userId}`}>
                    회원: {item.memberName || '(이름 없음)'} · {item.memberEmail}
                  </Link>
                  {item.orgType && <span>소속 유형: {item.orgType}</span>}
                  {item.detail && <span>사업자번호 {item.detail}</span>}
                </div>
                <div className="admin-meta">
                  <span>인증 {formatDateTime(item.createdAt)}</span>
                  {item.reviewedAt && <span>확인 {formatDateTime(item.reviewedAt)}</span>}
                </div>
              </div>
              <div className="admin-actions admin-actions-col">
                {!item.reviewedAt && (
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={busy === item.id}
                    onClick={() => void act(item, 'review')}
                  >
                    문제없음
                  </button>
                )}
                <button
                  type="button"
                  className="button button-soft"
                  disabled={busy === item.id}
                  onClick={() => setRevoking(item)}
                >
                  인증 취소
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {revoking && (
        <div
          className="confirm-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) setRevoking(null);
          }}
        >
          <div className="confirm-card admin-confirm">
            <p>이 제작사 인증을 취소할까요?</p>
            <div className="small-note">
              {revoking.memberName || revoking.memberEmail}의 &lsquo;{revoking.orgName}&rsquo;
              인증을 거둬요. 공고의 인증 표시가 바로 사라지고, 회원은 다시 인증을 신청할 수 있어요.
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="button button-soft"
                onClick={() => setRevoking(null)}
              >
                닫기
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={Boolean(busy)}
                onClick={() => void act(revoking, 'revoke')}
              >
                인증 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" onClick={() => setToast('')}>
          {toast}
        </div>
      )}
    </section>
  );
}
