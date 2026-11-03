// 확장자를 적는 건 node --test가 이 파일을 그대로 읽을 수 있게 하려는 것이다 (profile-draft.ts와 같은 이유).
import { koreaToday, manAge } from './age.ts';

export type Gender = 'female' | 'male' | 'other' | '';

export type Filmography = { year: string; title: string; role: string };

export type ActorProfile = {
  userId: string;
  name: string;
  gender: Gender;
  birthYear: number | null;
  /** 생년월일 'YYYY-MM-DD'. 예전 프로필은 비어 있고 birthYear만 있다. 있으면 birthYear도 이 연도로 맞춘다. */
  birthDate: string;
  height: number | null;
  weight: number | null;
  region: string;
  intro: string;
  tags: string[];
  skills: string[];
  photos: string[];
  videoUrl: string;
  filmography: Filmography[];
  unavailableDates: string[];
  isPublic: boolean;
  updatedAt: string;
};

export type ActorFilters = {
  q?: string;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  heightMin?: number;
  heightMax?: number;
  region?: string;
  skill?: string;
  tag?: string;
  /** 촬영 시작일. 하루만 볼 때는 이것만 넣는다 (예전 `available`과 같은 뜻) */
  available?: string;
  /** 촬영 종료일. 넣으면 시작일~종료일 전체를 본다 */
  availableTo?: string;
  ids?: string[];
};

export type PickGroup = { title: string; items: string[] };

/**
 * 이미지 키워드. 첫 그룹은 기존에 저장된 프로필이 쓰던 12개라 순서까지 그대로 둔다.
 * 항목을 지우거나 이름을 바꾸면 cleanList()의 허용 목록에서 빠져 기존 프로필 값이 사라지므로 추가만 한다.
 * 공고 본문에서 조건을 뽑는 briefFromRole()이 이 문자열을 그대로 찾기 때문에
 * '어린'처럼 일반 문장에 흔히 섞이는 말은 넣지 않는다.
 */
export const IMAGE_TAG_GROUPS: PickGroup[] = [
  {
    title: '자주 쓰는 인상',
    items: [
      '청순한',
      '시크한',
      '지적인',
      '따뜻한',
      '카리스마',
      '소년미',
      '도시적인',
      '유쾌한',
      '차분한',
      '강인한',
      '사랑스러운',
      '신비로운',
    ],
  },
  {
    title: '분위기',
    items: ['청량한', '서늘한', '나른한', '몽환적인', '고전적인', '빈티지한', '화려한', '수수한'],
  },
  {
    title: '성격과 태도',
    items: ['당당한', '반항적인', '예민한', '순박한', '능글맞은', '코믹한', '무덤덤한', '단정한'],
  },
  {
    title: '연령과 체형 인상',
    items: ['성숙한', '중성적인', '소녀미', '청년미', '중년미', '노련한'],
  },
];

/** 특기. 구체적인 항목(경상도 사투리 등)을 넓은 항목(사투리)과 함께 둬서 양쪽으로 검색된다. */
export const SKILL_GROUPS: PickGroup[] = [
  {
    title: '연기',
    items: [
      '자연스러운 대화 연기',
      '액션',
      '즉흥 연기',
      '감정 연기',
      '코믹 연기',
      '멜로 연기',
      '아동 연기',
      '모노드라마',
    ],
  },
  {
    title: '언어와 발성',
    items: [
      '사투리',
      '영어',
      '일본어',
      '중국어',
      '경상도 사투리',
      '전라도 사투리',
      '충청도 사투리',
      '제주도 사투리',
      '내레이션',
      '발성 훈련 경험',
    ],
  },
  {
    title: '노래와 춤',
    items: ['노래', '댄스', '뮤지컬 넘버', '랩', '발레', '한국무용', '현대무용', '힙합 댄스'],
  },
  { title: '악기', items: ['악기 연주', '피아노', '기타', '바이올린', '드럼'] },
  {
    title: '운동과 신체',
    items: [
      '수영',
      '무술',
      '태권도',
      '검도',
      '승마',
      '복싱',
      '요가',
      '스케이트보드',
      '스턴트 경험',
    ],
  },
  {
    title: '그 외',
    items: ['운전', '수동 운전', '오토바이 운전', '수어', '요리', '모델 워킹', '셀프 촬영·편집'],
  },
];

const flatten = (groups: PickGroup[]) => groups.flatMap((group) => group.items);

export const IMAGE_TAGS = flatten(IMAGE_TAG_GROUPS);
export const SKILLS = flatten(SKILL_GROUPS);

/** 빠른 필터 줄에 먼저 보여 주는 키워드 (나머지는 필터 패널에서 고른다) */
export const QUICK_IMAGE_TAGS = IMAGE_TAG_GROUPS[0].items;

