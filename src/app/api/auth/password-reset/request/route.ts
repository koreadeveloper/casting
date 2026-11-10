import { NextRequest, NextResponse } from 'next/server';
import { mailConfigured, sendMail } from '@/lib/mail';
import { passwordLoginEnabled } from '@/lib/password';
import { createPasswordReset } from '@/lib/password-reset';
import {
  RESEND_COOLDOWN_SECONDS,
  RESET_SENT_MESSAGE,
  resetLink,
  resetMail,
} from '@/lib/password-reset-rules';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';
import { requiredText, validEmail } from '@/lib/validation';

/**
 * 비밀번호 재설정 메일 요청. 가입된 이메일인지와 상관없이 항상 같은 답을 준다(계정 존재 여부를 드러내지 않는다).
 * 같은 이메일은 60초에 한 번·하루 5번, 한 IP는 1시간에 10번까지만 실제로 보낸다.
 */
export async function POST(request: NextRequest) {
  if (!passwordLoginEnabled())
    return NextResponse.json({ error: '지금은 비밀번호 재설정을 쓸 수 없어요.' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const email = requiredText(body.email, 254).toLowerCase();
  if (!validEmail(email))
    return NextResponse.json({ error: '이메일 주소를 확인해 주세요.' }, { status: 400 });
  if (await overLimit(`reset-ip:${clientIp(request.headers)}`, 10, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  // 같은 이메일로 너무 자주 보내면 메일만 건너뛰고 답은 똑같이 준다.
  const tooSoon =
    (await overLimit(`reset-email:${email}`, 1, RESEND_COOLDOWN_SECONDS)) ||
    (await overLimit(`reset-email-day:${email}`, 5, 24 * 3600));
  if (!tooSoon) {
    const created = await createPasswordReset(email);
    if (created) {
      const origin = process.env.APP_URL || request.nextUrl.origin;
      const mail = resetMail(resetLink(origin, created.token));
      if (mailConfigured()) {
        await sendMail({ to: created.user.email, ...mail }).catch((error) =>
          console.error('비밀번호 재설정 메일 실패', error),
        );
      } else {
        // 개발 중(메일 설정 없음)에는 서버 로그로 링크를 남긴다.
        console.info(`[mail] to=${created.user.email} subject=${mail.subject}\n${mail.text}`);
      }
    }
  }
  return NextResponse.json({ ok: true, message: RESET_SENT_MESSAGE });
}
