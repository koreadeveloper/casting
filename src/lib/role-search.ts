// 배우의 배역 검색·필터. 순수 함수만 둔다.
// (리프 모듈 유지: node --test에서 바로 불러오도록 lib 내부 import를 두지 않는다.
//  형식·장르 같은 허용 목록은 project-meta.ts 값을 호출하는 쪽에서 넘긴다)

/** 연령대 칩. 배역 연령 범위와 겹치면 맞는 배역이다. */
export const AGE_BANDS: Record<string, { label: string; min: number; max: number }> = {
  '10': { label: '10대', min: 10, max: 19 },
  '20': { label: '20대', min: 20, max: 29 },
  '30': { label: '30대', min: 30, max: 39 },
  '40': { label: '40대', min: 40, max: 49 },
  '50': { label: '50대 이상', min: 50, max: 200 },
};

/** 정렬. newest가 기본(주소에 안 남긴다). */
export const ROLE_SORTS = {
  newest: '최신 등록순',
  deadline: '마감 임박순',
  shoot: '촬영일 빠른순',
} as const;
export type RoleSort = keyof typeof ROLE_SORTS;

export type RoleFilters = {
  /** 키워드: 작품명·배역명·배역 설명·지원 조건에서 찾는다 */
  q: string;
  /** 형식(projects.genre) */
  formats: string[];
  /** 장르(projects.genres) — 하나라도 같으면 맞음 */
  genres: string[];
  /** 촬영 지역 시·도 */
  region: string;
  /** 비중 */
  roleTypes: string[];
  /** 배우 성별. 고르면 그 성별·무관·미지정 배역이 보인다 */
  gender: '' | 'male' | 'female';
  /** 연령대(AGE_BANDS 키) */
  ages: string[];
  /** 내 출연 불가일과 겹치는 배역 빼기 */
  free: boolean;
  /** 정렬(필터 개수에는 넣지 않는다) */
  sort: RoleSort;
};

export const EMPTY_FILTERS: RoleFilters = {
  q: '',
  formats: [],
  genres: [],
  region: '',
  roleTypes: [],
  gender: '',
  ages: [],
  free: false,
  sort: 'newest',
};

/** 검색에 필요한 배역·작품 정보 */
export type RoleListing = {
  projectTitle: string;
  title: string;
  description: string;
  requirement: string;
  roleType: string;
  gender: string;
  ageMin: number;
  ageMax: number;
  shootDates: string[];
  projectFormat: string;
  projectGenres: string[];
  projectRegion: string;
};

export type FilterOptions = {
  formats: readonly string[];
  genres: readonly string[];
  regions: readonly string[];
  roleTypes: readonly string[];
};

type Params = Record<string, string | string[] | undefined>;

function many(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value : value ? [value] : []).map((item) => item.trim());
}

function one(value: string | string[] | undefined) {
  return many(value)[0] ?? '';
}

function known(values: string[], allowed: readonly string[]) {
  return [...new Set(values.filter((value) => allowed.includes(value)))];
}

/** URL 검색 조건을 필터로 바꾼다. 모르는 값은 버린다. */
export function parseRoleFilters(params: Params, options: FilterOptions): RoleFilters {
  const gender = one(params.gender);
  const region = one(params.region);
  const sort = one(params.sort);
  return {
    q: one(params.q).slice(0, 60),
    formats: known(many(params.format), options.formats),
    genres: known(many(params.genre), options.genres),
    region: options.regions.includes(region) ? region : '',
    roleTypes: known(many(params.type), options.roleTypes),
    gender: gender === 'male' || gender === 'female' ? gender : '',
    ages: known(many(params.age), Object.keys(AGE_BANDS)),
    free: one(params.free) === '1',
    sort: Object.hasOwn(ROLE_SORTS, sort) ? (sort as RoleSort) : 'newest',
  };
}

