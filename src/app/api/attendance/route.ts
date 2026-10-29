import { NextRequest, NextResponse } from 'next/server';
import { isAttendanceAskOpen } from '@/lib/attendance';
import { getApplicationByReceipt, getRoleById, recordAttendance } from '@/lib/db';
import { kstToday } from '@/lib/result-deadline';
import { requiredText } from '@/lib/validation';

/**
 * 출연 확정된 배우가 촬영 참석 여부를 답한다. 지원 현황 주소의 토큰으로 본인을 확인한다.
 * 본문: { receipt, shootDate, status: 'yes' | 'no', note }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const receipt = requiredText(body.receipt, 100);
  const application = receipt.length >= 40 ? await getApplicationByReceipt(receipt) : null;
  if (!application)
    return NextResponse.json({ error: '지원 정보를 찾을 수 없습니다.' }, { status: 403 });
  if (application.publicStage !== 'cast')
    return NextResponse.json(
      { error: '출연이 확정된 경우에만 참석 여부를 답할 수 있습니다.' },
      { status: 409 },
    );
  const role = await getRoleById(application.roleId);
  const shootDate = requiredText(body.shootDate, 10);
  if (!role || !role.shootDates.includes(shootDate))
    return NextResponse.json({ error: '촬영일을 다시 확인해 주세요.' }, { status: 400 });
  if (!isAttendanceAskOpen(shootDate, kstToday()))
    return NextResponse.json(
      { error: '참석 확인은 촬영 3일 전부터 촬영 당일까지 할 수 있습니다.' },
      { status: 409 },
    );
  const status = body.status === 'no' ? 'no' : body.status === 'yes' ? 'yes' : null;
  if (!status) return NextResponse.json({ error: '참석 여부를 골라 주세요.' }, { status: 400 });
  const note = status === 'no' ? requiredText(body.note, 300) : '';
  if (status === 'no' && !note)
    return NextResponse.json(
      { error: '제작진이 대처할 수 있게 사유를 짧게 적어 주세요.' },
      { status: 400 },
    );
  const check = await recordAttendance(application, shootDate, status, note);
  return NextResponse.json({ check });
}
