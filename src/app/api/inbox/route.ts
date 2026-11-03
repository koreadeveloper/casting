import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { actorInbox, producerInbox } from '@/lib/inbox';

/** 채팅 목록: 공고별 폴더와 그 안의 방들. 제작진은 팀 내부방과 배우와의 방, 배우는 제작진과의 방. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const inbox =
    session.role === 'producer'
      ? await producerInbox(session.userId)
      : await actorInbox(session.userId);
  return NextResponse.json(
    { ...inbox, viewer: session.role, me: session.userId },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
