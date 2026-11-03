import { notFound, redirect } from 'next/navigation';
import { getProfileFull, listFavoriteIds, listProducerProposals } from '@/lib/accounts';
import { getSession } from '@/lib/auth';
import { listRoles } from '@/lib/db';
import { producerView } from '@/lib/profile';
import ActorDetail from './actor-detail';

export const dynamic = 'force-dynamic';

export default async function ActorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/actors/${id}`);
  const isSelf = session.role === 'actor' && session.userId === id;
  if (session.role !== 'producer' && !isSelf) notFound();
  const profile = await getProfileFull(id);
  if (!profile || (!profile.isPublic && !isSelf)) notFound();
  const producer = session.role === 'producer';
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActorDetail
      // 제작진에게는 생년월일·출연 불가 날짜를 넘기지 않는다(본인이 보는 미리보기는 그대로).
      profile={producer ? producerView(profile) : profile}
      viewer={producer ? 'producer' : 'self'}
      favorite={producer && (await listFavoriteIds(session.userId)).includes(id)}
      roles={
        producer
          ? (await listRoles(session.userId))
              .filter((role) => !role.isClosed && role.deadline >= today)
              .map((role) => ({ id: role.id, label: `${role.projectTitle} · ${role.title}` }))
          : []
      }
      proposedRoleIds={
        producer ? (await listProducerProposals(session.userId, id)).map((p) => p.roleId) : []
      }
    />
  );
}
