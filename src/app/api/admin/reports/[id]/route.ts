import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { logAdmin } from '@/lib/admin-log';
import { REPORT_STATUS, REPORT_TARGETS, isReportStatus } from '@/lib/report-rules';
import { deleteReport, getReport, updateReport } from '@/lib/reports';

type Context = { params: Promise<{ id: string }> };

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function target(context: Context) {
  const admin = await getAdmin();
  if (!admin) return { error: fail('관리자만 할 수 있어요.', 403) };
  const report = await getReport((await context.params).id);
  if (!report) return { error: fail('신고를 찾지 못했어요.', 404) };
  return { admin, report };
}

// 상태 바꾸기·메모 남기기
export async function PATCH(request: NextRequest, context: Context) {
  const found = await target(context);
  if ('error' in found) return found.error;
  const { admin, report } = found;
  const body = await request.json().catch(() => ({}));
  const label = `${REPORT_TARGETS[report.targetType]} · ${report.targetLabel}`;
  const status: unknown = body.status;
  if (status !== undefined) {
    if (!isReportStatus(status)) return fail('상태가 맞지 않아요.', 400);
    await updateReport(report.id, { status });
    await logAdmin(
      admin,
      'report_status',
      { type: 'report', id: report.id, label },
      `${REPORT_STATUS[report.status]} → ${REPORT_STATUS[status]}`,
    );
  }
  if (typeof body.note === 'string') {
    await updateReport(report.id, { note: body.note.trim() });
    await logAdmin(admin, 'report_note', { type: 'report', id: report.id, label });
  }
  return NextResponse.json({ ok: true });
}

// 신고 삭제(되돌릴 수 없음). 화면에서 한 번 더 묻는다.
export async function DELETE(_request: NextRequest, context: Context) {
  const found = await target(context);
  if ('error' in found) return found.error;
  const { admin, report } = found;
  await deleteReport(report.id);
  await logAdmin(admin, 'report_delete', {
    type: 'report',
    id: report.id,
    label: `${REPORT_TARGETS[report.targetType]} · ${report.targetLabel}`,
  });
  return NextResponse.json({ ok: true });
}
