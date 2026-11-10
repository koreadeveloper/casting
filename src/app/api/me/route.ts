import { NextRequest, NextResponse } from 'next/server';
import { nameChanged, readAccountEdit } from '@/lib/account-edit';
import { deleteAccount, getUserWithHash, updateAccountInfo } from '@/lib/accounts';
import { endSession, getCurrentUser } from '@/lib/auth';
import { deletionConfirmed, hasPassword } from '@/lib/password';
import { revokeNameCheckedSchool } from '@/lib/verifications';

// 제작자 계정 정보(이름·소속 유형·소속명) 고치기. 배우 이름은 프로필 편집에서 바꾼다.
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'producer')
    return NextResponse.json({ error: '제작자로 로그인해 주세요.' }, { status: 401 });
  if (user.email.endsWith('@demo.casting'))
    return NextResponse.json({ error: '체험 계정은 정보를 바꿀 수 없습니다.' }, { status: 403 });
  const read = readAccountEdit(await request.json().catch(() => ({})), user.orgType);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  await updateAccountInfo(user.id, read.value);
  const revoked = nameChanged(user.name, read.value.name)
    ? await revokeNameCheckedSchool(user.id)
    : 0;
  return NextResponse.json({ ok: true, schoolRevoked: revoked > 0 });
}

// 회원 탈퇴. 본인 확인을 위해 비밀번호(소셜 로그인 계정은 이메일)를 다시 받는다.
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (user.email.endsWith('@demo.casting'))
    return NextResponse.json({ error: '체험 계정은 탈퇴할 수 없습니다.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const found = await getUserWithHash(user.email);
  if (!found || !deletionConfirmed(body, { email: user.email, passwordHash: found.passwordHash }))
    return NextResponse.json(
      {
        error:
          found && !hasPassword(found.passwordHash)
            ? '이메일 주소가 맞지 않습니다.'
            : '비밀번호가 맞지 않습니다.',
      },
      { status: 401 },
    );
  await deleteAccount(user.id);
  await endSession();
  return NextResponse.json({ ok: true });
}
