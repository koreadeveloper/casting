'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Brand } from './brand';
import LegalModal from './legal-modal';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal';

type Role = 'producer' | 'actor';

const ORG_TYPES = [
  '영화 제작사',
  '학생 제작팀',
  '영화동아리',
  '독립 제작자(개인)',
  '광고·숏폼 제작사',
  '기타',
];

const DOCS = {
  terms: { title: '이용약관', src: TERMS_PATH },
  privacy: { title: '개인정보처리방침', src: PRIVACY_PATH },
};

// 소셜 계정을 연결한 뒤 나머지 정보와 약관 동의를 한 화면에서 받아 가입을 마무리한다.
export default function SignupForm({
  role,
  providerLabel,
  name,
  email,
}: {
  role: Role;
  providerLabel: string;
  name: string;
  email: string;
}) {
  const [form, setForm] = useState({
    name,
    email,
    phone: '',
    orgType: '',
    orgName: '',
    agreeTerms: false,
    agreePrivacy: false,
  });
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
      const response = await fetch('/api/auth/social/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role }),
      });
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
      보기
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
          <p className="muted">{providerLabel} 계정으로 연결했어요. 나머지 정보를 입력해 주세요.</p>
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
              readOnly={!!email}
              placeholder="minsu@example.com"
            />
          </label>
          <label>
            연락처
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              autoComplete="tel"
              placeholder="010-1234-5678"
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
