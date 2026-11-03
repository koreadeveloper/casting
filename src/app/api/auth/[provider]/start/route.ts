import { NextRequest, NextResponse } from 'next/server';
import { hasSetup } from '@/lib/auth';
import {
  authorizeUrl,
  callbackUrl,
  isProvider,
  newState,
  pkcePair,
  providerConfig,
  providerEnabled,
  safeNext,
  sealPayload,
} from '@/lib/oauth';
import { clientIp, overLimit } from '@/lib/rate-limit';
import { cookieOptions, socialSecret, STATE_COOKIE, STATE_TTL } from '@/lib/social-login';

// 구글·카카오 로그인 시작: state와 PKCE 값을 서명 쿠키에 담고 제공자의 인증 화면으로 보낸다.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const origin = request.nextUrl.origin;
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, origin));
  if (!isProvider(provider) || !providerEnabled(provider) || !hasSetup())
    return fail('social-unavailable');
  if (await overLimit(`social-start:${clientIp(request.headers)}`, 60, 600))
    return fail('too-many');

  const { verifier, challenge } = pkcePair();
  const state = newState();
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const response = NextResponse.redirect(
    authorizeUrl(provider, {
      clientId: providerConfig(provider).clientId,
      redirectUri: callbackUrl(origin, provider),
      state,
      challenge,
    }),
  );
  response.cookies.set(
    STATE_COOKIE,
    sealPayload({ provider, state, verifier, next }, socialSecret(), STATE_TTL),
    cookieOptions('/api/auth', STATE_TTL),
  );
  return response;
}
