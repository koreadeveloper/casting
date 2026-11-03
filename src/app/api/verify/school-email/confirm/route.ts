import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requiredText } from '@/lib/validation';
import { checkSchoolEmailCode, finishSchoolEmail, findSchoolForDomain } from '@/lib/verifications';

/**
 * 학교 메일 확인 코드를 맞춘 뒤, 적은 학교 이름이 메일 도메인의 학교와 같은지 학교 목록(DB)으로 확인해 승인한다.
 * 코드를 보낼 때 이미 확인했지만, 그사이 목록이 바뀌었을 수 있어 한 번 더 본다.
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
  const school = await findSchoolForDomain(checked.domain);
  const approved = Boolean(school);
  const reason = approved
    ? ''
    : `메일 주소(${checked.domain})의 학교를 확인하지 못했어요. 재학증명서로 인증해 주세요.`;
  const orgName = school?.schoolName || checked.schoolName;
  await finishSchoolEmail(id, approved, orgName, reason);
  return NextResponse.json({
    verdict: { approved, reasons: reason ? [reason] : [], orgName },
  });
}
