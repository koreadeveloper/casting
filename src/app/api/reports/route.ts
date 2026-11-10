import { NextRequest, NextResponse } from 'next/server';
import { LEGAL } from '@/lib/legal';
import { mailConfigured, sendMail } from '@/lib/mail';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';
import { REPORT_REASONS, REPORT_TARGETS, parseReport } from '@/lib/report-rules';
import { createReport, reportedRecently, resolveReportTarget } from '@/lib/reports';

/**
 * 신고 접수. 대상과 신고할 자격은 서버에서 다시 확인하고(lib/reports.ts), 화면이 보낸 대상 이름은 쓰지 않는다.
 * 먼저 DB에 저장하고(메일이 실패해도 신고가 사라지지 않게), 메일이 설정돼 있으면 팀 문의 메일로도 알린다.
 * 신고한 사람의 정보는 신고당한 사람에게 알리지 않는다.
 */
export async function POST(request: NextRequest) {
  if (await overLimit(`report-ip:${clientIp(request.headers)}`, 10, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const target = await resolveReportTarget(raw.type, raw.id, raw.receipt);
  if (!target)
    return NextResponse.json(
      { error: '신고할 대상을 찾지 못했어요. 문의하기로 알려 주세요.' },
      { status: 404 },
    );
  const parsed = parseReport(raw, target.type, target.side, target.reporterEmail);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (await reportedRecently(target, parsed.email))
    return NextResponse.json(
      { error: '이미 신고를 받았어요. 같은 대상은 하루에 한 번만 신고할 수 있어요.' },
      { status: 409 },
    );
  await createReport(target, parsed);

  if (mailConfigured() && LEGAL.contact.includes('@')) {
    const origin = process.env.APP_URL || request.nextUrl.origin;
    try {
      await sendMail({
        to: LEGAL.contact,
        subject: `[캐스팅플로우 신고] ${REPORT_TARGETS[target.type]} · ${REPORT_REASONS[parsed.reason]}`,
        text: `대상: ${REPORT_TARGETS[target.type]} · ${target.label}\n사유: ${REPORT_REASONS[parsed.reason]}\n보낸 사람: ${parsed.email}\n\n${parsed.body}\n\n처리하기: ${origin}/admin/reports`,
      });
    } catch (error) {
      // 신고는 이미 저장됐으므로 보낸 사람에게는 접수 완료로 알린다.
      console.error('신고 알림 메일 발송 실패', error);
    }
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
