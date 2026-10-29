'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Brand } from './brand';

type Role = 'producer' | 'actor';

const ORG_TYPES = [
  '영화 제작사',
  '학생 제작팀',
  '영화동아리',
  '독립 제작자(개인)',
  '광고·숏폼 제작사',
  '기타',
];

export default function SignupWizard({ role }: { role: Role }) {
  const steps =
    role === 'producer' ? ['기본 정보', '소속·활동 정보', '약관 동의'] : ['기본 정보', '약관 동의'];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    passwordConfirm: '',
    orgType: '',
    orgName: '',
    agreeTerms: false,
    agreePrivacy: false,
  });
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

  function stepProblem() {
    if (step === 0) {
      if (!form.name.trim()) return '이름을 입력해 주세요.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return '이메일 형식을 확인해 주세요.';
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
        return '비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.';
      if (form.password !== form.passwordConfirm) return '비밀번호가 서로 다릅니다.';
    }
    if (role === 'producer' && step === 1 && !form.orgType) return '소속 유형을 선택해 주세요.';
    return '';
  }

  async function next(event: React.FormEvent) {
    event.preventDefault();
    const problem = stepProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    if (!form.agreeTerms || !form.agreePrivacy) {
      setError('필수 약관에 동의해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/signup', {
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

  const last = step === steps.length - 1;

  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
        <Link className="button button-outline sm" href="/login">
          로그인
        </Link>
      </header>
      <section className="auth-card wizard">
        <ol className="wizard-steps">
          {steps.map((label, index) => (
            <li key={label} className={index === step ? 'on' : index < step ? 'done' : ''}>
              <b>{index < step ? '✓' : index + 1}</b>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <form className="auth-form wizard-body" onSubmit={next}>
          <h1>{role === 'producer' ? '제작자 회원가입' : '배우 회원가입'}</h1>
          <p className="muted">
            {step === 0
              ? '프로젝트를 위한 첫 걸음, 기본 정보를 입력해 주세요.'
              : role === 'producer' && step === 1
                ? '배우에게 보여질 소속과 활동 정보를 알려 주세요.'
                : '서비스 이용을 위한 약관에 동의해 주세요.'}
          </p>
          {step === 0 && (
            <>
              <label>
                이름 <em>*</em>
                <input
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="name"
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
              <div className="form-two">
                <label>
                  비밀번호 <em>*</em>
                  <input
                    type="password"
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="new-password"
                    placeholder="영문+숫자 8자 이상"
                  />
                </label>
                <label>
                  비밀번호 확인 <em>*</em>
                  <input
                    type="password"
                    value={form.passwordConfirm}
                    onChange={set('passwordConfirm')}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            </>
          )}
          {role === 'producer' && step === 1 && (
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
                  placeholder="예: 봄날 필름, 한빛대 영화과"
                />
              </label>
              <p className="small-note">
                학교·제작사 인증은 가입한 뒤 ‘내 정보 → 제작진 인증’에서 할 수 있어요. 인증을 받으면
                공고에 인증 표시가 붙어요.
              </p>
            </>
          )}
          {last && (
            <div className="agree-box">
              <label className="check">
                <input type="checkbox" checked={form.agreeTerms} onChange={set('agreeTerms')} />
                <span>
                  <b>[필수]</b> 서비스 이용약관 동의
                </span>
              </label>
              <label className="check">
                <input type="checkbox" checked={form.agreePrivacy} onChange={set('agreePrivacy')} />
                <span>
                  <b>[필수]</b> 개인정보 수집·이용 동의 (이름, 이메일, 연락처
                  {role === 'actor' ? ', 프로필 사진·영상' : ', 소속'})
                </span>
              </label>
              {role === 'actor' && (
                <p className="small-note">
                  프로필은 기본적으로 제작자 검색에 공개되며, 프로필 관리에서 언제든 비공개로 바꿀
                  수 있습니다.
                </p>
              )}
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="wizard-actions">
            {step > 0 ? (
              <button
                type="button"
                className="button button-outline"
                onClick={() => setStep(step - 1)}
              >
                이전
              </button>
            ) : (
              <Link className="button button-outline" href="/signup">
                이전
              </Link>
            )}
            <button className="button button-primary" disabled={busy}>
              {last ? (busy ? '가입 중…' : '가입 완료') : '다음 단계 →'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
