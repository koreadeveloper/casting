import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { logAdmin } from '@/lib/admin-log';
import {
  getBusinessVerification,
  markVerificationReviewed,
  revokeVerificationById,
} from '@/lib/admin-verifications';

type Context = { params: Promise<{ id: string }> };

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// 제작사 인증 확인: action 'review'(문제없음) | 'revoke'(인증 취소)
export async function PATCH(request: NextRequest, context: Context) {
  const admin = await getAdmin();
  if (!admin) return fail('관리자만 할 수 있어요.', 403);
  const item = await getBusinessVerification((await context.params).id);
  if (!item) return fail('이미 취소됐거나 찾을 수 없는 인증이에요.', 404);
  const body = await request.json().catch(() => ({}));
  const target = {
    type: 'member' as const,
    id: item.userId,
    label: `${item.memberName || item.memberEmail} · 제작사 인증 ${item.orgName}`,
  };
  if (body.action === 'review') {
    await markVerificationReviewed(item.id);
    await logAdmin(admin, 'verify_review', target, '문제없음');
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'revoke') {
    await revokeVerificationById(item.id, '관리자가 확인한 뒤 인증을 취소했어요');
    await logAdmin(admin, 'unverify', target, '인증 확인함에서 취소');
    return NextResponse.json({ ok: true });
  }
  return fail('요청이 맞지 않아요.', 400);
}
