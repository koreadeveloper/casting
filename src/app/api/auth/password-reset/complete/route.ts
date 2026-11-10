import { NextRequest, NextResponse } from 'next/server';
import { homeFor, startSession } from '@/lib/auth';
import { openPayload } from '@/lib/oauth';
import { completePasswordReset } from '@/lib/password-reset';
import {
  newPasswordProblem,
  RECOVERY_COOKIE,
  RESET_EXPIRED_MESSAGE,
} from '@/lib/password-reset-rules';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';

/**
 * 새 비밀번호 저장. 복구 쿠키(재설정 링크를 연 브라우저)가 있어야 한다.
 * 저장하면 세션 버전이 올라가 다른 기기는 모두 로그아웃되고, 이 기기는 새 버전으로 로그인한다.
 */
export async function POST(request: NextRequest) {
  if (await overLimit(`reset-complete:${clientIp(request.headers)}`, 20, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const recovery = openPayload<{ h: string }>(
    request.cookies.get(RECOVERY_COOKIE)?.value,
    process.env.SESSION_SECRET || '',
  );
  if (!recovery?.h)
    return NextResponse.json({ error: RESET_EXPIRED_MESSAGE, expired: true }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const problem = newPasswordProblem(body.password, body.confirm);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const user = await completePasswordReset(recovery.h, String(body.password));
  if (!user)
    return NextResponse.json({ error: RESET_EXPIRED_MESSAGE, expired: true }, { status: 400 });
  await startSession({ userId: user.id, role: user.role, version: user.sessionVersion });
  const response = NextResponse.json({ ok: true, next: homeFor(user.role) });
  response.cookies.delete({ name: RECOVERY_COOKIE, path: '/' });
  return response;
}
