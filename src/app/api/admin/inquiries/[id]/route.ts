import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { deleteInquiry, getInquiry, updateInquiry } from '@/lib/admin-inquiries';
import { logAdmin } from '@/lib/admin-log';
import { INQUIRY_KINDS, INQUIRY_STATUS, isInquiryStatus } from '@/lib/inquiry';

type Context = { params: Promise<{ id: string }> };

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function target(context: Context) {
  const admin = await getAdmin();
  if (!admin) return { error: fail('관리자만 할 수 있어요.', 403) };
  const inquiry = await getInquiry((await context.params).id);
  if (!inquiry) return { error: fail('문의를 찾지 못했어요.', 404) };
  return { admin, inquiry };
}

// 상태 바꾸기·메모 남기기
export async function PATCH(request: NextRequest, context: Context) {
  const found = await target(context);
  if ('error' in found) return found.error;
  const { admin, inquiry } = found;
  const body = await request.json().catch(() => ({}));
  const label = `${INQUIRY_KINDS[inquiry.kind]} · ${inquiry.email}`;
  const status: unknown = body.status;
  if (status !== undefined) {
    if (!isInquiryStatus(status)) return fail('상태가 맞지 않아요.', 400);
    await updateInquiry(inquiry.id, { status });
    await logAdmin(
      admin,
      'inquiry_status',
      { type: 'inquiry', id: inquiry.id, label },
      `${INQUIRY_STATUS[inquiry.status]} → ${INQUIRY_STATUS[status]}`,
    );
  }
  if (typeof body.note === 'string') {
    await updateInquiry(inquiry.id, { note: body.note.trim() });
    await logAdmin(admin, 'inquiry_note', { type: 'inquiry', id: inquiry.id, label });
  }
  return NextResponse.json({ ok: true });
}

// 문의 삭제(되돌릴 수 없음). 화면에서 한 번 더 묻는다.
export async function DELETE(_request: NextRequest, context: Context) {
  const found = await target(context);
  if ('error' in found) return found.error;
  const { admin, inquiry } = found;
  await deleteInquiry(inquiry.id);
  await logAdmin(admin, 'inquiry_delete', {
    type: 'inquiry',
    id: inquiry.id,
    label: `${INQUIRY_KINDS[inquiry.kind]} · ${inquiry.email}`,
  });
  return NextResponse.json({ ok: true });
}
