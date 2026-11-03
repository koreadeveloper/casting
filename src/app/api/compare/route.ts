import { NextRequest, NextResponse } from 'next/server';
import { getProfile, listFavoriteIds, listPublicProfiles } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { MIN_CANDIDATES } from '@/lib/compare';
import { listApplications, roleOwnedBy } from '@/lib/db';
import { profileAge, type ActorProfile } from '@/lib/profile';
import { reviewLabels, type Application } from '@/lib/types';

type Candidate = {
  id: string;
  name: string;
  age: number | null;
  photo: string;
  intro: string;
  meta: string;
  /** 성별. 비로그인 지원처럼 알 수 없으면 빈 문자열 — 이때는 걸러내지 않고 남긴다. */
  gender: string;
};

async function fromApplication(application: Application): Promise<Candidate> {
  const meta = [
    reviewLabels[application.status] ?? application.status,
    application.shortlist ? '후보' : '',
    application.skill,
  ]
    .filter(Boolean)
    .join(' · ');
  // 지원서 자체에는 성별이 없다. 계정에 연결된 지원자만 프로필에서 가져온다.
  const profile = application.actorId ? await getProfile(application.actorId) : null;
  return {
    id: application.id,
    name: application.name,
    age: application.age,
    photo: application.photoUrl,
    intro: application.introduction,
    meta,
    gender: profile?.gender ?? '',
  };
}

function fromProfile(profile: ActorProfile): Candidate {
  return {
    id: profile.userId,
    name: profile.name,
    age: profileAge(profile),
    photo: profile.photos[0] ?? '',
    intro: profile.intro,
    meta: [profile.region, ...profile.tags.slice(0, 3)].filter(Boolean).join(' · '),
    gender: profile.gender,
  };
}

export async function GET(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  const source = request.nextUrl.searchParams.get('source') || 'role';
  const gender = request.nextUrl.searchParams.get('gender') || '';
  let candidates: Candidate[];

  // 지원서에서 가져오는 소스들 — 팀 보드의 단계 구분과 같은 기준을 쓴다.
  if (source === 'role' || source === 'passed' || source === 'final') {
    const roleId = request.nextUrl.searchParams.get('roleId') || '';
    if (!roleId) return NextResponse.json({ error: '배역을 선택해 주세요.' }, { status: 400 });
    if (!(await roleOwnedBy(roleId, producerId)))
      return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
    const applications = (await listApplications(roleId)).filter(
      (application) => !['excluded', 'rejected'].includes(application.status),
    );
    const picked =
      source === 'final'
        ? applications.filter((application) => application.shortlist)
        : source === 'passed'
          ? applications.filter(
              (application) => application.status === 'interested' && !application.shortlist,
            )
          : applications;
    candidates = await Promise.all(picked.map(fromApplication));
  } else if (source === 'favorites') {
    const profiles = await Promise.all(
      (await listFavoriteIds(producerId)).map((actorId) => getProfile(actorId)),
    );
    candidates = profiles
      .filter((profile): profile is ActorProfile => Boolean(profile))
      .map(fromProfile);
  } else if (source === 'actors') {
    candidates = (await listPublicProfiles()).map(fromProfile);
  } else {
    return NextResponse.json({ error: '지원하지 않는 후보 소스입니다.' }, { status: 400 });
  }

  // 성별을 고르면 반대 성별만 뺀다. 성별을 알 수 없는 후보는 남겨서 임의로 탈락시키지 않는다.
  const unknownGender =
    gender === 'female' || gender === 'male'
      ? candidates.filter((candidate) => !candidate.gender).length
      : 0;
  if (gender === 'female' || gender === 'male')
    candidates = candidates.filter((candidate) => !candidate.gender || candidate.gender === gender);

  if (candidates.length < MIN_CANDIDATES)
    return NextResponse.json(
      { error: `비교할 후보가 ${MIN_CANDIDATES}명 이상 필요합니다.` },
      { status: 400 },
    );
  return NextResponse.json({ candidates, unknownGender });
}
