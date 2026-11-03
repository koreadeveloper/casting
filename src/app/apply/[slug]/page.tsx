import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getProducerIntro, getProfile, getProject, getUserById } from '@/lib/accounts';
import { getActorId } from '@/lib/auth';
import { getRole } from '@/lib/db';
import { profileAge } from '@/lib/profile';
import { roleShareDescription, roleShareTitle } from '@/lib/share-preview';
import { getProducerBadges } from '@/lib/verifications';
import ApplyForm, { type Prefill } from './apply-form';

export const dynamic = 'force-dynamic';

// 미리보기 제목과 화면이 같은 배역을 두 번 읽지 않도록 한 요청 안에서는 한 번만 읽는다.
const loadRole = cache((slug: string) => getRole(slug));

/**
 * 지원 링크를 카카오톡 등에 공유할 때 보이는 제목·설명. 대표 이미지는 사이트 공통 이미지를 쓴다.
 * 주의: 카카오톡 수집기(kakaotalk-scrap)는 Next의 봇 목록에 없다. 이 화면에 loading.tsx를 넣으면
 * 미리보기 태그가 본문 뒤로 밀려 카톡 미리보기가 빠질 수 있으니, 그때는 next.config의
 * htmlLimitedBots에 kakaotalk-scrap을 더한다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const role = await loadRole((await params).slug);
  if (!role) return { title: '공고를 찾을 수 없어요 · 캐스팅플로우' };
  return { title: roleShareTitle(role), description: roleShareDescription(role) };
}

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ proposal?: string }>;
}) {
  const { slug } = await params;
  const { proposal } = await searchParams;
  const role = await loadRole(slug);
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
        age: profileAge(profile),
        // 프로필에 넣어 둔 생년월일을 지원서 날짜 칸에 그대로 채운다 (예전 프로필은 빈 값).
        birthDate: profile.birthDate,
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
