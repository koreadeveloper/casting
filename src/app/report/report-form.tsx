'use client';

import { useState } from 'react';
import BackButton from '@/components/back-button';
import { Brand } from '@/components/brand';
import { PRIVACY_PATH } from '@/lib/legal';
import {
  REPORT_BODY_MAX,
  REPORT_BODY_MIN,
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
} from '@/lib/report-rules';

const PLACEHOLDERS: Partial<Record<ReportReason, string>> = {
  no_show:
    '어느 촬영(날짜·장소)에 연락 없이 오지 않았는지, 미리 확인한 내용이 있었는지 적어 주세요.',
  inappropriate_request: '언제, 어떤 요구를 받았는지 적어 주세요. 대화 내용을 그대로 옮겨도 돼요.',
  pay: '안내받은 조건과 실제가 어떻게 달랐는지 적어 주세요.',
};

export default function ReportForm({
  type,
  id,
  receipt,
  typeLabel,
  targetLabel,
  reasons,
  accountEmail,
}: {
  type: ReportTarget;
  id: string;
  receipt: string;
  typeLabel: string;
  targetLabel: string;
  reasons: ReportReason[];
  /** 로그인 계정·지원서의 이메일. 있으면 입력받지 않는다. */
  accountEmail: string;
}) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, receipt, reason, body, email, agree }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '보내지 못했어요. 다시 시도해 주세요.');
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '보내지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
      </header>
      <section className="auth-card">
        {sent ? (
          <>
            <h1>신고가 접수됐어요</h1>
            <p className="muted">
              운영팀이 사실을 확인한 뒤 필요한 조치를 할게요. 확인에 필요하면{' '}
              <strong>{accountEmail || email}</strong>로 연락드릴 수 있어요. 신고한 분의 정보는
              상대에게 알리지 않아요.
            </p>
            <BackButton fallback="/" label="돌아가기" />
          </>
        ) : (
          <>
            <BackButton fallback="/" label="뒤로" />
            <h1>신고하기</h1>
            <p className="muted">
              운영팀이 사실을 확인한 뒤 공고 내림, 이용 제한 등 필요한 조치를 해요. 신고한 분의
              정보는 상대에게 알리지 않아요.
            </p>
            <div className="report-target">
              <span>{typeLabel}</span>
              <strong>{targetLabel}</strong>
            </div>
            <form className="auth-form" onSubmit={submit}>
              <label>
                신고 사유
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ReportReason)}
                  required
                >
                  <option value="" disabled>
                    골라 주세요
                  </option>
                  {reasons.map((value) => (
                    <option key={value} value={value}>
                      {REPORT_REASONS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                무슨 일이 있었나요
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={6}
                  minLength={REPORT_BODY_MIN}
                  maxLength={REPORT_BODY_MAX}
                  placeholder={
                    (reason && PLACEHOLDERS[reason]) ||
                    '언제, 어떤 일이 있었는지 확인할 수 있게 적어 주세요.'
                  }
                  required
                />
              </label>
              {accountEmail ? (
                <p className="small-note">
                  확인에 필요하면 <strong>{accountEmail}</strong>로 연락드려요.
                </p>
              ) : (
                <label>
                  답장 받을 이메일
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="example@email.com"
                    required
                  />
                </label>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                  required
                />
                <span>
                  <b>[필수]</b> 신고 확인을 위한 개인정보 수집·이용에 동의합니다
                  <a className="agree-view" href={PRIVACY_PATH} target="_blank" rel="noopener">
                    보기
                  </a>
                </span>
              </label>
              <p className="agree-detail">
                항목: 이메일, 신고 사유·내용, 신고 대상 · 목적: 신고 사실 확인과 조치, 연락 · 보유:
                1년 뒤 자동 삭제
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button button-primary full" disabled={busy}>
                {busy ? '보내는 중…' : '신고 보내기'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
