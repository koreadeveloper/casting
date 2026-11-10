import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/accounts';
import { mailConfigured, sendMail } from '@/lib/mail';
import { passwordLoginEnabled } from '@/lib/password';
import { createSignupCode } from '@/lib/password-reset';
import {
  alreadyRegisteredMail,
  CODE_SENT_MESSAGE,
  RESEND_COOLDOWN_SECONDS,
  signupCodeMail,
} from '@/lib/password-reset-rules';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';
import { requiredText, validEmail } from '@/lib/validation';

/**
 * 이메일 가입 인증번호 보내기. 이미 가입된 이메일이면 번호 대신 '이미 가입돼 있다'는 메일을 보내고,
 * 화면에는 똑같이 안내한다(가입 여부를 화면으로 드러내지 않는다).
 */
export async function POST(request: NextRequest) {
  if (!passwordLoginEnabled())
    return NextResponse.json({ error: '지금은 이메일로 가입할 수 없어요.' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const email = requiredText(body.email, 254).toLowerCase();
  if (!validEmail(email))
    return NextResponse.json({ error: '이메일 주소를 확인해 주세요.' }, { status: 400 });
  if (await overLimit(`signup-code-ip:${clientIp(request.headers)}`, 10, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  if (
    (await overLimit(`signup-code:${email}`, 1, RESEND_COOLDOWN_SECONDS)) ||
    (await overLimit(`signup-code-day:${email}`, 8, 24 * 3600))
  )
    return NextResponse.json({ ok: true, message: CODE_SENT_MESSAGE });
  const origin = process.env.APP_URL || request.nextUrl.origin;
  const mail = (await getUserByEmail(email))
    ? alreadyRegisteredMail(origin)
    : signupCodeMail(await createSignupCode(email));
  if (mailConfigured())
    await sendMail({ to: email, ...mail }).catch((error) =>
      console.error('가입 인증 메일 실패', error),
    );
  else console.info(`[mail] to=${email} subject=${mail.subject}\n${mail.text}`);
  return NextResponse.json({ ok: true, message: CODE_SENT_MESSAGE });
}
