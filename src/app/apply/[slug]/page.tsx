import { notFound } from 'next/navigation';
import { getProducerIntro, getProfile, getProject, getUserById } from '@/lib/accounts';
import { getActorId } from '@/lib/auth';
import { getRole } from '@/lib/db';
import { ageOf } from '@/lib/profile';
import { getProducerBadges } from '@/lib/verifications';
import ApplyForm, { type Prefill } from './apply-form';

export const dynamic = 'force-dynamic';

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ proposal?: string }>;
}) {
  const { slug } = await params;
  const { proposal } = await searchParams;
  const role = await getRole(slug);
  if (!role) notFound();
  const actorId = await getActorId();
  let prefill: Prefill | null = null;
  if (actorId) {
    const user = await getUserById(actorId);
    const profile = await getProfile(actorId);
    if (user && profile)
      prefill = {
        name: profile.name,
        email: user.email,
        phone: user.phone,
        age: ageOf(profile.birthYear),
        introduction: [
          profile.intro,
          ...profile.filmography.map((f) => `${f.year} ${f.title} ${f.role}`),
        ]
          .filter(Boolean)
          .join('\n'),
        photoUrl: profile.photos[0] || '',
        // 프로필에 올려 둔 사진 전부. 공고마다 대표 사진을 바꿔 낼 수 있게 그대로 넘긴다.
        photos: profile.photos,
        videoUrl: profile.videoUrl,
        skill: profile.skills.join(', '),
        // 배역 촬영일 중 하루라도 출연 불가일이면 미리 알려 준다.
        unavailable: role.shootDates.some((day) => profile.unavailableDates.includes(day)),
      };
  }
  return (
    <ApplyForm
      role={role}
      project={role.projectId ? await getProject(role.projectId) : null}
      prefill={prefill}
      producer={role.ownerId ? await getProducerIntro(role.ownerId) : null}
      trust={role.ownerId ? (await getProducerBadges([role.ownerId])).get(role.ownerId) : undefined}
      proposalId={actorId && proposal && /^[\w-]{8,60}$/.test(proposal) ? proposal : ''}
    />
  );
}
