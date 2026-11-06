import { NextRequest, NextResponse } from 'next/server';
import { getUserWithHash } from '@/lib/accounts';
import { endSession, hasSetup, homeFor, startSession } from '@/lib/auth';
import { claimApplications } from '@/lib/db';
import { passwordLoginEnabled, verifyPassword } from '@/lib/password';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  if (!hasSetup())
    return NextResponse.json({ error: 'SESSION_SECRET이 설정되지 않았습니다.' }, { status: 503 });
  if (!passwordLoginEnabled())
    return NextResponse.json({ error: 'Google 계정으로 로그인해 주세요.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const email = requiredText(body.email, 254).toLowerCase();
  // 체험용 계정은 비밀번호가 공개돼 있으므로 운영 배포에서는 체험 모드일 때만 들어갈 수 있다.
  if (
    email.endsWith('@demo.casting') &&
    process.env.NODE_ENV === 'production' &&
    process.env.DEMO_MODE !== 'true'
  )
    return NextResponse.json({ error: '이메일 또는 비밀번호가 맞지 않습니다.' }, { status: 401 });
  const ip = clientIp(request.headers);
  if ((await overLimit(`login-ip:${ip}`, 30, 600)) || (await overLimit(`login:${email}`, 10, 600)))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const found = await getUserWithHash(email);
  if (!found || !verifyPassword(String(body.password || ''), found.passwordHash))
    return NextResponse.json({ error: '이메일 또는 비밀번호가 맞지 않습니다.' }, { status: 401 });
  await startSession({ userId: found.user.id, role: found.user.role });
  // 로그아웃 상태로 낸 지원서를 이 계정에 붙인다 ('내 지원 현황'에서 다시 찾을 수 있도록)
  if (found.user.role === 'actor') await claimApplications(found.user.id, found.user.email);
  return NextResponse.json({ ok: true, role: found.user.role, next: homeFor(found.user.role) });
}

export async function DELETE() {
  await endSession();
  return NextResponse.json({ ok: true });
}
