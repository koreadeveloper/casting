import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ChatInbox from '@/components/chat-inbox';
import ProducerNav from '@/components/producer-nav';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '채팅 · 캐스팅플로우' };

/** 제작진 채팅: 공고별 폴더에 팀 내부방과 배우와의 방을 모은다. */
export default async function StudioChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/studio/chat');
  if (user.role !== 'producer') redirect('/me/chat');
  return (
    <main className="app-shell wide">
      <ProducerNav active="messages" />
      <div className="screen-pad page-top">
        <ChatInbox viewer="producer" />
      </div>
    </main>
  );
}
