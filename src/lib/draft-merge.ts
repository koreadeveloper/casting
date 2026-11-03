// AI 프로필 초안을 지금 프로필과 맞춰 보는 규칙.
// 배우가 '지금 값'과 '초안 값'을 나란히 보고, 초안 값을 고친 뒤 고른 항목만 채운다.
// 이미 넣어 둔 값은 기본으로 덮어쓰지 않는다(빈 칸만 기본 선택).

// './profile.ts'처럼 확장자를 적는 건 node --test가 이 파일을 그대로 읽을 수 있게 하려는 것이다.
import { REGIONS, type Gender } from './profile.ts';
import type { FilmoItem, ProfileDraft } from './profile-draft.ts';

export type DraftKey = keyof ProfileDraft;

/** 초안에서 배우가 직접 고칠 수 있는 항목. 목록 항목(키워드·특기·필모)은 채운 뒤 아래 입력칸에서 고친다. */
export const EDITABLE_DRAFT_KEYS: DraftKey[] = [
  'name',
  'gender',
  'birthYear',
  'height',
  'weight',
  'region',
  'agency',
  'intro',
];

export type MergeProfile = {
  name: string;
  gender: Gender | string;
  birthYear: number | null;
  birthDate?: string;
  height: number | null;
  weight: number | null;
  region: string;
  agency: string;
  intro: string;
  tags: string[];
  skills: string[];
  filmography: FilmoItem[];
};

const GENDER_TEXT: Record<string, string> = { female: '여성', male: '남성', other: '기타' };

function filmoText(item: FilmoItem) {
  return `${item.year} ${item.title}${item.role ? ` (${item.role})` : ''}`.trim();
}

/** 값을 한 줄 글자로. 비어 있으면 빈 문자열. */
export function fieldText(key: DraftKey, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value))
    return value
      .map((item) => (typeof item === 'string' ? item : filmoText(item as FilmoItem)))
      .join(', ');
  if (key === 'gender') return GENDER_TEXT[String(value)] ?? '';
  if (key === 'height') return `${value}cm`;
  if (key === 'weight') return `${value}kg`;
  if (key === 'birthYear') return `${value}년`;
  return String(value);
}

/** 지금 프로필의 같은 항목 값 */
export function currentValue(profile: MergeProfile, key: DraftKey): unknown {
  return profile[key];
}

function isEmpty(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function sameFilmo(a: FilmoItem, b: FilmoItem) {
  return a.title.trim() === b.title.trim() && a.year.trim() === b.year.trim();
}

/** 필모그래피는 덧붙이므로, 이미 있는 작품은 빼고 새 작품만 남긴다. */
export function newFilmography(current: FilmoItem[], draft: FilmoItem[]) {
  return draft.filter((item) => !current.some((existing) => sameFilmo(existing, item)));
}

/** 초안 값이 지금 값과 같은지(채워도 바뀌는 게 없는지) */
export function sameAsCurrent(profile: MergeProfile, key: DraftKey, value: unknown) {
  if (key === 'filmography')
    return newFilmography(profile.filmography, value as FilmoItem[]).length === 0;
  const current = currentValue(profile, key);
  if (Array.isArray(current) && Array.isArray(value))
    return current.length === value.length && current.every((item) => value.includes(item));
  return String(current ?? '') === String(value ?? '');
}

/**
 * 처음에 체크해 둘지. 지금 비어 있는 칸만 채우고, 이미 넣어 둔 값은 배우가 직접 고를 때만 바꾼다.
 * 필모그래피는 덧붙이는 방식이라 새 작품이 있으면 체크한다.
 */
export function defaultPick(profile: MergeProfile, key: DraftKey, value: unknown) {
  if (sameAsCurrent(profile, key, value)) return false;
  if (key === 'filmography') return true;
  return isEmpty(currentValue(profile, key));
}

/** 고칠 수 있는 항목의 초안 값을 입력칸 글자로 */
export function editText(key: DraftKey, value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * 배우가 고친 글자를 프로필 값으로. 맞지 않는 값이면 undefined(채우지 않음).
 * 서버(/api/me/profile)의 검사 범위와 같게 둔다.
 */
export function parseEdit(key: DraftKey, text: string): unknown {
  const value = text.trim();
  const int = (min: number, max: number) => {
    const parsed = Number(value);
    return value && Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
  };
  switch (key) {
    case 'name':
      return value ? value.slice(0, 60) : undefined;
    case 'gender':
      return ['female', 'male', 'other'].includes(value) ? value : undefined;
    case 'birthYear':
      return int(1930, new Date().getFullYear());
    case 'height':
      return int(100, 230);
    case 'weight':
      return int(25, 200);
    case 'region':
      return REGIONS.includes(value) ? value : undefined;
    case 'agency':
      return value.slice(0, 60);
    case 'intro':
      return value.slice(0, 2000);
    default:
      return undefined;
  }
}
