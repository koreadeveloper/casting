import { NextRequest, NextResponse } from 'next/server';
import { createUser, findOAuthUser, getUserByEmail, linkOAuthAccount } from '@/lib/accounts';
import { hasSetup, homeFor, startSession } from '@/lib/auth';
import { claimApplications } from '@/lib/db';
import { isProvider, openPayload } from '@/lib/oauth';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';
import { PENDING_COOKIE, socialSecret } from '@/lib/social-login';
import { requiredText, validEmail } from '@/lib/validation';

type Pending = { provider: string; subject: string; email: string; name: string };

// 소셜 로그인으로 처음 온 사용자의 가입 마무리: 역할·약관 동의를 받아 계정을 만든다.
export async function POST(request: NextRequest) {
  if (!hasSetup())
    return NextResponse.json({ error: 'SESSION_SECRET이 설정되지 않았습니다.' }, { status: 503 });
  if (await overLimit(`social-complete:${clientIp(request.headers)}`, 20, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const pending = openPayload<Pending>(request.cookies.get(PENDING_COOKIE)?.value, socialSecret());
  if (!pending || !isProvider(pending.provider))
    return NextResponse.json(
      { error: '로그인 정보가 만료되었어요. 처음부터 다시 시도해 주세요.' },
      { status: 400 },
    );

  const body = await request.json().catch(() => ({}));
  const role = body.role === 'producer' ? 'producer' : body.role === 'actor' ? 'actor' : null;
  const name = requiredText(body.name, 60) || pending.name;
  const email = pending.email || requiredText(body.email, 254).toLowerCase();
  if (!role) return NextResponse.json({ error: '역할을 선택해 주세요.' }, { status: 400 });
  if (!name) return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 });
  if (!validEmail(email))
    return NextResponse.json({ error: '이메일을 확인해 주세요.' }, { status: 400 });
  if (body.agreeTerms !== true || body.agreePrivacy !== true)
    return NextResponse.json({ error: '필수 약관에 동의해 주세요.' }, { status: 400 });
  if (role === 'producer' && !requiredText(body.orgType, 40))
    return NextResponse.json({ error: '소속 유형을 선택해 주세요.' }, { status: 400 });

  const finish = (user: { id: string; role: 'producer' | 'actor'; email: string }) => {
    const next = user.role === 'actor' ? '/me/profile' : homeFor(user.role);
    const response = NextResponse.json({ ok: true, next }, { status: 201 });
    response.cookies.delete({ name: PENDING_COOKIE, path: '/' });
    return response;
  };

  // 같은 소셜 계정으로 이미 가입됐다면(두 번 눌렀을 때) 그 계정으로 로그인한다.
  const existing = await findOAuthUser(pending.provider, pending.subject);
  if (existing) {
    await startSession({ userId: existing.id, role: existing.role });
    return finish(existing);
  }
  if (await getUserByEmail(email))
    return NextResponse.json(
      { error: '이미 가입된 이메일입니다. 이메일로 로그인해 주세요.' },
      { status: 409 },
    );

  const user = await createUser({
    email,
    role,
    name,
    phone: requiredText(body.phone, 30),
    orgType: requiredText(body.orgType, 40),
    orgName: requiredText(body.orgName, 100),
  });
  await linkOAuthAccount(user.id, pending.provider, pending.subject, email);
  await startSession({ userId: user.id, role: user.role });
  if (role === 'actor') await claimApplications(user.id, email);
  return finish(user);
}
