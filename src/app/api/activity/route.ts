import { NextResponse } from 'next/server';
import { actorFeed, producerFeed } from '@/lib/activity';
import { getProfile } from '@/lib/accounts';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const feed =
    user.role === 'producer'
      ? await producerFeed(user.id)
      : await actorFeed(
          user.id,
          user.role === 'actor' ? await getProfile(user.id) : null,
          user.name,
        );
  return NextResponse.json(feed);
}
