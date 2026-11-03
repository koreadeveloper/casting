// 구글·카카오 로그인(OAuth 2.0 인가 코드 + PKCE)의 순수 로직. DB·Next에 기대지 않아 테스트로 지킨다.
// 서버에서만 쓴다. 시크릿은 환경변수에서만 읽고 브라우저로 내보내지 않는다.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type Provider = 'google' | 'kakao';
export const PROVIDERS: Provider[] = ['google', 'kakao'];

export function isProvider(value: string): value is Provider {
  return value === 'google' || value === 'kakao';
}

export const PROVIDER_LABEL: Record<Provider, string> = { google: '구글', kakao: '카카오' };

const CONFIG = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    idEnv: 'GOOGLE_CLIENT_ID',
    secretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  kakao: {
    authorize: 'https://kauth.kakao.com/oauth/authorize',
    token: 'https://kauth.kakao.com/oauth/token',
    userinfo: 'https://kapi.kakao.com/v2/user/me',
    // 이메일은 카카오 동의항목에서 켠 경우에만 온다. 없으면 가입 화면에서 직접 받는다.
    scope: 'profile_nickname account_email',
    idEnv: 'KAKAO_REST_API_KEY',
    secretEnv: 'KAKAO_CLIENT_SECRET',
  },
} as const;

/** 키가 들어 있는 제공자만 버튼을 보여 준다(키가 없으면 로그인 화면에 나타나지 않는다). */
export function providerEnabled(provider: Provider, env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env[CONFIG[provider].idEnv] && env[CONFIG[provider].secretEnv]);
}

export function providerConfig(provider: Provider, env: NodeJS.ProcessEnv = process.env) {
  const config = CONFIG[provider];
  return {
    ...config,
    clientId: env[config.idEnv] || '',
    clientSecret: env[config.secretEnv] || '',
  };
}

export function callbackUrl(origin: string, provider: Provider) {
  return `${origin}/api/auth/${provider}/callback`;
}

// --- 서명된 짧은 쿠키(state·가입 대기 정보) ---

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** 값을 JSON으로 묶어 만료 시각과 서명을 붙인다. 쿠키에 넣어 서버가 나중에 되읽는다. */
export function sealPayload(value: object, secret: string, ttlMs: number, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...value, exp: now + ttlMs })).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function openPayload<T extends object>(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): (T & { exp: number }) | null {
  if (!token || secret.length < 24) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return typeof value?.exp === 'number' && value.exp >= now ? value : null;
  } catch {
    return null;
  }
}

// --- PKCE ---

export function newState() {
  return randomBytes(24).toString('base64url');
}

export function pkcePair() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function authorizeUrl(
  provider: Provider,
  input: { clientId: string; redirectUri: string; state: string; challenge: string },
) {
  const config = CONFIG[provider];
  const url = new URL(config.authorize);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', input.state);
  url.searchParams.set('code_challenge', input.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // 구글은 계정을 고르게 하고, 카카오는 기본 동작을 쓴다.
  if (provider === 'google') url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

// --- 제공자가 돌려준 사용자 정보 ---

export type SocialProfile = {
  provider: Provider;
  /** 제공자 안에서 바뀌지 않는 사용자 번호(구글 sub, 카카오 id) */
  subject: string;
  email: string;
  /** 제공자가 이메일 주인임을 확인해 준 경우만 true */
  emailVerified: boolean;
  name: string;
};

type Raw = Record<string, unknown>;

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeProfile(provider: Provider, raw: Raw): SocialProfile | null {
  if (provider === 'google') {
    const subject = text(raw.sub, 100);
    if (!subject) return null;
    const email = text(raw.email, 254).toLowerCase();
    return {
      provider,
      subject,
      email,
      emailVerified: raw.email_verified === true && Boolean(email),
      name: text(raw.name, 60) || text(raw.given_name, 60),
    };
  }
  const id = raw.id;
  const subject = typeof id === 'number' || typeof id === 'string' ? String(id).slice(0, 100) : '';
  if (!subject) return null;
  const account = (raw.kakao_account ?? {}) as Raw;
  const profile = (account.profile ?? {}) as Raw;
  const email = text(account.email, 254).toLowerCase();
  return {
    provider,
    subject,
    email,
    emailVerified: account.is_email_valid === true && account.is_email_verified === true && !!email,
    name: text(profile.nickname, 60),
  };
}

// --- 로그인 결정 ---

export type LinkDecision =
  /** 이미 이 소셜 계정으로 가입함 → 바로 로그인 */
  | { kind: 'login'; userId: string }
  /** 같은 이메일로 이미 가입한 계정이 있음 → 자동으로 합치지 않고 이메일 로그인을 안내 */
  | { kind: 'email-taken' }
  /** 처음 오는 사용자 → 역할·동의를 받고 가입 */
  | { kind: 'signup' };

/**
 * 소셜 로그인 결과를 어떻게 처리할지 정한다.
 * 이메일이 같다는 이유로 기존 계정에 자동으로 붙이지 않는다. 이 서비스는 이메일 가입 때 메일 주인을
 * 확인하지 않아서, 남이 먼저 만든 계정에 붙으면 그 사람이 비밀번호로 계속 들어올 수 있기 때문이다.
 */
export function decideLink(input: {
  linkedUserId: string | null;
  emailOwnerId: string | null;
}): LinkDecision {
  if (input.linkedUserId) return { kind: 'login', userId: input.linkedUserId };
  if (input.emailOwnerId) return { kind: 'email-taken' };
  return { kind: 'signup' };
}

/** 로그인 후 돌아갈 곳. 같은 사이트 안의 경로만 허용한다(열린 리디렉션 방지). */
export function safeNext(value: unknown) {
  const next = typeof value === 'string' ? value : '';
  return /^\/(?!\/)[\w\-./?=&%]*$/.test(next) && !next.startsWith('/api/') ? next : '';
}
