'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Brand } from './brand';
import LegalModal from './legal-modal';
import { ORG_TYPES } from '@/lib/account-edit';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal';

type Role = 'producer' | 'actor';

const DOCS = {
  terms: { title: '이용약관', src: TERMS_PATH },
  privacy: { title: '개인정보처리방침', src: PRIVACY_PATH },
};

const CODE_COOLDOWN = 60;

// 가입 마무리 화면.
// - 소셜(mode 'social'): 구글 계정을 연결한 뒤 나머지 정보와 약관 동의를 받는다.
// - 이메일(mode 'email'): 메일로 받은 인증번호와 비밀번호까지 받아 비밀번호가 있는 계정을 만든다.
export default function SignupForm({
  role,
  providerLabel,
  name,
  email,
  then = '',
  mode = 'social',
}: {
  role: Role;
  providerLabel: string;
  name: string;
  email: string;
  /** 가입을 마친 뒤 돌아갈 화면(배우만, 서버가 다시 검사한다) */
  then?: string;
  mode?: 'social' | 'email';
}) {
  const byEmail = mode === 'email';
  const [form, setForm] = useState({
    name,
    email,
    phone: '',
    orgType: '',
    orgName: '',
    code: '',
    password: '',
    confirm: '',
    agreeTerms: false,
    agreePrivacy: false,
  });
  // 인증번호 보내기: 같은 이메일로 60초 안에 다시 누르지 못하게 버튼을 잠근다.
  const [codeNote, setCodeNote] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);
  const codeWait = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  async function sendCode() {
    if (codeWait > 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return setError('이메일 형식을 확인해 주세요.');
    setCodeBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '인증번호를 보내지 못했어요.');
      setCodeNote(data.message || '인증번호를 보냈어요. 메일함을 확인해 주세요.');
      setWaitUntil(Date.now() + CODE_COOLDOWN * 1000);
      setNow(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '인증번호를 보내지 못했어요.');
    } finally {
      setCodeBusy(false);
    }
  }
  const [doc, setDoc] = useState<keyof typeof DOCS | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set =
    (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((current) => ({
        ...current,
        [key]:
          event.target.type === 'checkbox'
            ? (event.target as HTMLInputElement).checked
            : event.target.value,
      }));

  function problem() {
    if (!form.name.trim()) return '이름을 입력해 주세요.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return '이메일 형식을 확인해 주세요.';
    if (byEmail && !/^\d{6}$/.test(form.code)) return '메일로 받은 인증번호 6자리를 입력해 주세요.';
    if (byEmail && form.password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (byEmail && form.password !== form.confirm) return '비밀번호와 확인 입력이 서로 달라요.';
    if (role === 'producer' && !form.orgType) return '소속 유형을 선택해 주세요.';
    if (!form.agreeTerms || !form.agreePrivacy) return '필수 약관에 동의해 주세요.';
    return '';
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const issue = problem();
    if (issue) return setError(issue);
    setError('');
    setBusy(true);
    try {
      const response = await fetch(
        byEmail ? '/api/auth/email-signup' : '/api/auth/social/complete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, role, then }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '가입하지 못했습니다.');
      location.href = data.next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '가입하지 못했습니다.');
      setBusy(false);
    }
  }

  const viewLink = (key: keyof typeof DOCS) => (
    <button type="button" className="agree-view" onClick={() => setDoc(key)}>
      전문 보기 ›
    </button>
  );

  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
        <Link className="button button-outline sm" href="/login">
          로그인
        </Link>
      </header>
      <section className="auth-card">
        <form className="auth-form wizard-body" onSubmit={submit}>
          <h1>{role === 'producer' ? '제작자 회원가입' : '배우 회원가입'}</h1>
          <p className="muted">
            {byEmail
              ? '이메일로 가입해요. 메일로 받은 인증번호로 이메일을 확인해요.'
              : `${providerLabel} 계정으로 연결했어요. 나머지 정보를 입력해 주세요.`}
          </p>
          <label>
            이름 <em>*</em>
            <input
              value={form.name}
              onChange={set('name')}
              autoComplete="name"
              maxLength={60}
              placeholder="김민수"
            />
          </label>
          <label>
            이메일 <em>*</em>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              readOnly={!byEmail && !!email}
              placeholder="minsu@example.com"
            />
          </label>
          {byEmail && (
            <>
              <button
                type="button"
                className="button button-soft full"
                onClick={() => void sendCode()}
                disabled={codeBusy || codeWait > 0}
              >
                {codeBusy
                  ? '보내는 중…'
                  : codeWait > 0
                    ? `${codeWait}초 뒤에 다시 받을 수 있어요`
                    : '인증번호 받기'}
              </button>
              {codeNote && (
                <p className="form-ok" role="status">
                  {codeNote}
                </p>
              )}
              <label>
                인증번호 <em>*</em>
                <input
                  value={form.code}
                  onChange={set('code')}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="메일로 받은 6자리"
                />
              </label>
              <label>
                비밀번호 <em>*</em>
                <input
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="8자 이상, 영문과 숫자 섞기"
                />
              </label>
              <label>
                비밀번호 확인 <em>*</em>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  autoComplete="new-password"
                  minLength={8}
                />
              </label>
            </>
          )}
          <label>
            연락처
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              autoComplete="tel"
              placeholder="숫자만 입력 (예: 01012345678)"
            />
          </label>
          {role === 'producer' && (
            <>
              <label>
                소속 유형 <em>*</em>
                <select value={form.orgType} onChange={set('orgType')}>
                  <option value="">선택해 주세요</option>
                  {ORG_TYPES.map((type) => (
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
              <p className="small-note">
                학교·제작사 인증은 가입한 뒤 ‘내 정보 → 제작진 인증’에서 할 수 있어요. 인증을 받으면
                공고에 인증 표시가 붙어요.
              </p>
            </>
          )}
          <div className="agree-box">
            <div className="check">
              <input
                id="agree-terms"
                type="checkbox"
                checked={form.agreeTerms}
                onChange={set('agreeTerms')}
              />
              <span>
                <label htmlFor="agree-terms">
                  <b>[필수]</b> 만 14세 이상이며, 서비스 이용약관에 동의합니다
                </label>
                {viewLink('terms')}
              </span>
            </div>
            <div className="check">
              <input
                id="agree-privacy"
                type="checkbox"
                checked={form.agreePrivacy}
                onChange={set('agreePrivacy')}
              />
              <span>
                <label htmlFor="agree-privacy">
                  <b>[필수]</b> 개인정보 수집·이용 동의 (이름, 이메일, 연락처
                  {role === 'actor' ? ', 프로필 사진·영상' : ', 소속'})
                </label>
                {viewLink('privacy')}
              </span>
            </div>
            {role === 'actor' && (
              <p className="small-note">
                프로필은 기본적으로 제작자 검색에 공개되며, 프로필 관리에서 언제든 비공개로 바꿀 수
                있습니다.
              </p>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="wizard-actions">
            <Link className="button button-outline" href="/signup">
              이전
            </Link>
            <button className="button button-primary" disabled={busy}>
              {busy ? '가입 중…' : '가입 완료'}
            </button>
          </div>
        </form>
      </section>
      {doc && <LegalModal {...DOCS[doc]} onClose={() => setDoc(null)} />}
    </main>
  );
}
