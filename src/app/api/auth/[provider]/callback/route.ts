import { NextRequest, NextResponse } from 'next/server';
import { findOAuthUser, getUserByEmail } from '@/lib/accounts';
import { homeFor, startSession } from '@/lib/auth';
import { claimApplications } from '@/lib/db';
import { decideLink, isProvider, openPayload, sealPayload } from '@/lib/oauth';
import { clientIp, overLimit } from '@/lib/rate-limit';
import {
  cookieOptions,
  fetchSocialProfile,
  PENDING_COOKIE,
  PENDING_TTL,
  socialSecret,
  STATE_COOKIE,
} from '@/lib/social-login';

type StateCookie = { provider: string; state: string; verifier: string; next: string };

// 제공자가 돌려보낸 곳: state를 확인하고 사용자 정보를 읽은 뒤 로그인하거나 가입 화면으로 보낸다.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const origin = request.nextUrl.origin;
  const done = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin));
    response.cookies.delete({ name: STATE_COOKIE, path: '/api/auth' });
    return response;
  };
  if (!isProvider(provider)) return done('/login?error=social-failed');
  if (await overLimit(`social-callback:${clientIp(request.headers)}`, 60, 600))
    return done('/login?error=too-many');

  const params = request.nextUrl.searchParams;
  // 사용자가 동의 화면에서 취소한 경우
  if (params.get('error')) return done('/login?error=social-cancelled');

  const saved = openPayload<StateCookie>(request.cookies.get(STATE_COOKIE)?.value, socialSecret());
  const code = params.get('code') || '';
  if (!saved || saved.provider !== provider || !code || saved.state !== params.get('state'))
    return done('/login?error=social-failed');

  try {
    const profile = await fetchSocialProfile(provider, {
      code,
      verifier: saved.verifier,
      origin,
    });
    if (!profile) return done('/login?error=social-failed');

    const linked = await findOAuthUser(provider, profile.subject);
    // 이메일이 확인된 경우에만 같은 이메일의 기존 계정을 찾는다(확인 안 된 이메일은 믿지 않는다).
    const emailOwner =
      !linked && profile.emailVerified ? await getUserByEmail(profile.email) : null;
    const decision = decideLink({
      linkedUserId: linked?.id ?? null,
      emailOwnerId: emailOwner?.id ?? null,
    });

    if (decision.kind === 'email-taken') return done('/login?error=email-taken');

    if (decision.kind === 'login' && linked) {
      await startSession({ userId: linked.id, role: linked.role });
      if (linked.role === 'actor') await claimApplications(linked.id, linked.email);
      const target =
        saved.next &&
        (linked.role === 'producer'
          ? saved.next.startsWith('/studio')
          : !saved.next.startsWith('/studio'))
          ? saved.next
          : homeFor(linked.role);
      return done(target);
    }

    // 처음 온 사용자: 가입 정보와 약관 동의를 받는 화면으로 보낸다(역할을 골랐다면 그 화면으로).
    const response = done(/^\/signup\/(producer|actor)$/.test(saved.next) ? saved.next : '/signup');
    response.cookies.set(
      PENDING_COOKIE,
      sealPayload(
        {
          provider,
          subject: profile.subject,
          // 확인된 이메일만 믿고 넘긴다. 아니면 가입 화면에서 직접 받는다.
          email: profile.emailVerified ? profile.email : '',
          name: profile.name,
        },
        socialSecret(),
        PENDING_TTL,
      ),
      cookieOptions('/', PENDING_TTL),
    );
    return response;
  } catch (error) {
    console.error('소셜 로그인 처리 실패', provider, error);
    return done('/login?error=social-failed');
  }
}
