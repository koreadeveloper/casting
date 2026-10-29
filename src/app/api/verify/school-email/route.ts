import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendMail } from '@/lib/mail';
import { overLimit, TOO_MANY } from '@/lib/rate-limit';
import { requiredText } from '@/lib/validation';
import { aiConfigured } from '@/lib/verification-ai';
import { schoolEmailDomain } from '@/lib/verification-rules';
import { createSchoolEmailCode, EMAIL_CODE_MINUTES } from '@/lib/verifications';

/** 학교 이메일(.ac.kr)로 6자리 확인 코드를 보낸다. 본문: { schoolName, email } */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'producer')
    return NextResponse.json({ error: '제작자로 로그인해 주세요.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const schoolName = requiredText(body.schoolName, 60);
  const email = requiredText(body.email, 120).toLowerCase();
  const domain = schoolEmailDomain(email);
  if (!schoolName) return NextResponse.json({ error: '학교 이름을 적어 주세요.' }, { status: 400 });
  if (!domain)
    return NextResponse.json(
      { error: '학교에서 받은 이메일(…@학교.ac.kr)만 쓸 수 있어요.' },
      { status: 400 },
    );
  if (!aiConfigured())
    return NextResponse.json({ error: '자동 확인이 아직 설정되지 않았어요.' }, { status: 503 });
  if (await overLimit(`verify-mail:${user.id}`, 5, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const { id, code } = await createSchoolEmailCode(user.id, schoolName, email, domain);
  try {
    await sendMail({
      to: email,
      subject: '[캐스팅플로우] 학교 이메일 확인 코드',
      text: `학교 인증 확인 코드: ${code}\n\n${EMAIL_CODE_MINUTES}분 안에 캐스팅플로우 인증 화면에 입력해 주세요.\n직접 요청하지 않았다면 이 메일은 무시해 주세요.`,
    });
  } catch (error) {
    console.error('학교 인증 메일 발송 실패', error);
    return NextResponse.json(
      { error: '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 502 },
    );
  }
  return NextResponse.json({ id, minutes: EMAIL_CODE_MINUTES });
}
