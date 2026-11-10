import { NextResponse } from 'next/server';
import { getNotice } from '@/lib/site-notice';

// 사이트 공지 띠(모든 화면 맨 위). 켜져 있을 때만 내용을 준다. 잠깐 캐시해서 화면마다 DB를 읽지 않게 한다.
export async function GET() {
  const notice = await getNotice().catch(() => null);
  return NextResponse.json(
    { notice: notice?.on ? notice : null },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  );
}
