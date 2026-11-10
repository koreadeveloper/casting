'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminReport } from '@/lib/reports';
import {
  REPORT_REASONS,
  REPORT_STATUS,
  REPORT_TARGETS,
  isReportClosed,
  type ReportStatus,
  type ReportTarget,
} from '@/lib/report-rules';
import { formatDateTime } from '../format';
import { useAutoRefresh } from '../use-auto-refresh';

const STATUS_CHIP: Record<ReportStatus, string> = {
  new: 'status-chip admin-chip-new',
  reviewing: 'status-chip chip-hold',
  actioned: 'status-chip chip-excluded',
  dismissed: 'status-chip chip-excluded',
};

const SIDE_LABEL = { guest: '비회원', actor: '배우', producer: '제작진' } as const;

/**
 * 같은 대상으로 셀 열쇠. 대화 신고는 한 지원서 대화를 두고 배우는 제작진을, 제작진은 배우를 신고하므로
 * 신고한 쪽에 따라 대상(상대)이 다르다. 두 방향을 한데 세지 않게 나눈다.
 */
const targetKey = (report: AdminReport) =>
  `${report.targetType}:${report.targetId}${
    report.targetType === 'chat' ? (report.reporterSide === 'actor' ? ':team' : ':actor') : ''
  }`;

const reasonLabel = (reason: string) =>
  REPORT_REASONS[reason as keyof typeof REPORT_REASONS] ?? reason;

