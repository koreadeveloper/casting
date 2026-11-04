import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChatThread from '@/components/chat-thread';
import { getApplicationByReceipt, getRoleById } from '@/lib/db';
import { projectCover } from '@/lib/project-meta';

export const dynamic = 'force-dynamic';

/**
 * 배우가 제작진과 나누는 대화. 지원 현황 화면 아래에 붙어 있으면 휴대폰에서 스크롤이 두 겹이 되고
 * 입력창이 가려져서, 화면 전체를 쓰는 대화 화면으로 따로 뺐다.
 */
export default async function StatusChatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const application = await getApplicationByReceipt(token);
  if (!application) notFound();
  const role = await getRoleById(application.roleId);
  if (!role) notFound();
  const back = `/status/${token}`;
  return (
    <main className="app-shell narrow chat-page">
      <header className="sub-header">
        <Link className="sh-back" href={back} aria-label="지원 현황으로">
          ‹
        </Link>
        <h1>{role.contactName || '제작진'}</h1>
        <span className="sh-more" />
      </header>
      {/* 배우는 제작진이 먼저 말을 걸지 않아도 문의를 시작할 수 있다 */}
      <section className="chat-page-body">
        <ChatThread
          applicationId={application.id}
          mode="actor"
          receipt={token}
          peerName={role.contactName}
          peerSub={`${role.projectTitle} · ${role.title}`}
          projectTitle={role.projectTitle}
          roleTitle={role.title}
          projectImage={role.coverUrl || projectCover('')}
          profileHref={`/apply/${role.slug}`}
        />
      </section>
    </main>
  );
}
