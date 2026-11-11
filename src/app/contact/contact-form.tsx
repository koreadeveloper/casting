'use client';

import Link from 'next/link';
import { useState } from 'react';
import BackButton from '@/components/back-button';
import { Brand } from '@/components/brand';
import { INQUIRY_BODY_MAX, INQUIRY_BODY_MIN, INQUIRY_KINDS, type InquiryKind } from '@/lib/inquiry';
import { LEGAL, PRIVACY_PATH } from '@/lib/legal';

const PLACEHOLDERS: Record<InquiryKind, string> = {
  general: '궁금한 점을 편하게 적어 주세요.',
  bug: '어느 화면에서 무엇을 눌렀을 때 어떻게 됐는지 적어 주시면 빨리 고칠 수 있어요.',
  privacy:
    '열람·수정·삭제 중 무엇을 원하시는지 적어 주세요. 가입 없이 지원했다면 지원 현황 화면 주소도 함께 적어 주세요.',
  report:
    '어떤 공고(또는 사람)가 어떤 문제가 있었는지 적어 주세요. 신고한 분의 정보는 상대에게 알리지 않아요.',
};

export default function ContactForm({
  initialKind,
  initialEmail,
  initialLink,
}: {
  initialKind: InquiryKind;
  initialEmail: string;
  initialLink: string;
}) {
  const [kind, setKind] = useState<InquiryKind>(initialKind);
  const [email, setEmail] = useState(initialEmail);
  const [body, setBody] = useState('');
  const [link, setLink] = useState(initialLink);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, email, body, link, agree }),
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
            <h1>문의가 접수됐어요</h1>
            <p className="muted">
              확인한 뒤 <strong>{email}</strong>로 답장을 드릴게요.
            </p>
            <Link className="button button-primary full" href="/" style={{ marginTop: 20 }}>
              처음으로
            </Link>
          </>
        ) : (
          <>
            <BackButton fallback="/" label="뒤로" />
            <h1>문의하기</h1>
            <p className="muted">
              궁금한 점, 오류, 개인정보 요청, 신고를 여기서 보내 주세요. 가입하지 않아도 보낼 수
              있어요.
            </p>
            <form className="auth-form" onSubmit={submit}>
              <label>
                문의 종류 <em>*</em>
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as InquiryKind)}
                >
                  {Object.entries(INQUIRY_KINDS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                답장 받을 이메일 <em>*</em>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                내용 <em>*</em>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={6}
                  minLength={INQUIRY_BODY_MIN}
                  maxLength={INQUIRY_BODY_MAX}
                  placeholder={PLACEHOLDERS[kind]}
                  required
                />
              </label>
              <label>
                관련 링크
                <input
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  inputMode="url"
                  placeholder="공고 주소나 화면 주소"
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                  required
                />
                <span>
                  <b>[필수]</b> 문의 응대를 위한 개인정보 수집·이용에 동의합니다
                  <a className="agree-view" href={PRIVACY_PATH} target="_blank" rel="noopener">
                    보기
                  </a>
                </span>
              </label>
              <p className="agree-detail">
                항목: 이메일, 문의 내용, 관련 링크 · 목적: 문의 확인과 답변 · 보유: 1년 뒤 자동 삭제
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button button-primary full" disabled={busy}>
                {busy ? '보내는 중…' : '문의 보내기'}
              </button>
            </form>
            {LEGAL.contact.includes('@') && (
              <p className="small-note center">
                이메일로 보내셔도 돼요: <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
