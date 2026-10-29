import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requiredText } from '@/lib/validation';
import { checkSchoolDomain, VerificationUnavailable } from '@/lib/verification-ai';
import { checkSchoolEmailCode, finishSchoolEmail } from '@/lib/verifications';

/**
 * 학교 메일 확인 코드를 맞춘 뒤, 적은 학교 이름이 메일 도메인의 학교와 같은지 AI로 확인해 승인한다.
 * 본문: { id, code }
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'producer')
    return NextResponse.json({ error: '제작자로 로그인해 주세요.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = requiredText(body.id, 60);
  const code = requiredText(body.code, 10);
  const checked = await checkSchoolEmailCode(user.id, id, code);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const school = await checkSchoolDomain(checked.schoolName, checked.domain);
    const reason = school.matches
      ? ''
      : `적은 학교(${checked.schoolName})와 메일 주소의 학교(${school.official_name || checked.domain})가 달라요.`;
    await finishSchoolEmail(
      id,
      school.matches,
      school.matches ? school.official_name || checked.schoolName : checked.schoolName,
      reason,
    );
    return NextResponse.json({
      verdict: {
        approved: school.matches,
        reasons: reason ? [reason] : [],
        orgName: school.official_name || checked.schoolName,
      },
    });
  } catch (error) {
    // AI 확인이 잠시 안 되면 코드는 살아 있으니 다시 누르면 된다.
    if (error instanceof VerificationUnavailable)
      return NextResponse.json({ error: error.message }, { status: 503 });
    throw error;
  }
}
