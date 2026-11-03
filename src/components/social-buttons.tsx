import { headers } from 'next/headers';
import { detectInAppBrowser } from '@/lib/in-app-browser';
import { PROVIDERS, providerEnabled, type Provider } from '@/lib/oauth';
import { InAppBrowserNotice, SocialLink } from './in-app-browser';

const LABEL: Record<Provider, string> = { google: 'Google로 계속하기', kakao: '카카오로 계속하기' };

/**
 * 키가 설정된 제공자의 로그인 버튼만 보여 준다. 하나도 없으면 아무것도 그리지 않는다.
 * 구글은 카카오톡·인스타그램 같은 앱 안의 브라우저에서 로그인을 막으므로, 그런 브라우저면 안내를 붙인다.
 */
export async function SocialButtons({
  next,
  only,
}: {
  next?: string;
  /** 지정하면 이 제공자의 버튼만 보여 준다(가입 화면은 구글만). */
  only?: Provider[];
}) {
  const enabled = PROVIDERS.filter(
    (provider) => providerEnabled(provider) && (!only || only.includes(provider)),
  );
  if (!enabled.length) return null;
  const inApp = enabled.includes('google')
    ? detectInAppBrowser((await headers()).get('user-agent'))
    : null;
  const query = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <div className="social-buttons">
      {inApp && <InAppBrowserNotice kind={inApp} />}
      {enabled.map((provider) => (
        <SocialLink
          key={provider}
          className={`social-button ${provider}`}
          href={`/api/auth/${provider}/start${query}`}
          // 카카오 로그인은 카카오톡 안에서도 되므로 구글만 바깥 브라우저로 보낸다.
          inApp={provider === 'google' ? inApp : null}
        >
          <span className="social-mark" aria-hidden="true">
            {provider === 'google' ? 'G' : 'K'}
          </span>
          {LABEL[provider]}
        </SocialLink>
      ))}
    </div>
  );
}

export const SOCIAL_NOTICE: Record<string, string> = {
  'social-unavailable': '이 로그인 방법은 지금 사용할 수 없어요.',
  'social-failed': '로그인하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  'social-cancelled': '로그인을 취소했어요.',
  'email-taken': '이미 이메일로 가입된 계정이에요. 이메일과 비밀번호로 로그인해 주세요.',
  'too-many': '요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.',
};
