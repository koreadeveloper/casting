// 프로젝트 등록·수정 요청 본문을 검사해 저장할 값으로 바꾼다. 등록(POST)과 수정(PATCH)이 같이 쓴다.
import type { ProjectConditions, ProjectInput, RoleEdit } from './accounts';
import {
  FORMATS,
  GENRE_TAGS,
  isPosterUrl,
  PERKS,
  PRODUCTION_TYPES,
  PROJECT_REGIONS,
  RELEASE_CHANNELS,
  ROLE_GENDERS,
  ROLE_TYPES,
  NO_SPECIAL_SCENE,
  normalizeSpecialScenes,
  pickKnown,
} from './project-meta';
import { isIsoDate, normalizeDates, resolveRoleDates } from './schedule';
import { requiredText } from './validation';

export const MAX_ROLES = 20;

type Parsed =
  | { ok: true; project: ProjectInput; conditions: ProjectConditions; roles: RoleEdit[] }
  | { ok: false; error: string };

function optionalDate(value: unknown) {
  const text = requiredText(value, 10);
  return isIsoDate(text) ? text : '';
}

function intIn(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

/** 시작~종료 기간 검사. 둘 다 비어도 되고, 둘 다 있으면 종료가 시작 이후여야 한다. */
function period(startValue: unknown, endValue: unknown) {
  const start = optionalDate(startValue);
  const end = optionalDate(endValue);
  return { start, end, valid: !start || !end || end >= start };
}

export function parseProjectBody(body: Record<string, unknown>): Parsed {
  const title = requiredText(body.title, 100);
  if (!title) return { ok: false, error: '작품명을 입력해 주세요.' };
  const genre = requiredText(body.genre, 40);
  if (!FORMATS.includes(genre)) return { ok: false, error: '형식을 골라 주세요.' };

  const region = requiredText(body.region, 10);
  if (!PROJECT_REGIONS.includes(region))
    return { ok: false, error: '촬영 지역(시·도)을 골라 주세요.' };
  const locationDetail = requiredText(body.locationDetail, 80);
  if (!locationDetail && region !== '미정')
    return { ok: false, error: '촬영 지역의 상세 위치를 입력해 주세요.' };

  const audition = period(body.auditionStart, body.auditionEnd);
  const prep = period(body.prepStart, body.prepEnd);
  if (!audition.valid) return { ok: false, error: '오디션 종료일이 시작일보다 빠릅니다.' };
  if (!prep.valid) return { ok: false, error: '리딩·리허설 종료일이 시작일보다 빠릅니다.' };
  const shootStart = optionalDate(body.shootStart);
  if (!shootStart) return { ok: false, error: '촬영 시작일을 입력해 주세요.' };
  const shootEndInput = optionalDate(body.shootEnd);
  if (shootEndInput && shootEndInput < shootStart)
    return { ok: false, error: '촬영 종료일이 시작일보다 빠릅니다.' };
  const shootEnd = shootEndInput || shootStart;

  const project: ProjectInput = {
    title,
    genre,
    genres: pickKnown(body.genres, GENRE_TAGS),
    productionType: Object.hasOwn(PRODUCTION_TYPES, String(body.productionType))
      ? String(body.productionType)
      : '',
    runtime: requiredText(body.runtime, 40),
    releaseChannels: pickKnown(body.releaseChannels, Object.keys(RELEASE_CHANNELS)),
    releasePeriod: requiredText(body.releasePeriod, 40),
    company: requiredText(body.company, 60),
    director: requiredText(body.director, 60),
    producerName: requiredText(body.producerName, 60),
    logline: requiredText(body.logline, 120),
    region,
    auditionStart: audition.start,
    auditionEnd: audition.end,
    prepStart: prep.start,
    prepEnd: prep.end,
    shootStart,
    shootEnd,
    shootSessions: intIn(body.shootSessions, 0, 365, 0),
    location: locationDetail ? `${region} ${locationDetail}` : region,
    description: requiredText(body.description, 2000),
    perks: pickKnown(body.perks, Object.keys(PERKS)),
    // 포스터는 업로드 라우트가 준 사진 주소만 받는다. 아니면 비워서 형식별 기본 커버를 쓴다.
    posterUrl: isPosterUrl(body.posterUrl) ? body.posterUrl : '',
  };

  const deadline = optionalDate(body.deadline);
  const announcementDate = optionalDate(body.announcementDate);
  const pay = requiredText(body.pay, 100);
  const contactName = requiredText(body.contactName, 100);
  if (!deadline || !announcementDate)
    return { ok: false, error: '지원 마감일과 결과 안내일을 입력해 주세요.' };
  if (announcementDate < deadline)
    return { ok: false, error: '결과 안내일은 지원 마감일 이후여야 합니다.' };
  if (!pay) return { ok: false, error: '출연료·교통·식비 조건을 입력해 주세요.' };
  if (!contactName) return { ok: false, error: '담당자를 입력해 주세요.' };

  const rawRoles = Array.isArray(body.roles) ? body.roles.slice(0, MAX_ROLES) : [];
  const roles: RoleEdit[] = [];
  for (const raw of rawRoles as Record<string, unknown>[]) {
    const roleTitle = requiredText(raw?.title, 100);
    const description = requiredText(raw?.description, 2000);
    if (!roleTitle && !description) continue; // 비워 둔 배역 칸은 건너뛴다
    if (!roleTitle || !description)
      return { ok: false, error: '배역명과 배역 설명을 모두 입력해 주세요.' };
    const ageMin = intIn(raw.ageMin, 0, 100, 0);
    const ageMax = intIn(raw.ageMax, 0, 100, 0);
    if (ageMin > 0 && ageMax > 0 && ageMax < ageMin)
      return { ok: false, error: `'${roleTitle}'의 연령대를 확인해 주세요.` };
    const shootMode = raw.shootMode === 'custom' ? 'custom' : 'all';
    if (shootMode === 'custom' && normalizeDates(raw.shootDates).length === 0)
      return { ok: false, error: `'${roleTitle}'의 촬영일을 하나 이상 골라 주세요.` };
    const roleType = String(raw.roleType ?? '');
    const gender = String(raw.gender ?? '');
    // 특수 장면 안내는 공고 필수 항목이다. '없음'이라도 꼭 골라야 한다.
    const specialScenes = normalizeSpecialScenes(raw.specialScenes);
    if (specialScenes.length === 0)
      return {
        ok: false,
        error: `'${roleTitle}'의 특수 장면 안내를 골라 주세요. 없으면 '특수 장면 없음'을 고르면 돼요.`,
      };
    const id = requiredText(raw.id, 60);
    roles.push({
      ...(id ? { id } : {}),
      ...(typeof raw.isClosed === 'boolean' ? { isClosed: raw.isClosed } : {}),
      title: roleTitle,
      description,
      requirement: requiredText(raw.requirement, 500),
      roleType: (Object.hasOwn(ROLE_TYPES, roleType) ? roleType : '') as RoleEdit['roleType'],
      gender: (Object.hasOwn(ROLE_GENDERS, gender) ? gender : '') as RoleEdit['gender'],
      ageMin,
      ageMax,
      headcount: intIn(raw.headcount, 1, 999, 1),
      specialScenes,
      specialNote: specialScenes[0] === NO_SPECIAL_SCENE ? '' : requiredText(raw.specialNote, 500),
      shootMode,
      // 일괄 적용이면 작품 촬영 기간을 날짜로 펼쳐 저장한다(추천·지원 화면이 날짜를 바로 쓴다).
      shootDates: resolveRoleDates(shootMode, raw.shootDates, shootStart, shootEnd),
    });
  }
  if (roles.length === 0) return { ok: false, error: '배역을 하나 이상 입력해 주세요.' };

  return { ok: true, project, conditions: { pay, deadline, announcementDate, contactName }, roles };
}
