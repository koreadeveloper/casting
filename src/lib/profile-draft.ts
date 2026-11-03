// 프로필 PDF에서 뽑은 글자 → 프로필 '초안'.
//
// 규칙 기반이라 같은 글자를 넣으면 늘 같은 결과가 나오고, 왜 그렇게 채웠는지 근거 줄을 함께 돌려준다.
// 배우가 확인하고 고른 항목만 실제 프로필에 들어간다 — 여기서 바로 저장하지 않는다.

// './profile.ts'처럼 확장자를 적는 건 node --test가 이 파일을 그대로 읽을 수 있게 하려는 것이다.
// (calendar-grid.ts와 같은 이유로, 규칙 자체는 테스트로 지켜져야 한다.)
import { IMAGE_TAGS, MAX_SKILLS, MAX_TAGS, REGIONS, SKILLS, type Gender } from './profile.ts';
import { manAge } from './age.ts';

export type DraftField<T> = {
  value: T;
  /** 이 값을 어디서 읽었는지 (배우가 맞는지 바로 확인할 수 있게) */
  source: string;
};

export type FilmoItem = { year: string; title: string; role: string };

export type ProfileDraft = {
  name?: DraftField<string>;
  gender?: DraftField<Gender>;
  /** 서류에 날짜까지 적혀 있을 때만 'YYYY-MM-DD'. 있으면 출생 연도 대신 이 값을 보여 준다. */
  birthDate?: DraftField<string>;
  birthYear?: DraftField<number>;
  height?: DraftField<number>;
  weight?: DraftField<number>;
  region?: DraftField<string>;
  agency?: DraftField<string>;
  intro?: DraftField<string>;
  tags?: DraftField<string[]>;
  skills?: DraftField<string[]>;
  filmography?: DraftField<FilmoItem[]>;
};

const LABELS = {
  name: ['이름', '성명', '배우명', '예명'],
  gender: ['성별'],
  birth: ['생년월일', '생년', '출생', '생일'],
  height: ['키', '신장'],
  weight: ['몸무게', '체중'],
  region: ['지역', '활동지역', '활동 지역', '거주지', '거주 지역'],
  agency: ['소속', '소속사', '에이전시'],
  intro: ['소개', '자기소개', '프로필 소개'],
  skills: ['특기', '보유 특기', '특기사항'],
};

const THIS_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = THIS_YEAR - 100;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** '키: 170cm' 처럼 이름표가 붙은 값. 같은 줄에 없으면 다음 줄까지 본다. */
function labelled(rows: string[], labels: string[]): { value: string; source: string } | null {
  for (let index = 0; index < rows.length; index += 1) {
    for (const label of labels) {
      const pattern = new RegExp(`^${label}\\s*[:：]?\\s*(.*)$`);
      const match = pattern.exec(rows[index]);
      if (!match) continue;
      const sameLine = match[1].trim();
      if (sameLine) return { value: sameLine, source: rows[index] };
      const next = rows[index + 1];
      // 다음 줄이 또 다른 이름표면 값이 비어 있는 것으로 본다.
      if (next && !isLabel(next)) return { value: next, source: `${rows[index]} / ${next}` };
    }
  }
  return null;
}

function isLabel(row: string): boolean {
  return Object.values(LABELS)
    .flat()
    .some((label) => new RegExp(`^${label}\\s*[:：]`).test(row));
}

function firstNumber(text: string, min: number, max: number): number | null {
  for (const raw of text.match(/\d{2,4}/g) ?? []) {
    const value = Number(raw);
    if (value >= min && value <= max) return value;
  }
  return null;
}

