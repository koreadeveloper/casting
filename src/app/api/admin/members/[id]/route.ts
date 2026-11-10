import { NextRequest, NextResponse } from 'next/server';
import { deleteAccount, getUserById } from '@/lib/accounts';
import { getAdmin, setSuspended, unlinkSocial } from '@/lib/admin';
import { isAdminAccount } from '@/lib/admin-rules';
import { grantVerification, revokeVerification } from '@/lib/verifications';

type Context = { params: Promise<{ id: string }> };

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * 관리자가 다룰 수 있는 회원인지 확인한다. 본인·다른 관리자는 여기서 막는다(관리자끼리 서로 정지·삭제하지 않게).
 * 인증 부여처럼 해가 없는 작업은 anyone으로 본인·다른 관리자에게도 허용한다.
 */
async function target(context: Context, anyone = false) {
  const admin = await getAdmin();
  if (!admin) return { error: fail('관리자만 할 수 있어요.', 403) };
  const { id } = await context.params;
  const user = await getUserById(id);
  if (!user) return { error: fail('회원을 찾지 못했어요.', 404) };
  if (anyone) return { user };
  if (user.id === admin.id) return { error: fail('내 계정은 여기서 바꿀 수 없어요.', 400) };
  if (isAdminAccount({ ...user, suspendedAt: null }))
    return {
      error: fail('다른 관리자 계정은 바꿀 수 없어요. ADMIN_EMAILS에서 먼저 빼 주세요.', 400),
    };
  return { user };
}

// 정지·정지 해제·소셜 연결 해제·제작진 인증 부여/취소
export async function PATCH(request: NextRequest, context: Context) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const found = await target(context, action === 'verify' || action === 'unverify');
  if ('error' in found) return found.error;
  if (action === 'verify' || action === 'unverify') {
    if (found.user.role !== 'producer') return fail('제작진 계정에만 인증을 줄 수 있어요.', 400);
    const kind = body.kind === 'school' || body.kind === 'business' ? body.kind : null;
    if (!kind) return fail('인증 종류가 맞지 않아요.', 400);
    if (action === 'unverify') {
      if (!(await revokeVerification(found.user.id, kind)))
        return fail('취소할 인증이 없어요.', 404);
      return NextResponse.json({ ok: true });
    }
    const orgName = String(body.orgName || '')
      .trim()
      .slice(0, 100);
    const detail = String(body.detail || '')
      .trim()
      .slice(0, 100);
    if (!orgName)
      return fail(
        kind === 'school' ? '학교 이름을 적어 주세요.' : '제작사 이름을 적어 주세요.',
        400,
      );
    await grantVerification(found.user.id, kind, orgName, kind === 'school' ? detail : '');
    return NextResponse.json({ ok: true });
  }
  if (action === 'suspend' || action === 'unsuspend') {
    await setSuspended(found.user.id, action === 'suspend');
    return NextResponse.json({ ok: true });
  }
  if (action === 'unlink') {
    const provider = String(body.provider || '');
    if (provider !== 'google' && provider !== 'kakao') return fail('연결 종류가 맞지 않아요.', 400);
    if (!(await unlinkSocial(found.user.id, provider))) return fail('이미 연결이 없어요.', 404);
    return NextResponse.json({ ok: true });
  }
  return fail('알 수 없는 작업이에요.', 400);
}

// 회원 삭제(되돌릴 수 없음). 실수를 막으려고 회원 이메일을 그대로 입력받는다.
export async function DELETE(request: NextRequest, context: Context) {
  const found = await target(context);
  if ('error' in found) return found.error;
  const body = await request.json().catch(() => ({}));
  if (
    String(body.confirmEmail || '')
      .trim()
      .toLowerCase() !== found.user.email.toLowerCase()
  )
    return fail('확인용 이메일이 맞지 않아요.', 400);
  await deleteAccount(found.user.id);
  return NextResponse.json({ ok: true });
}
