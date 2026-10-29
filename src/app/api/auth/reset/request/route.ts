import { NextRequest, NextResponse } from 'next/server';
import { getUserWithHash } from '@/lib/accounts';
import { mailConfigured, sendMail } from '@/lib/mail';
import { createResetToken, RESET_TTL_MINUTES } from '@/lib/password-reset';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';
import { requiredText, validEmail } from '@/lib/validation';

// 가입 여부를 알려 주지 않도록, 계정이 없어도 같은 응답을 돌려준다.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = requiredText(body.email, 254).toLowerCase();
  if (!validEmail(email))
    return NextResponse.json({ error: '이메일 형식을 확인해 주세요.' }, { status: 400 });
  if (
    (await overLimit(`reset-ip:${clientIp(request.headers)}`, 10, 3600)) ||
    (await overLimit(`reset:${email}`, 3, 3600))
  )
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  // 메일 발송이 설정되지 않은 배포에서는 계정 유무와 상관없이 똑같이 안내한다(가입 여부를 드러내지 않게).
  if (process.env.NODE_ENV === 'production' && !mailConfigured())
    return NextResponse.json(
      { error: '지금은 재설정 메일을 보낼 수 없어요. 잠시 후 다시 시도해 주세요.' },
      { status: 503 },
    );
  const found = await getUserWithHash(email);
  if (found && !email.endsWith('@demo.casting')) {
    const token = await createResetToken(found.user.id);
    const origin = process.env.APP_URL || request.nextUrl.origin;
    try {
      await sendMail({
        to: email,
        subject: '[캐스팅플로우] 비밀번호 재설정 안내',
        text: `안녕하세요, ${found.user.name}님.\n\n아래 링크에서 새 비밀번호를 설정해 주세요. 링크는 ${RESET_TTL_MINUTES}분 동안 한 번만 쓸 수 있습니다.\n\n${origin}/reset?token=${token}\n\n요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.`,
      });
    } catch (error) {
      console.error('비밀번호 재설정 메일 발송 실패', error);
      return NextResponse.json(
        { error: '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.' },
        { status: 502 },
      );
    }
  }
  return NextResponse.json({ ok: true, minutes: RESET_TTL_MINUTES });
}
