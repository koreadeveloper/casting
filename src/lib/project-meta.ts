// 프로젝트·배역을 나누는 카테고리와 화면 표시 이름.
// 서버(값 검증)와 화면(선택지·표시)이 같은 목록을 써서, DB에는 정해진 값만 들어가게 한다.
// (리프 모듈 유지: node --test에서 바로 불러오도록 lib 내부 import를 두지 않는다)

/** 형식. DB의 projects.genre 칸에 저장된다(예전부터 이 칸에 형식 값이 들어 있었다). */
export const FORMATS = [
  '단편영화',
  '장편영화',
  '웹드라마',
  '숏폼',
  '광고',
  '뮤직비디오',
  '연극',
  '기타',
];

/** 장르. 여러 개 고를 수 있다. */
export const GENRE_TAGS = [
  '드라마',
  '코미디',
  '로맨스',
  '스릴러',
  '액션',
  '공포',
  '미스터리',
  '범죄',
  'SF·판타지',
  '가족',
  '청춘',
  '다큐멘터리',
  '실험',
];

export const PRODUCTION_TYPES: Record<string, string> = {
  student: '학생·졸업작품',
  indie: '독립',
  commercial: '상업',
  festival: '영화제 출품',
  brand: '기업·브랜드',
};

/** 공개처. 여러 개 고를 수 있다. */
export const RELEASE_CHANNELS: Record<string, string> = {
  festival: '영화제',
  theater: '극장',
  ott: 'OTT',
  tv: '방송',
  online: '유튜브·SNS',
  private: '비공개·내부용',
  undecided: '미정',
};

/** 출연자에게 제공하는 것. 여러 개 고를 수 있다. */
export const PERKS: Record<string, string> = {
  transport: '교통비',
  meal: '식사',
  lodging: '숙박',
};

/** 촬영 지역 시·도. 상세 지역과 합쳐 location 칸에 "서울 성동구"처럼 저장한다. */
export const PROJECT_REGIONS = [
  '서울',
  '경기',
  '인천',
  '강원',
  '충북',
  '충남',
  '대전',
  '세종',
  '전북',
  '전남',
  '광주',
  '경북',
  '경남',
  '대구',
  '울산',
  '부산',
  '제주',
  '해외',
  '미정',
];

export const ROLE_TYPES: Record<string, string> = {
  lead: '주연',
  supporting: '조연',
  minor: '단역',
  extra: '보조출연',
};

export const ROLE_GENDERS: Record<string, string> = {
  any: '성별 무관',
  male: '남성',
  female: '여성',
};

/** 연령대 표시: "20~29세", "20세 이상", "29세 이하", 제한 없으면 ''. */
export function ageRangeLabel(min: number, max: number) {
  if (min > 0 && max > 0) return min === max ? `${min}세` : `${min}~${max}세`;
  if (min > 0) return `${min}세 이상`;
  if (max > 0) return `${max}세 이하`;
  return '';
}

/**
 * 저장된 촬영 지역("서울 성동구")을 시·도와 상세 위치로 나눈다.
 * 시·도 칸이 생기기 전 프로젝트는 첫 단어가 시·도 목록에 있을 때만 시·도로 본다.
 */
export function splitLocation(location: string, savedRegion = '') {
  const text = location.trim();
  if (savedRegion && PROJECT_REGIONS.includes(savedRegion)) {
    const detail = text.startsWith(savedRegion) ? text.slice(savedRegion.length).trim() : text;
    return { region: savedRegion, detail };
  }
  const [first = '', ...rest] = text.split(/\s+/);
  return PROJECT_REGIONS.includes(first)
    ? { region: first, detail: rest.join(' ') }
    : { region: '', detail: text };
}

/** '특수 장면 없음'을 뜻하는 값. 종류와 함께 고를 수 없다. */
export const NO_SPECIAL_SCENE = 'none';

/**
 * 특수 장면 종류. 기획서의 공고 필수 항목이라 배역마다 '없음' 또는 종류를 꼭 고른다.
 * 배우가 지원하기 전에 알아야 할 장면이다.
 */
export const SPECIAL_SCENES: Record<string, string> = {
  nudity: '노출',
  intimacy: '키스·신체 접촉',
  violence: '폭력·격투',
  stunt: '위험 액션·스턴트',
  height_water: '고공·수중',
  smoking: '흡연·음주',
  other: '기타',
};

/** 특수 장면 값 정리: 종류를 하나라도 고르면 '없음'은 뺀다. 아무것도 없으면 빈 목록(아직 안내 안 함). */
export function normalizeSpecialScenes(values: unknown): string[] {
  const picked = pickKnown(values, [...Object.keys(SPECIAL_SCENES), NO_SPECIAL_SCENE]);
  const kinds = picked.filter((value) => value !== NO_SPECIAL_SCENE);
  if (kinds.length) return kinds;
  return picked.includes(NO_SPECIAL_SCENE) ? [NO_SPECIAL_SCENE] : [];
}

/** 특수 장면 표시: '특수 장면 없음', '노출·흡연·음주', 안내 전이면 ''. */
export function specialScenesLabel(values: string[]) {
  if (values.includes(NO_SPECIAL_SCENE)) return '특수 장면 없음';
  return values
    .map((value) => SPECIAL_SCENES[value])
    .filter(Boolean)
    .join('·');
}

/**
 * 작품 포스터로 받을 수 있는 주소: 우리 업로드 저장소의 사진(/api/uploads/<uuid>.jpg|png|webp)만.
 * 바깥 주소나 PDF는 받지 않는다. 빈 값은 '포스터 없음'(기본 커버)이다.
 */
export function cleanPosterUrl(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\/api\/uploads\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(text) ? text : '';
}

/** 정해진 목록에 있는 값만 남긴다(중복 제거). */
export function pickKnown(values: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => allowed.includes(value)))];
}