function readName(rows: string[]): DraftField<string> | undefined {
  const tagged = labelled(rows, LABELS.name);
  if (tagged) {
    const name = tagged.value
      .replace(/[(（].*$/, '')
      .trim()
      .slice(0, 30);
    if (name) return { value: name, source: tagged.source };
  }
  // 이름표가 없으면 앞쪽에서 사람 이름처럼 보이는 짧은 한글 줄을 찾는다.
  for (const row of rows.slice(0, 6)) {
    if (/^[가-힣]{2,5}$/.test(row)) return { value: row, source: row };
  }
  return undefined;
}

function readGender(rows: string[]): DraftField<Gender> | undefined {
  const tagged = labelled(rows, LABELS.gender);
  const text = tagged?.value ?? '';
  if (/여/.test(text)) return { value: 'female', source: tagged!.source };
  if (/남/.test(text)) return { value: 'male', source: tagged!.source };
  return undefined;
}

/** '1999.05.17', '1999-5-17', '1999년 5월 17일' 같은 날짜를 'YYYY-MM-DD'로. 없는 날짜면 ''. */
export function birthDateFrom(text: string): string {
  const match = /(\d{4})\s*(?:[.\-/]|년)\s*(\d{1,2})\s*(?:[.\-/]|월)\s*(\d{1,2})/.exec(text);
  if (!match) return '';
  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return date >= '1930-01-01' && manAge(date) !== null ? date : '';
}

function readBirthDate(rows: string[]): DraftField<string> | undefined {
  const tagged = labelled(rows, LABELS.birth);
  if (tagged) {
    const date = birthDateFrom(tagged.value);
    if (date) return { value: date, source: tagged.source };
  }
  for (const row of rows) {
    if (!/생|출생|태어/.test(row)) continue;
    const date = birthDateFrom(row);
    if (date) return { value: date, source: row };
  }
  return undefined;
}

function readBirthYear(rows: string[]): DraftField<number> | undefined {
  const tagged = labelled(rows, LABELS.birth);
  if (tagged) {
    const year = firstNumber(tagged.value, MIN_BIRTH_YEAR, THIS_YEAR);
    if (year) return { value: year, source: tagged.source };
  }
  for (const row of rows) {
    // '1999년생', '2001년 3월생'
    const match = /(\d{4})\s*년/.exec(row);
    if (!match) continue;
    const year = Number(match[1]);
    if (year >= MIN_BIRTH_YEAR && year <= THIS_YEAR && /생|출생|태어/.test(row))
      return { value: year, source: row };
  }
  // '나이 26' → 올해 기준으로 환산 (한국 나이 표기로 보고 +1을 되돌린다)
  const age = labelled(rows, ['나이', '연령']);
  if (age) {
    const value = firstNumber(age.value, 10, 99);
    if (value) return { value: THIS_YEAR - value + 1, source: `${age.source} (나이에서 환산)` };
  }
  return undefined;
}

function readMeasure(
  rows: string[],
  labels: string[],
  unit: RegExp,
  min: number,
  max: number,
): DraftField<number> | undefined {
  const tagged = labelled(rows, labels);
  if (tagged) {
    const value = firstNumber(tagged.value, min, max);
    if (value) return { value, source: tagged.source };
  }
  for (const row of rows) {
    const match = unit.exec(row);
    if (!match) continue;
    const value = Number(match[1]);
    if (value >= min && value <= max) return { value, source: row };
  }
  return undefined;
}

function readRegion(rows: string[]): DraftField<string> | undefined {
  const tagged = labelled(rows, LABELS.region);
  if (tagged) {
    const hit = REGIONS.find((region) => tagged.value.includes(region));
    if (hit) return { value: hit, source: tagged.source };
  }
  for (const row of rows) {
    const hit = REGIONS.find((region) => row.includes(region));
    if (hit) return { value: hit, source: row };
  }
  return undefined;
}

function readList(
  rows: string[],
  allowed: string[],
  max: number,
): { value: string[]; source: string } | undefined {
  const whole = rows.join('\n');
  const found = allowed.filter((item) => whole.includes(item)).slice(0, max);
  if (found.length === 0) return undefined;
  const source = rows.find((row) => found.some((item) => row.includes(item))) ?? '';
  return { value: found, source };
}

/** '2024 밤의 끝 주연' / '2023 | 작품명 | 조연' 같은 줄을 모은다. */
function readFilmography(rows: string[]): FilmoItem[] {
  const items: FilmoItem[] = [];
  for (const row of rows) {
    const match = /^(19|20)(\d{2})\s*[.\-|/·]?\s*(.+)$/.exec(row);
    if (!match) continue;
    const rest = match[3]
      .replace(/^년\s*/, '')
      .replace(/^[|/·\-\s]+/, '')
      .trim();
    if (!rest || rest.length > 80) continue;
    // '1999년생'처럼 출생 연도를 적은 줄은 작품이 아니다
    if (/^생(?:[\s·,]|$)/.test(rest)) continue;
    const parts = rest.split(/\s*[|/·]\s*|\s{2,}/).filter(Boolean);
    const tail = parts.length > 1 ? parts[parts.length - 1] : '';
    const roleMatch = /(주연|조연|단역|주인공|특별출연|[가-힣A-Za-z]+\s*역)/.exec(tail || rest);
    items.push({
      year: `${match[1]}${match[2]}`,
      title: (parts[0] || rest).slice(0, 60).trim(),
      role: (roleMatch?.[1] ?? '').trim().slice(0, 30),
    });
    if (items.length >= 12) break;
  }
  return items;
}

function readIntro(rows: string[]): DraftField<string> | undefined {
  const tagged = labelled(rows, LABELS.intro);
  if (tagged && tagged.value.length >= 20)
    return { value: tagged.value.slice(0, 1000), source: tagged.source };
  // 이름표가 없으면 가장 긴 문장 줄을 소개로 본다.
  const candidates = rows.filter((row) => row.length >= 30 && /[.!?다요]$|[가-힣]{10,}/.test(row));
  const longest = candidates.sort((a, b) => b.length - a.length)[0];
  return longest ? { value: longest.slice(0, 1000), source: longest } : undefined;
}

export function draftFromText(text: string): ProfileDraft {
  const rows = lines(text);
  if (rows.length === 0) return {};
  const draft: ProfileDraft = {};
  const put = <K extends keyof ProfileDraft>(key: K, field: ProfileDraft[K] | undefined) => {
    if (field) draft[key] = field;
  };

  put('name', readName(rows));
  put('gender', readGender(rows));
  // 날짜까지 있으면 생년월일만, 없으면 출생 연도만 담는다(둘이 어긋나지 않게).
  const birthDate = readBirthDate(rows);
  if (birthDate) put('birthDate', birthDate);
  else put('birthYear', readBirthYear(rows));
  put('height', readMeasure(rows, LABELS.height, /(\d{3})\s*(?:cm|센치|센티)/i, 120, 220));
  put('weight', readMeasure(rows, LABELS.weight, /(\d{2,3})\s*(?:kg|킬로)/i, 30, 200));
  put('region', readRegion(rows));
  const agency = labelled(rows, LABELS.agency);
  if (agency && agency.value.length <= 40) put('agency', agency);
  put('intro', readIntro(rows));
  put('tags', readList(rows, IMAGE_TAGS, MAX_TAGS));
  put('skills', readList(rows, SKILLS, MAX_SKILLS));
  const filmography = readFilmography(rows);
  if (filmography.length > 0)
    put('filmography', { value: filmography, source: `${filmography.length}개 줄에서 읽음` });
  return draft;
}

/** 초안에 실제로 담긴 항목 수 (UI에서 '7개 항목을 채웠어요'를 보여 주기 위해) */
export function draftSize(draft: ProfileDraft): number {
  return Object.keys(draft).length;
}

/** AI가 돌려준 JSON에서 쓸 수 있는 값만 골라 초안으로 만든다. 타입·범위·허용 목록을 벗어난 값은 버린다. */
export function draftFromFacts(raw: unknown): ProfileDraft {
  if (!raw || typeof raw !== 'object') return {};
  const facts = raw as Record<string, unknown>;
  const sources =
    facts.sources && typeof facts.sources === 'object'
      ? (facts.sources as Record<string, unknown>)
      : {};
  const text = (value: unknown, max: number) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  const number = (value: unknown, min: number, max: number) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
  };
  const source = (key: string) => text(sources[key], 120) || 'AI가 서류에서 읽음';
  const draft: ProfileDraft = {};

  const name = text(facts.name, 30);
  if (name) draft.name = { value: name, source: source('name') };
  if (facts.gender === 'female' || facts.gender === 'male' || facts.gender === 'other')
    draft.gender = { value: facts.gender, source: source('gender') };
  const birthDate = typeof facts.birth_date === 'string' ? birthDateFrom(facts.birth_date) : '';
  const birthYear = number(facts.birth_year, MIN_BIRTH_YEAR, THIS_YEAR);
  if (birthDate) draft.birthDate = { value: birthDate, source: source('birth_date') };
  else if (birthYear) draft.birthYear = { value: birthYear, source: source('birth_year') };
  const height = number(facts.height, 120, 220);
  if (height) draft.height = { value: height, source: source('height') };
  const weight = number(facts.weight, 30, 200);
  if (weight) draft.weight = { value: weight, source: source('weight') };
  const region = REGIONS.find((item) => text(facts.region, 40).includes(item));
  if (region) draft.region = { value: region, source: source('region') };
  const agency = text(facts.agency, 40);
  if (agency) draft.agency = { value: agency, source: source('agency') };
  const intro = text(facts.intro, 1000);
  if (intro) draft.intro = { value: intro, source: source('intro') };

  const pick = (value: unknown, allowed: string[], max: number) =>
    Array.isArray(value)
      ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
          .filter((item) => allowed.includes(item))
          .slice(0, max)
      : [];
  const tags = pick(facts.tags, IMAGE_TAGS, MAX_TAGS);
  if (tags.length) draft.tags = { value: tags, source: source('tags') };
  const skills = pick(facts.skills, SKILLS, MAX_SKILLS);
  if (skills.length) draft.skills = { value: skills, source: source('skills') };

  if (Array.isArray(facts.filmography)) {
    const items: FilmoItem[] = [];
    for (const entry of facts.filmography) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      const year = text(row.year, 4);
      const title = text(row.title, 60);
      if (!/^(19|20)\d{2}$/.test(year) || !title) continue;
      items.push({ year, title, role: text(row.role, 30) });
      if (items.length >= 12) break;
    }
    if (items.length)
      draft.filmography = { value: items, source: `${items.length}개 작품을 서류에서 읽음` };
  }
  return draft;
}
