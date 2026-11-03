// 소셜 로그인 라우트들이 같이 쓰는 서버 전용 도우미(쿠키 이름·시크릿·사용자 정보 읽기).

import { providerConfig, callbackUrl, normalizeProfile, type Provider } from './oauth';

export const STATE_COOKIE = 'cs_oauth';
export const PENDING_COOKIE = 'cs_social';
export const STATE_TTL = 10 * 60 * 1000;
export const PENDING_TTL = 20 * 60 * 1000;

export function socialSecret() {
  return process.env.SESSION_SECRET || '';
}

export function cookieOptions(path: string, maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path,
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

/** 인가 코드를 토큰으로 바꾸고, 그 토큰으로 사용자 정보를 읽는다. 실패하면 null. */
export async function fetchSocialProfile(
  provider: Provider,
  input: { code: string; verifier: string; origin: string },
) {
  const config = providerConfig(provider);
  const tokenResponse = await fetch(config.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: callbackUrl(input.origin, provider),
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: input.verifier,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenResponse.ok) return null;
  const token = (await tokenResponse.json().catch(() => null)) as { access_token?: string } | null;
  if (!token?.access_token) return null;
  const infoResponse = await fetch(config.userinfo, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!infoResponse.ok) return null;
  const raw = await infoResponse.json().catch(() => null);
  return raw && typeof raw === 'object' ? normalizeProfile(provider, raw) : null;
}
