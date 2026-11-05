import type { Metadata } from 'next';
import { APPLICATION_INTRO_MAX } from '@/lib/validation';
import { notFound } from 'next/navigation';
import { isPosterUrl } from '@/lib/project-meta';
import { getProducerIntro, getProfile, getProject, getUserById } from '@/lib/accounts';
import { getActorId } from '@/lib/auth';
import { findActorApplicationToken, getRole } from '@/lib/db';
import { profileAge } from '@/lib/profile';
import { getProducerBadges } from '@/lib/verifications';
import ApplyForm, { type Prefill } from './apply-form';

export const dynamic = 'force-dynamic';

/** 지원 링크를 공유했을 때 보이는 미리보기: 작품·배역·마감과 포스터(없으면 기본 이미지) */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const role = await getRole(slug);
  if (!role) return { title: '공고를 찾을 수 없어요 · 캐스팅플로우' };
  const title = `${role.projectTitle} · ${role.title} 배우 모집`;
  const facts = [
    role.isClosed ? '모집 마감' : `${role.deadline.slice(5).replace('-', '.')} 마감`,
    role.location,
    role.pay,
  ]
    .filter(Boolean)
    .join(' · ');
  const description = `${facts} — 캐스팅플로우에서 조건을 확인하고 바로 지원하세요.`;
  const poster = isPosterUrl(role.coverUrl) ? role.coverUrl : '';
  return {
    title: `${title} · 캐스팅플로우`,
    description,
    openGraph: {
      title,
      description,
      images: poster
        ? [{ url: poster, alt: `${role.projectTitle} 포스터` }]
        : [{ url: '/og.jpg', width: 1200, height: 630, alt: '캐스팅플로우' }],
    },
  };
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
        age: profileAge(profile),
        // 프로필에 넣어 둔 생년월일을 지원서 날짜 칸에 그대로 채운다 (예전 프로필은 빈 값).
        birthDate: profile.birthDate,
        introduction: [
          profile.intro,
          ...profile.filmography.map((f) => `${f.year} ${f.title} ${f.role}`),
        ]
          .filter(Boolean)
          .join('\n')
          // 지원서 소개는 1000자까지라, 프로필에서 채울 때도 그 안으로 맞춘다.
          .slice(0, APPLICATION_INTRO_MAX),
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
      appliedToken={actorId ? await findActorApplicationToken(actorId, role.id) : ''}
      producer={role.ownerId ? await getProducerIntro(role.ownerId) : null}
      trust={role.ownerId ? (await getProducerBadges([role.ownerId])).get(role.ownerId) : undefined}
      proposalId={actorId && proposal && /^[\w-]{8,60}$/.test(proposal) ? proposal : ''}
    />
  );
}
