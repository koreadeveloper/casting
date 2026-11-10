import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { logAdmin, type AdminAction } from '@/lib/admin-log';
import { getAdminRole, setRoleClosed, setRoleHidden } from '@/lib/admin-roles';

type Context = { params: Promise<{ id: string }> };

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const ACTIONS: Record<string, AdminAction> = {
  hide: 'role_hide',
  unhide: 'role_unhide',
  close: 'role_close',
  reopen: 'role_reopen',
};

// 공고 내리기·다시 올리기·마감·마감 해제. 내리면 배우 쪽 목록·지원 링크·지원 접수가 모두 막힌다.
export async function PATCH(request: NextRequest, context: Context) {
  const admin = await getAdmin();
  if (!admin) return fail('관리자만 할 수 있어요.', 403);
  const role = await getAdminRole((await context.params).id);
  if (!role) return fail('공고를 찾지 못했어요.', 404);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const logAction = ACTIONS[action];
  if (!logAction) return fail('알 수 없는 작업이에요.', 400);
  const reason = String(body.reason || '')
    .trim()
    .slice(0, 300);
  if (action === 'hide' || action === 'unhide') await setRoleHidden(role.id, action === 'hide');
  else await setRoleClosed(role.id, action === 'close');
  await logAdmin(
    admin,
    logAction,
    { type: 'role', id: role.id, label: `${role.projectTitle} · ${role.title}` },
    reason,
  );
  return NextResponse.json({ ok: true });
}
