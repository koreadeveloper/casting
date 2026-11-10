import { NextRequest, NextResponse } from 'next/server';
import { sealPayload } from '@/lib/oauth';
import { checkResetToken } from '@/lib/password-reset';
import {
  isTokenShape,
  RECOVERY_COOKIE,
  RECOVERY_TTL_MS,
  recoveryNext,
} from '@/lib/password-reset-rules';
import { cookieOptions } from '@/lib/social-login';

/**
 * 메일의 재설정 링크가 오는 곳. 토큰이 쓸 수 있으면 짧은 복구 쿠키를 주고 /reset-password로 보낸다.
 * 링크를 연 브라우저에서 바로 확인하므로, 요청한 브라우저와 달라도 된다.
 * 여기서는 토큰을 쓰지 않고 확인만 한다(메일 앱의 링크 미리보기가 먼저 열어도 링크가 사라지지 않게).
 * 실제로 쓰는 것은 새 비밀번호를 저장할 때다.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = params.get('token');
  const fail = () =>
    NextResponse.redirect(new URL('/forgot-password?error=expired', request.nextUrl.origin));
  if (params.get('type') !== 'recovery' || !isTokenShape(token)) return fail();
  const tokenHash = await checkResetToken(token);
  if (!tokenHash) return fail();
  const response = NextResponse.redirect(
    new URL(recoveryNext(params.get('next')), request.nextUrl.origin),
  );
  response.cookies.set(
    RECOVERY_COOKIE,
    sealPayload({ h: tokenHash }, process.env.SESSION_SECRET || '', RECOVERY_TTL_MS),
    cookieOptions('/', RECOVERY_TTL_MS),
  );
  // 주소창·기록에 토큰이 남지 않게 한다.
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