export default function ReportsClient({
  reports,
  loadedAt,
}: {
  reports: AdminReport[];
  loadedAt: string;
}) {
  // 기본은 끝나지 않은 신고(새 신고·확인 중)만
  const [status, setStatus] = useState<ReportStatus | 'open' | ''>('open');
  const [type, setType] = useState<ReportTarget | ''>('');
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<AdminReport | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const editing = Object.keys(drafts).length > 0;
  const router = useAutoRefresh(editing || Boolean(deleting) || Boolean(busy));

  const counts = useMemo(() => {
    const by = { new: 0, reviewing: 0, actioned: 0, dismissed: 0 };
    for (const report of reports) by[report.status]++;
    return by;
  }, [reports]);

  // 같은 대상·같은 회원에 쌓인 신고 수(보관 중인 1년치 전체). 여러 번 신고된 대상을 먼저 알아보게 한다.
  const repeats = useMemo(() => {
    const byTarget = new Map<string, number>();
    const bySubject = new Map<string, number>();
    for (const report of reports) {
      const key = targetKey(report);
      byTarget.set(key, (byTarget.get(key) ?? 0) + 1);
      if (report.subject)
        bySubject.set(report.subject.id, (bySubject.get(report.subject.id) ?? 0) + 1);
    }
    return { byTarget, bySubject };
  }, [reports]);

  const shown = reports.filter((report) => {
    if (status === 'open' && isReportClosed(report.status)) return false;
    if (status && status !== 'open' && report.status !== status) return false;
    if (type && report.targetType !== type) return false;
    const q = query.trim().toLowerCase();
    return (
      !q ||
      [
        report.targetLabel,
        report.reporterEmail,
        report.body,
        report.note,
        report.subject?.name ?? '',
      ].some((text) => text.toLowerCase().includes(q))
    );
  });

  function say(text: string) {
    setToast(text);
    setTimeout(() => setToast(''), 2500);
  }

  async function send(report: AdminReport, method: 'PATCH' | 'DELETE', body?: object) {
    setBusy(report.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/reports/${encodeURIComponent(report.id)}`, {
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

  async function setReportStatus(report: AdminReport, next: ReportStatus) {
    if (await send(report, 'PATCH', { status: next }))
      say(`'${REPORT_STATUS[next]}'(으)로 바꿨어요.`);
  }

  async function saveNote(report: AdminReport) {
    if (await send(report, 'PATCH', { note: drafts[report.id] ?? '' })) {
      setDrafts(({ [report.id]: _, ...rest }) => rest);
      say('메모를 저장했어요.');
    }
  }

  return (
    <section className="admin-body">
      <h1 className="page-title">신고 처리함</h1>
      <p className="muted admin-lead">
        공고·배우 프로필·대화에서 들어온 신고예요. 사실을 확인한 뒤 공고는 &lsquo;공고&rsquo;
        메뉴에서 내리고, 회원은 회원 화면에서 정지할 수 있어요. 처리 결과는 &lsquo;조치함&rsquo;
        또는 &lsquo;문제 없음&rsquo;으로 남겨 주세요. 신고한 사람은 신고당한 사람에게 알리지 않아요.
        신고는 1년이 지나면 자동으로 지워져요.
      </p>

      <div className="admin-tools">
        <label className="search-box">
          <span aria-hidden>⌕</span>
          <input
            type="search"
            placeholder="대상·이메일·내용·메모로 찾기"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="chip-pick" role="group" aria-label="처리 상태">
          {(
            [
              ['open', `처리 전 ${counts.new + counts.reviewing}`],
              ['new', `새 신고 ${counts.new}`],
              ['reviewing', `확인 중 ${counts.reviewing}`],
              ['actioned', `조치함 ${counts.actioned}`],
              ['dismissed', `문제 없음 ${counts.dismissed}`],
              ['', `전체 ${reports.length}`],
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
            value={type}
            onChange={(event) => setType(event.target.value as ReportTarget | '')}
            aria-label="신고 대상"
          >
            <option value="">모든 대상</option>
            {(Object.keys(REPORT_TARGETS) as ReportTarget[]).map((value) => (
              <option key={value} value={value}>
                {REPORT_TARGETS[value]}
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
        <div className="empty-card">조건에 맞는 신고가 없어요.</div>
      ) : (
        <ul className="admin-list">
          {shown.map((report) => {
            const draft = drafts[report.id];
            const sameTarget = repeats.byTarget.get(targetKey(report)) ?? 1;
            const sameSubject = report.subject
              ? (repeats.bySubject.get(report.subject.id) ?? 1)
              : 0;
            const reply = `mailto:${report.reporterEmail}?subject=${encodeURIComponent(
              `[캐스팅플로우] 신고 처리 안내: ${reasonLabel(report.reason)}`,
            )}&body=${encodeURIComponent(`\n\n---\n보내신 신고 (${formatDateTime(report.createdAt)})\n${report.body}`)}`;
            return (
              <li
                key={report.id}
                className={`admin-row admin-inquiry${isReportClosed(report.status) ? ' off' : ''}`}
              >
                <div className="admin-main">
                  <div className="admin-name">
                    <span className={STATUS_CHIP[report.status]}>
                      {REPORT_STATUS[report.status]}
                    </span>
                    <strong>{reasonLabel(report.reason)}</strong>
                    <span className="status-chip admin-chip-off">
                      {REPORT_TARGETS[report.targetType]}
                    </span>
                    {(sameTarget > 1 || sameSubject > 1) && (
                      <span className="status-chip admin-chip-new">
                        {sameSubject > 1
                          ? `이 회원 신고 ${sameSubject}건`
                          : `같은 대상 ${sameTarget}건`}
                      </span>
                    )}
                  </div>
                  <div className="admin-meta">
                    <span>{formatDateTime(report.createdAt)}</span>
                    <span>
                      대상:{' '}
                      {report.targetLink ? (
                        <a href={report.targetLink} target="_blank" rel="noreferrer">
                          {report.targetLabel}
                        </a>
                      ) : (
                        report.targetLabel
                      )}
                    </span>
                    {report.subject ? (
                      <Link href={`/admin/members/${report.subject.id}`}>
                        신고당한 회원: {report.subject.name || '(이름 없음)'} ·{' '}
                        {report.subject.role === 'producer' ? '제작진' : '배우'}
                        {report.subject.suspended && ' (정지됨)'}
                      </Link>
                    ) : (
                      <span>신고당한 회원: 없음(비회원 또는 탈퇴)</span>
                    )}
                    {report.targetType === 'role' && (
                      <Link href="/admin/roles">공고 관리에서 내리기</Link>
                    )}
                  </div>
                  <div className="admin-meta">
                    <span>
                      신고한 사람: {SIDE_LABEL[report.reporterSide]} · {report.reporterEmail}
                    </span>
                    {report.reporter && (
                      <Link href={`/admin/members/${report.reporter.id}`}>
                        회원: {report.reporter.name || '(이름 없음)'}
                      </Link>
                    )}
                    {report.handledAt && <span>처리 {formatDateTime(report.handledAt)}</span>}
                  </div>
                  <p className="admin-inquiry-body">{report.body}</p>
                  <label className="admin-note">
                    <span className="small-note">
                      관리자 메모 (신고한 사람·신고당한 사람 모두에게 안 보여요)
                    </span>
                    <textarea
                      value={draft ?? report.note}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [report.id]: event.target.value }))
                      }
                      rows={2}
                      maxLength={2000}
                      placeholder="확인한 사실, 한 조치, 연락한 내용 등"
                    />
                  </label>
                  {draft !== undefined && (
                    <div className="admin-note-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={busy === report.id}
                        onClick={() => void saveNote(report)}
                      >
                        메모 저장
                      </button>
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => setDrafts(({ [report.id]: _, ...rest }) => rest)}
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
                  {report.status === 'new' && (
                    <button
                      type="button"
                      className="button button-soft"
                      disabled={busy === report.id}
                      onClick={() => void setReportStatus(report, 'reviewing')}
                    >
                      확인 중으로
                    </button>
                  )}
                  {!isReportClosed(report.status) ? (
                    <>
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={busy === report.id}
                        onClick={() => void setReportStatus(report, 'actioned')}
                      >
                        조치함
                      </button>
                      <button
                        type="button"
                        className="button button-soft"
                        disabled={busy === report.id}
                        onClick={() => void setReportStatus(report, 'dismissed')}
                      >
                        문제 없음
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="button button-soft"
                      disabled={busy === report.id}
                      onClick={() => void setReportStatus(report, 'reviewing')}
                    >
                      다시 열기
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-button admin-delete-link"
                    onClick={() => setDeleting(report)}
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
            <p>이 신고를 삭제할까요?</p>
            <div className="small-note">
              {deleting.reporterEmail}이 보낸 신고({reasonLabel(deleting.reason)})예요. 삭제하면
              되돌릴 수 없고, 같은 대상의 신고 건수에서도 빠져요. 다 처리했다면 삭제 대신
              &lsquo;조치함&rsquo;이나 &lsquo;문제 없음&rsquo;으로 두는 걸 권해요.
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
                    say('신고를 삭제했어요.');
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
