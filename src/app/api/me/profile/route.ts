import { NextRequest, NextResponse } from 'next/server';
import {
  getProfileFull,
  MAX_DOCUMENTS,
  safeDocumentRef,
  updateProfile,
  type ProfileDocument,
} from '@/lib/accounts';
import { getActorId } from '@/lib/auth';
import {
  cleanList,
  IMAGE_TAGS,
  MAX_SKILLS,
  MAX_TAGS,
  REGIONS,
  SKILLS,
  type Filmography,
  type Gender,
} from '@/lib/profile';
import { requiredText, safeImageRef, safeUrl } from '@/lib/validation';
import { manAge } from '@/lib/age';

function intIn(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return value !== '' && value != null && Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

export async function GET() {
  const actorId = await getActorId();
  if (!actorId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  return NextResponse.json({ profile: await getProfileFull(actorId) });
}

export async function PUT(request: NextRequest) {
  const actorId = await getActorId();
  if (!actorId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const gender: Gender = ['female', 'male', 'other'].includes(body.gender) ? body.gender : '';
  const region = requiredText(body.region, 20);
  const filmography: Filmography[] = Array.isArray(body.filmography)
    ? body.filmography
        .map((item: Record<string, unknown>) => ({
          year: requiredText(item?.year, 4),
          title: requiredText(item?.title, 100),
          role: requiredText(item?.role, 60),
        }))
        .filter((item: Filmography) => item.title)
        .slice(0, 30)
    : [];
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .map((item: unknown) => safeImageRef(item))
    .filter(Boolean)
    .slice(0, 8);
  const documents: ProfileDocument[] = (Array.isArray(body.documents) ? body.documents : [])
    .map((item: Record<string, unknown>) => ({
      name: requiredText(item?.name, 120) || '첨부 자료',
      url: safeDocumentRef(item?.url),
    }))
    .filter((doc: ProfileDocument) => doc.url)
    .slice(0, MAX_DOCUMENTS);
  // 생년월일이 맞게 들어오면 출생연도도 그 연도로 맞춘다. 없으면 예전처럼 출생연도만 저장한다.
  const birthDate =
    typeof body.birthDate === 'string' &&
    body.birthDate >= '1930-01-01' &&
    manAge(body.birthDate) !== null
      ? body.birthDate
      : '';
  // 생년월일을 넣었는데 받을 수 없는 날짜면, 말없이 버리지 않고 알려 준다(출생 연도만 남는 일을 막는다).
  if (typeof body.birthDate === 'string' && body.birthDate.trim() && !birthDate)
    return NextResponse.json(
      { error: '생년월일을 확인해 주세요. 1930년 이후, 만 1세 이상인 날짜만 저장할 수 있어요.' },
      { status: 400 },
    );
  const birthYear = birthDate
    ? Number(birthDate.slice(0, 4))
    : intIn(body.birthYear, 1930, new Date().getFullYear());
  const name = requiredText(body.name, 60);
  if (!name) return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 });
  const profile = await updateProfile(actorId, {
    name,
    gender,
    birthYear,
    birthDate,
    height: intIn(body.height, 100, 230),
    weight: intIn(body.weight, 25, 200),
    region: REGIONS.includes(region) ? region : '',
    intro: requiredText(body.intro, 2000),
    tags: cleanList(body.tags, IMAGE_TAGS, MAX_TAGS),
    skills: cleanList(body.skills, SKILLS, MAX_SKILLS),
    photos,
    videoUrl: safeUrl(body.videoUrl),
    filmography,
    unavailableDates: cleanList(body.unavailableDates, null, 60).filter((date) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date),
    ),
    isPublic: body.isPublic !== false,
    agency: requiredText(body.agency, 60),
    documents,
  });
  return NextResponse.json({ profile });
}