export const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '강원', '제주'];
export const MAX_TAGS = 5;
export const MAX_SKILLS = 12;

export const genderLabel: Record<Gender, string> = {
  female: '여성',
  male: '남성',
  other: '기타',
  '': '미입력',
};

export function ageOf(birthYear: number | null, currentYear = new Date().getFullYear()) {
  return birthYear ? currentYear - birthYear : null;
}

/** 화면에 보여 주는 나이. 생년월일이 있으면 만 나이, 출생연도만 있으면 연도로만 계산한다. */
export function profileAge(
  profile: { birthYear: number | null; birthDate?: string },
  today = new Date(),
) {
  return profile.birthDate
    ? manAge(profile.birthDate, today)
    : ageOf(profile.birthYear, Number(koreaToday(today).slice(0, 4)));
}

export function profileCompletion(profile: ActorProfile) {
  const checks = [
    Boolean(profile.name),
    Boolean(profile.gender),
    Boolean(profile.birthYear),
    Boolean(profile.height),
    Boolean(profile.region),
    profile.intro.length >= 20,
    profile.tags.length > 0,
    profile.skills.length > 0,
    profile.photos.length > 0,
    profile.photos.length >= 3,
    Boolean(profile.videoUrl),
    profile.filmography.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

const DAY = 86400000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 기간 검색으로 한 번에 볼 수 있는 최대 일수 */
export const MAX_RANGE_DAYS = 31;

/**
 * from~to(양쪽 포함)의 날짜 목록. to를 비우거나 from보다 앞서면 from 하루만 본다.
 * UTC로만 계산해서 서버·브라우저의 시간대가 달라도 같은 날짜가 나온다.
 */
export function dateRange(from: string, to?: string): string[] {
  if (!DATE_PATTERN.test(from)) return [];
  const start = Date.parse(`${from}T00:00:00Z`);
  if (Number.isNaN(start)) return [];
  const end = to && DATE_PATTERN.test(to) ? Date.parse(`${to}T00:00:00Z`) : start;
  if (Number.isNaN(end) || end < start) return [from];
  const days = Math.min(Math.round((end - start) / DAY) + 1, MAX_RANGE_DAYS);
  return Array.from({ length: days }, (_, index) =>
    new Date(start + index * DAY).toISOString().slice(0, 10),
  );
}

export type Availability = {
  /** 조회한 날짜 수 */
  days: number;
  /** 배우가 '불가'로 등록해 둔 날짜 */
  blocked: string[];
  /** 출연 불가 일정을 한 번이라도 등록한 배우인지 (미등록이면 '가능'이 아니라 '미확인') */
  registered: boolean;
};

/** 기간 중 며칠을 할 수 있는지. 전체 가능/일부 가능을 구분해 보여 주기 위한 값이다. */
export function availabilityIn(
  profile: Pick<ActorProfile, 'unavailableDates'>,
  range: string[],
): Availability {
  return {
    days: range.length,
    blocked: range.filter((date) => profile.unavailableDates.includes(date)),
    registered: profile.unavailableDates.length > 0,
  };
}

export function matchesFilters(
  profile: ActorProfile,
  filters: ActorFilters,
  currentYear = new Date().getFullYear(),
) {
  if (filters.ids && !filters.ids.includes(profile.userId)) return false;
  if (filters.gender && profile.gender !== filters.gender) return false;
  const age =
    currentYear === new Date().getFullYear()
      ? profileAge(profile)
      : ageOf(profile.birthYear, currentYear);
  if (filters.ageMin && (age === null || age < filters.ageMin)) return false;
  if (filters.ageMax && (age === null || age > filters.ageMax)) return false;
  if (filters.heightMin && (!profile.height || profile.height < filters.heightMin)) return false;
  if (filters.heightMax && (!profile.height || profile.height > filters.heightMax)) return false;
  if (filters.region && !profile.region.startsWith(filters.region)) return false;
  if (filters.skill && !profile.skills.includes(filters.skill)) return false;
  if (filters.tag && !profile.tags.includes(filters.tag)) return false;
  // 기간 검색: 하루도 할 수 없는 배우만 제외한다. 일부만 가능한 배우는 조율 여지가 있어 남겨 두고,
  // 목록에서 '3일 중 2일 가능'처럼 따로 표시한다.
  if (filters.available) {
    const range = dateRange(filters.available, filters.availableTo);
    if (range.length > 0 && availabilityIn(profile, range).blocked.length === range.length)
      return false;
  }
  if (filters.q) {
    const haystack = [profile.name, profile.intro, ...profile.tags, ...profile.skills]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(filters.q.toLowerCase())) return false;
  }
  return true;
}

export function cleanList(value: unknown, allowed: string[] | null, max: number) {
  if (!Array.isArray(value)) return [];
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item && (!allowed || allowed.includes(item)));
  return [...new Set(items)].slice(0, max);
}
