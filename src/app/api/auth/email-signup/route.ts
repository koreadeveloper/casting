import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/accounts';
import { hasSetup, homeFor, startSession } from '@/lib/auth';
import { claimApplications } from '@/lib/db';
import { safeThen } from '@/lib/oauth';
import { passwordLoginEnabled } from '@/lib/password';
import { consumeSignupCode } from '@/lib/password-reset';
import { newPasswordProblem } from '@/lib/password-reset-rules';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';
import { requiredText, validEmail } from '@/lib/validation';

/** 이메일 가입 마무리: 메일로 받은 인증번호를 확인한 뒤 비밀번호가 있는 계정을 만든다. */
export async function POST(request: NextRequest) {
  if (!passwordLoginEnabled() || !hasSetup())
    return NextResponse.json({ error: '지금은 이메일로 가입할 수 없어요.' }, { status: 503 });
  if (await overLimit(`email-signup:${clientIp(request.headers)}`, 20, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const role = body.role === 'producer' ? 'producer' : body.role === 'actor' ? 'actor' : null;
  const email = requiredText(body.email, 254).toLowerCase();
  const name = requiredText(body.name, 60);
  const code = requiredText(body.code, 10);
  if (!role) return NextResponse.json({ error: '역할을 선택해 주세요.' }, { status: 400 });
  if (!validEmail(email))
    return NextResponse.json({ error: '이메일 주소를 확인해 주세요.' }, { status: 400 });
  if (!name) return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 });
  if (!/^\d{6}$/.test(code))
    return NextResponse.json(
      { error: '메일로 받은 인증번호 6자리를 입력해 주세요.' },
      { status: 400 },
    );
  const problem = newPasswordProblem(body.password, body.confirm);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (body.agreeTerms !== true || body.agreePrivacy !== true)
    return NextResponse.json({ error: '필수 약관에 동의해 주세요.' }, { status: 400 });
  if (role === 'producer' && !requiredText(body.orgType, 40))
    return NextResponse.json({ error: '소속 유형을 선택해 주세요.' }, { status: 400 });

  const checked = await consumeSignupCode(email, code);
  if (checked !== 'ok')
    return NextResponse.json(
      {
        error:
          checked === 'wrong'
            ? '인증번호가 맞지 않아요. 다시 확인해 주세요.'
            : '인증번호가 만료됐어요. 인증번호를 다시 받아 주세요.',
      },
      { status: 400 },
    );
  // 인증번호는 가입되지 않은 이메일에만 보내지만, 그 사이에 가입된 경우를 한 번 더 막는다.
  if (await getUserByEmail(email))
    return NextResponse.json(
      { error: '이미 가입된 이메일이에요. 로그인하거나 비밀번호 찾기를 이용해 주세요.' },
      { status: 409 },
    );
  const user = await createUser({
    email,
    password: String(body.password),
    role,
    name,
    phone: requiredText(body.phone, 30),
    orgType: requiredText(body.orgType, 40),
    orgName: requiredText(body.orgName, 100),
    emailVerified: true,
  });
  await startSession({ userId: user.id, role: user.role });
  if (role === 'actor') await claimApplications(user.id, email);
  const then = safeThen(body.then);
  return NextResponse.json(
    { ok: true, next: role === 'actor' ? then || '/me/profile' : homeFor(role) },
    { status: 201 },
  );
}