/** 필터를 URL 검색 조건 문자열로(빈 값은 뺀다). 화면이 주소를 바꿀 때 쓴다. */
export function filtersToQuery(filters: RoleFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  for (const value of filters.formats) params.append('format', value);
  for (const value of filters.genres) params.append('genre', value);
  if (filters.region) params.set('region', filters.region);
  for (const value of filters.roleTypes) params.append('type', value);
  if (filters.gender) params.set('gender', filters.gender);
  for (const value of filters.ages) params.append('age', value);
  if (filters.free) params.set('free', '1');
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  return params.toString();
}

/** 키워드를 뺀, 켜 둔 필터 수 */
export function activeFilterCount(filters: RoleFilters) {
  return (
    filters.formats.length +
    filters.genres.length +
    (filters.region ? 1 : 0) +
    filters.roleTypes.length +
    (filters.gender ? 1 : 0) +
    filters.ages.length +
    (filters.free ? 1 : 0)
  );
}

export function hasRoleFilters(filters: RoleFilters) {
  return Boolean(filters.q.trim()) || activeFilterCount(filters) > 0;
}

function ageMatches(listing: RoleListing, bands: string[]) {
  if (bands.length === 0) return true;
  const min = listing.ageMin > 0 ? listing.ageMin : 0;
  const max = listing.ageMax > 0 ? listing.ageMax : Infinity;
  if (min === 0 && max === Infinity) return true; // 연령 제한 없는 배역은 누구나
  return bands.some((key) => {
    const band = AGE_BANDS[key];
    return band && band.min <= max && min <= band.max;
  });
}

/** 정렬에 쓰는 배역 정보 */
export type SortableRole = {
  createdAt: string;
  deadline: string;
  shootDates: string[];
  shootDate?: string;
};

/** 첫 촬영일. 날짜가 없으면 ''. */
function firstShootDay(role: SortableRole) {
  const days = role.shootDates.length ? role.shootDates : role.shootDate ? [role.shootDate] : [];
  return [...days].sort()[0] ?? '';
}

/** 날짜 오름차순. 빈 날짜는 맨 뒤로. */
function byDateAsc(a: string, b: string) {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return a.localeCompare(b);
}

/**
 * 배역 목록 정렬(새 배열을 돌려준다). 같은 순위면 최신 등록순.
 * deadline = 지원 마감이 가까운 순, shoot = 첫 촬영일이 빠른 순.
 */
export function sortRoleListings<T extends SortableRole>(roles: T[], sort: RoleSort): T[] {
  const newest = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  return [...roles].sort((a, b) => {
    const order =
      sort === 'deadline'
        ? byDateAsc(a.deadline, b.deadline)
        : sort === 'shoot'
          ? byDateAsc(firstShootDay(a), firstShootDay(b))
          : 0;
    return order || newest(a, b);
  });
}

/** 배역 한 개가 필터에 맞는지. unavailableDates는 로그인한 배우의 출연 불가일. */
export function matchesRoleFilters(
  listing: RoleListing,
  filters: RoleFilters,
  unavailableDates: string[] = [],
) {
  const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    const text = [listing.projectTitle, listing.title, listing.description, listing.requirement]
      .join(' ')
      .toLowerCase();
    if (!words.every((word) => text.includes(word))) return false;
  }
  if (filters.formats.length && !filters.formats.includes(listing.projectFormat)) return false;
  if (filters.genres.length && !listing.projectGenres.some((g) => filters.genres.includes(g)))
    return false;
  if (filters.region && listing.projectRegion !== filters.region) return false;
  if (filters.roleTypes.length && !filters.roleTypes.includes(listing.roleType)) return false;
  // 성별 무관(any)이나 성별을 안 정한 배역은 누구에게나 보인다.
  if (
    filters.gender &&
    listing.gender !== filters.gender &&
    ['male', 'female'].includes(listing.gender)
  )
    return false;
  if (!ageMatches(listing, filters.ages)) return false;
  if (filters.free && unavailableDates.length) {
    const blocked = new Set(unavailableDates);
    if (listing.shootDates.some((day) => blocked.has(day))) return false;
  }
  return true;
}
