import { NextRequest, NextResponse } from 'next/server';
import { getAdmin, listMembers } from '@/lib/admin';
import { logAdmin } from '@/lib/admin-log';
import { METHOD_LABEL, matchesMember, toCsv, type MemberFilter } from '@/lib/admin-rules';

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | '' =>
  allowed.includes(value as T) ? (value as T) : '';

// 회원 목록 CSV. 화면에서 고른 조건(검색어·가입 방식·역할·상태)을 그대로 받아 같은 회원만 내보낸다.
export async function GET(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 할 수 있어요.' }, { status: 403 });
  const params = request.nextUrl.searchParams;
  const filter: MemberFilter = {
    query: (params.get('q') || '').slice(0, 100),
    method: pick(params.get('method'), ['email', 'google', 'kakao', 'none'] as const),
    role: pick(params.get('role'), ['producer', 'actor'] as const),
    status: pick(params.get('status'), ['active', 'suspended'] as const),
  };
  const members = (await listMembers()).filter((member) => matchesMember(member, filter));
  const csv = toCsv([
    [
      '이름',
      '이메일',
      '역할',
      '가입 방식',
      '가입일',
      '메일 확인',
      '상태',
      '제작진 인증',
      '소속',
      '연락처',
      'ID',
    ],
    ...members.map((m) => [
      m.name,
      m.email,
      m.role === 'producer' ? '제작진' : '배우',
      m.methods.map((method) => METHOD_LABEL[method]).join(' / ') || '없음',
      m.createdAt.slice(0, 10),
      m.emailVerified ? '확인됨' : '미확인',
      m.suspendedAt ? `정지 ${m.suspendedAt.slice(0, 10)}` : '정상',
      m.badges.map((badge) => badge.label).join(' / '),
      m.orgName,
      m.phone,
      m.id,
    ]),
  ]);
  const conditions = [
    filter.query && `검색 "${filter.query}"`,
    filter.method,
    filter.role,
    filter.status,
  ]
    .filter(Boolean)
    .join(', ');
  await logAdmin(
    admin,
    'export',
    { type: 'member', label: `${members.length}명` },
    conditions || '전체',
  );
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="members-${day}.csv"; filename*=UTF-8''${encodeURIComponent(`회원목록-${day}.csv`)}`,
      'Cache-Control': 'no-store',
    },
  });
}
