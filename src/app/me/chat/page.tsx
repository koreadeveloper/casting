import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ActorNav from '@/components/actor-nav';
import ChatInbox from '@/components/chat-inbox';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '채팅 · 캐스팅플로우' };

/** 배우 채팅: 지원한 공고별 폴더에 제작진과의 방을 모은다. */
export default async function ActorChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/me/chat');
  if (user.role !== 'actor') redirect('/studio/chat');
  return (
    <main className="app-shell wide">
      <ActorNav active="chat" actorId={user.id} />
      <div className="screen-pad page-top">
        <ChatInbox viewer="actor" />
      </div>
    </main>
  );
}
