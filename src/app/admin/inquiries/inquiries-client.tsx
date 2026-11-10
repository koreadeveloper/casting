'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminInquiry } from '@/lib/admin-inquiries';
import { INQUIRY_KINDS, INQUIRY_STATUS, type InquiryKind, type InquiryStatus } from '@/lib/inquiry';
import { formatDateTime } from '../format';
import { useAutoRefresh } from '../use-auto-refresh';

const STATUS_CHIP: Record<InquiryStatus, string> = {
  new: 'status-chip admin-chip-new',
  doing: 'status-chip chip-hold',
  done: 'status-chip chip-excluded',
};

export default function InquiriesClient({
  inquiries,
  loadedAt,
}: {
  inquiries: AdminInquiry[];
  loadedAt: string;
}) {
  // 기본은 끝나지 않은 문의(새 문의·처리 중)만
  const [status, setStatus] = useState<InquiryStatus | 'open' | ''>('open');
  const [kind, setKind] = useState<InquiryKind | ''>('');
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<AdminInquiry | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const editing = Object.keys(drafts).length > 0;
  const router = useAutoRefresh(editing || Boolean(deleting) || Boolean(busy));

  const counts = useMemo(() => {
    const by = { new: 0, doing: 0, done: 0 };
    for (const inquiry of inquiries) by[inquiry.status]++;
    return by;
  }, [inquiries]);

  const shown = inquiries.filter((inquiry) => {
    if (status === 'open' && inquiry.status === 'done') return false;
    if (status && status !== 'open' && inquiry.status !== status) return false;
    if (kind && inquiry.kind !== kind) return false;
    const q = query.trim().toLowerCase();
    return (
      !q || [inquiry.email, inquiry.body, inquiry.note].some((t) => t.toLowerCase().includes(q))
    );
  });

  function say(text: string) {
    setToast(text);
    setTimeout(() => setToast(''), 2500);
  }

  async function send(inquiry: AdminInquiry, method: 'PATCH' | 'DELETE', body?: object) {
    setBusy(inquiry.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiry.id)}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '처리하지 못했어요. 다시 시도해 주세요.');
      router.refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '처리하지 못했어요.');
      return false;
    } finally {
      setBusy('');
    }
  }

  async function setInquiryStatus(inquiry: AdminInquiry, next: InquiryStatus) {
    if (await send(inquiry, 'PATCH', { status: next }))
      say(`'${INQUIRY_STATUS[next]}'(으)로 바꿨어요.`);
  }

  async function saveNote(inquiry: AdminInquiry) {
    if (await send(inquiry, 'PATCH', { note: drafts[inquiry.id] ?? '' })) {
      setDrafts(({ [inquiry.id]: _, ...rest }) => rest);
      say('메모를 저장했어요.');
    }
  }

  return (
    <section className="admin-body">
      <h1 className="page-title">문의 처리함</h1>
      <p className="muted admin-lead">
        문의하기(/contact)로 들어온 문의예요. 메일 알림이 없으니 여기서 확인해 주세요. 답장은
        &lsquo;메일로 답장&rsquo;을 누르면 내 메일 앱에서 보낼 수 있어요. 문의는 1년이 지나면
        자동으로 지워져요.
      </p>

      <div className="admin-tools">
        <label className="search-box">
          <span aria-hidden>⌕</span>
          <input
            type="search"
            placeholder="이메일·내용·메모로 찾기"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="chip-pick" role="group" aria-label="처리 상태">
          {(
            [
              ['open', `처리 전 ${counts.new + counts.doing}`],
              ['new', `새 문의 ${counts.new}`],
              ['doing', `처리 중 ${counts.doing}`],
              ['done', `완료 ${counts.done}`],
              ['', `전체 ${inquiries.length}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              className={status === value ? 'on' : ''}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="admin-selects">
          <select
            className="sort-select"
            value={kind}
            onChange={(event) => setKind(event.target.value as InquiryKind | '')}
            aria-label="문의 종류"
          >
            <option value="">모든 종류</option>
            {(Object.keys(INQUIRY_KINDS) as InquiryKind[]).map((value) => (
              <option key={value} value={value}>
                {INQUIRY_KINDS[value]}
              </option>
            ))}
          </select>
          <span className="small-note">
            {shown.length}건 표시 · {formatDateTime(loadedAt)} 기준 (30초마다 갱신)
          </span>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="empty-card">조건에 맞는 문의가 없어요.</div>
      ) : (
        <ul className="admin-list">
          {shown.map((inquiry) => {
            const draft = drafts[inquiry.id];
            const reply = `mailto:${inquiry.email}?subject=${encodeURIComponent(
              `[캐스팅플로우] 문의 답변: ${INQUIRY_KINDS[inquiry.kind]}`,
            )}&body=${encodeURIComponent(`\n\n---\n보내신 문의 (${formatDateTime(inquiry.createdAt)})\n${inquiry.body}`)}`;
            return (
              <li
                key={inquiry.id}
                className={`admin-row admin-inquiry${inquiry.status === 'done' ? ' off' : ''}`}
              >
                <div className="admin-main">
                  <div className="admin-name">
                    <span className={STATUS_CHIP[inquiry.status]}>
                      {INQUIRY_STATUS[inquiry.status]}
                    </span>
                    <strong>{INQUIRY_KINDS[inquiry.kind]}</strong>
                    {inquiry.kind === 'report' && (
                      <span className="status-chip admin-chip-off">신고</span>
                    )}
                  </div>
                  <div className="admin-meta">
                    <span>{formatDateTime(inquiry.createdAt)}</span>
                    <span>{inquiry.email}</span>
                    {inquiry.member ? (
                      <Link href={`/admin/members/${inquiry.member.id}`}>
                        회원: {inquiry.member.name || '(이름 없음)'} ·{' '}
                        {inquiry.member.role === 'producer' ? '제작진' : '배우'}
                      </Link>
                    ) : (
                      <span>회원 아님</span>
                    )}
                    {inquiry.handledAt && <span>완료 {formatDateTime(inquiry.handledAt)}</span>}
                  </div>
                  <p className="admin-inquiry-body">{inquiry.body}</p>
                  {inquiry.link && (
                    <a
                      className="admin-inquiry-link"
                      href={inquiry.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      관련 링크: {inquiry.link}
                    </a>
                  )}
                  <label className="admin-note">
                    <span className="small-note">관리자 메모 (보낸 사람에게는 안 보여요)</span>
                    <textarea
                      value={draft ?? inquiry.note}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [inquiry.id]: event.target.value }))
                      }
                      rows={2}
                      maxLength={2000}
                      placeholder="처리 내용, 연락한 내용 등"
                    />
                  </label>
                  {draft !== undefined && (
                    <div className="admin-note-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={busy === inquiry.id}
                        onClick={() => void saveNote(inquiry)}
                      >
                        메모 저장
                      </button>
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => setDrafts(({ [inquiry.id]: _, ...rest }) => rest)}
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
                <div className="admin-actions admin-actions-col">
                  <a className="button button-outline" href={reply}>
                    메일로 답장
                  </a>
                  {inquiry.status !== 'doing' && inquiry.status !== 'done' && (
                    <button
                      type="button"
                      className="button button-soft"
                      disabled={busy === inquiry.id}
                      onClick={() => void setInquiryStatus(inquiry, 'doing')}
                    >
                      처리 중으로
                    </button>
                  )}
                  {inquiry.status !== 'done' ? (
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={busy === inquiry.id}
                      onClick={() => void setInquiryStatus(inquiry, 'done')}
                    >
                      완료
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button button-soft"
                      disabled={busy === inquiry.id}
                      onClick={() => void setInquiryStatus(inquiry, 'doing')}
                    >
                      다시 열기
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-button admin-delete-link"
                    onClick={() => setDeleting(inquiry)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deleting && (
        <div
          className="confirm-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) setDeleting(null);
          }}
        >
          <div className="confirm-card admin-confirm">
            <p>이 문의를 삭제할까요?</p>
            <div className="small-note">
              {deleting.email}이 보낸 {INQUIRY_KINDS[deleting.kind]}이에요. 삭제하면 되돌릴 수
              없어요. 다 처리했다면 삭제 대신 &lsquo;완료&rsquo;로 두는 걸 권해요.
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="button button-soft"
                onClick={() => setDeleting(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={Boolean(busy)}
                onClick={async () => {
                  if (await send(deleting, 'DELETE')) {
                    setDeleting(null);
                    say('문의를 삭제했어요.');
                  }
                }}
              >
                {busy ? '삭제 중…' : '삭제'}
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
    </section>
  );
}
