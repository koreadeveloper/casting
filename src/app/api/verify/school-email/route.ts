import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { mailAvailable, sendMail } from '@/lib/mail';
import { overLimit, TOO_MANY } from '@/lib/rate-limit';
import { requiredText } from '@/lib/validation';
import { emailDomain, sameSchoolName } from '@/lib/school-domains';
import {
  createSchoolEmailCode,
  EMAIL_CODE_MINUTES,
  findSchoolForDomain,
} from '@/lib/verifications';

/**
 * 학교 이메일로 6자리 확인 코드를 보낸다. 본문: { schoolName, email }
 * 메일 도메인이 학교 목록(DB)에 있고, 적은 학교 이름이 그 학교와 같을 때만 보낸다.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'producer')
    return NextResponse.json({ error: '제작자로 로그인해 주세요.' }, { status: 401 });
  if (!mailAvailable())
    return NextResponse.json(
      { error: '학교 메일 인증은 준비 중이에요. 재학증명서로 인증해 주세요.' },
      { status: 503 },
    );
  const body = await request.json().catch(() => ({}));
  const schoolName = requiredText(body.schoolName, 60);
  const email = requiredText(body.email, 120).toLowerCase();
  const domain = emailDomain(email);
  if (!schoolName) return NextResponse.json({ error: '학교 이름을 적어 주세요.' }, { status: 400 });
  if (!domain) return NextResponse.json({ error: '이메일 주소를 확인해 주세요.' }, { status: 400 });
  const school = await findSchoolForDomain(domain);
  if (!school)
    return NextResponse.json(
      {
        error:
          '아직 등록되지 않은 학교 메일이에요. 재학증명서로 인증하거나, 학교 메일 주소를 확인해 주세요.',
      },
      { status: 400 },
    );
  if (!sameSchoolName(schoolName, school))
    return NextResponse.json(
      { error: `메일 주소는 ${school.schoolName} 것이에요. 학교 이름을 다시 확인해 주세요.` },
      { status: 400 },
    );
  if (await overLimit(`verify-mail:${user.id}`, 5, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const { id, code } = await createSchoolEmailCode(user.id, school.schoolName, email, domain);
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
