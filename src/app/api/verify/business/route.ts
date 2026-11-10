import { NextRequest, NextResponse } from 'next/server';
import { setOrgName } from '@/lib/accounts';
import { getCurrentUser } from '@/lib/auth';
import { NtsUnavailable, validateBusiness } from '@/lib/nts';
import { businessInputProblems, judgeBusiness } from '@/lib/nts-rules';
import { overLimit, TOO_MANY } from '@/lib/rate-limit';
import { kstToday } from '@/lib/result-deadline';
import { requiredText } from '@/lib/validation';
import { saveDocumentVerdict } from '@/lib/verifications';

/**
 * 제작사 인증: 사업자등록번호·대표자 성명·개업일자·상호를 국세청 진위확인 서비스로 조회해 바로 판정한다.
 * 대표자 성명·개업일자는 저장하지 않고, 판정 결과(상호, 번호 앞 5자리, 승인 여부, 이유)만 남긴다.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'producer')
    return NextResponse.json({ error: '제작자로 로그인해 주세요.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const input = {
    businessNumber: requiredText(body.businessNumber, 20),
    ownerName: requiredText(body.ownerName, 40),
    openDate: requiredText(body.openDate, 10),
    companyName: requiredText(body.companyName, 100),
  };
  const problems = businessInputProblems(input, kstToday());
  if (problems.length) return NextResponse.json({ error: problems[0] }, { status: 400 });
  // 남의 사업자 정보를 바꿔 가며 맞춰 보는 일을 막는다.
  if (await overLimit(`verify-biz:${user.id}`, 8, 24 * 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  try {
    const nts = await validateBusiness(input);
    const verdict = judgeBusiness(input, nts);
    await saveDocumentVerdict(user.id, 'business', verdict, 'nts');
    // 인증된 상호를 가입 정보의 소속명으로 맞춘다(공고의 소속 표기와 인증 표시가 같아지게).
    if (verdict.approved) await setOrgName(user.id, verdict.orgName);
    return NextResponse.json({ verdict });
  } catch (error) {
    if (error instanceof NtsUnavailable)
      return NextResponse.json({ error: error.message }, { status: 503 });
    throw error;
  }
}
