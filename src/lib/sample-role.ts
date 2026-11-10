// 배우 화면에 늘 보이는 '예시 공고' 한 개. 공고가 어떻게 보이는지 미리 보여 주려는 것이라
// DB에 넣지 않고 코드에만 둔다. 상세 화면은 열리지만 지원은 받지 않는다(/apply/sample).
// (리프 모듈 유지: node --test에서 바로 불러오도록 lib 내부 값 import를 두지 않는다)
import type { OpenRoleListing } from './db';

/** 예시 공고 주소(/apply/sample). 실제 공고 주소는 16자리 무작위 글자라 겹치지 않는다. */
export const SAMPLE_ROLE_SLUG = 'sample';

export function isSampleRoleSlug(slug: string) {
  return slug === SAMPLE_ROLE_SLUG;
}

/** YYYY-MM-DD에 날짜를 더한다(시간대와 관계없이 달력 날짜로 계산). */
function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 오늘 기준으로 날짜를 잡은 예시 공고. 마감·촬영일이 늘 앞으로 남아 있어 '모집 중'으로 보인다. */
export function sampleRole(today: string): OpenRoleListing {
  const shootDates = [addDays(today, 28), addDays(today, 29)];
  return {
    id: 'sample-role',
    slug: SAMPLE_ROLE_SLUG,
    projectTitle: '단편영화 〈늦여름 정류장〉',
    title: '지수 역',
    description:
      '막차가 끊긴 시골 버스 정류장에서 처음 만난 두 사람이 하룻밤을 함께 보내는 이야기예요. ' +
      '지수는 서울로 떠나려다 마지막 버스를 놓친 대학생으로, 겉으로는 무심하지만 속은 여린 인물이에요. ' +
      '대사보다 표정과 침묵으로 감정을 전하는 장면이 많아요.',
    shootDate: shootDates[0],
    shootDates,
    shootMode: 'custom',
    roleType: 'lead',
    gender: 'female',
    ageMin: 20,
    ageMax: 27,
    headcount: 1,
    specialScenes: ['none'],
    specialNote: '',
    location: '경기 양평',
    pay: '회차당 15만 원 · 식사·교통비 제공',
    deadline: addDays(today, 14),
    contactName: '〈늦여름 정류장〉 연출팀',
    announcementDate: addDays(today, 18),
    requirement: '촬영 이틀 모두 참여할 수 있는 분',
    isClosed: false,
    createdAt: `${today}T00:00:00.000Z`,
    ownerId: null,
    projectId: null,
    coverUrl: '/covers/short.svg',
    projectFormat: '단편영화',
    projectGenres: ['드라마'],
    projectRegion: '경기',
  };
}
