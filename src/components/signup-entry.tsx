import { cookies } from 'next/headers';
import Link from 'next/link';
import { Brand } from './brand';
import { SocialButtons } from './social-buttons';
import SignupForm from './signup-form';
import { isProvider, openPayload, PROVIDER_LABEL, providerEnabled } from '@/lib/oauth';
import { PENDING_COOKIE, socialSecret } from '@/lib/social-login';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal';
import { emailSignupEnabled } from '@/lib/password';

type Pending = { provider: string; email: string; name: string };

const TITLE = { producer: '제작자 회원가입', actor: '배우 회원가입' };

/** 역할별 가입 화면. 소셜 계정을 연결하기 전에는 버튼을, 연결한 뒤에는 정보 입력 폼을 보여 준다. */
export default async function SignupEntry({
  role,
  then = '',
  method = '',
}: {
  role: 'producer' | 'actor';
  /** 가입을 마친 뒤 돌아갈 화면(배우만) */
  then?: string;
  /** 'email'이면 이메일 가입 양식(메일 발송 설정이 있을 때만) */
  method?: string;
}) {
  const emailSignup = emailSignupEnabled();
  const pending = openPayload<Pending>(
    (await cookies()).get(PENDING_COOKIE)?.value,
    socialSecret(),
  );
  if (pending && isProvider(pending.provider))
    return (
      <SignupForm
        role={role}
        providerLabel={PROVIDER_LABEL[pending.provider]}
        name={pending.name}
        email={pending.email}
        then={then}
      />
    );

  if (method === 'email' && emailSignup)
    return (
      <SignupForm role={role} providerLabel="이메일" name="" email="" then={then} mode="email" />
    );

  const enabled = providerEnabled('google');
  const emailHref = `/signup/${role}?method=email${then ? `&then=${encodeURIComponent(then)}` : ''}`;
  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
        <Link className="button button-outline sm" href="/login">
          로그인
        </Link>
      </header>
      <section className="auth-card">
        <h1>{TITLE[role]}</h1>
        <p className="muted">
          {emailSignup
            ? 'Google 계정이나 이메일로 가입해요.'
            : 'Google 계정으로 간편하게 가입해요.'}
        </p>
        {enabled ? (
          <SocialButtons
            only={['google']}
            next={`/signup/${role}${then ? `?then=${encodeURIComponent(then)}` : ''}`}
          />
        ) : (
          !emailSignup && (
            <p className="form-error">지금은 가입할 수 없어요. 잠시 뒤에 다시 시도해 주세요.</p>
          )
        )}
        {emailSignup && (
          <a className="button button-outline full" href={emailHref}>
            이메일로 가입하기
          </a>
        )}
        <p className="small-note center">
          다음 화면에서 이름·연락처 등 몇 가지만 더 입력하면 가입이 끝나요.{' '}
          <Link href="/signup">역할 다시 고르기</Link>
        </p>
        {/* 가입 전에 약관 전문을 미리 볼 수 있게 한다(동의는 다음 화면에서 받는다). */}
        <p className="small-note center signup-legal">
          가입 전에 확인해 주세요:{' '}
          <Link href={TERMS_PATH} target="_blank" rel="noopener">
            이용약관
          </Link>{' '}
          ·{' '}
          <Link href={PRIVACY_PATH} target="_blank" rel="noopener">
            개인정보처리방침
          </Link>
        </p>
      </section>
    </main>
  );
}
