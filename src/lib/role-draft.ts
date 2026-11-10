// AI가 시놉시스·메모에서 뽑은 배역 → 공고 배역 '초안'.
//
// AI 응답은 믿지 않고 여기서 한 번 더 걸러 낸다. 정해진 목록에 없는 값은 버리고 길이·숫자 범위를 맞춘다.
// 제작진이 화면에서 확인하고 고른 배역만 입력칸에 들어간다 — 여기서 저장하지 않는다.
//
// 특수 장면(노출·폭력 등)은 배우 안전과 바로 이어지는 공고 필수 항목이라 AI가 정하지 않는다.
// 글에 그런 장면이 보이면 sceneHints로 '확인해 보세요'만 알려 주고, 고르는 건 제작진이 한다.

// './project-meta.ts'처럼 확장자를 적는 건 node --test가 이 파일을 그대로 읽을 수 있게 하려는 것이다.
import { ROLE_GENDERS, ROLE_TYPES, SPECIAL_SCENES } from './project-meta.ts';

/** 한 번에 만드는 배역 초안 수. 공고 한 건의 배역 상한(20)과 맞춘다. */
export const MAX_DRAFT_ROLES = 20;
/** 시놉시스·메모 글자 수 범위 */
export const MIN_SOURCE_TEXT = 20;
export const MAX_SOURCE_TEXT = 8000;

export type RoleSuggestion = {
  title: string;
  description: string;
  requirement: string;
  /** ROLE_TYPES 키 또는 '' */
  roleType: string;
  /** ROLE_GENDERS 키 또는 '' */
  gender: string;
  /** 0이면 제한 없음 */
  ageMin: number;
  ageMax: number;
  headcount: number;
  /** 글에 보이는 특수 장면 종류(SPECIAL_SCENES 키). 참고용이며 자동으로 고르지 않는다. */
  sceneHints: string[];
  /** 이 배역을 글의 어느 부분에서 읽었는지(짧은 원문). 제작진이 바로 확인할 수 있게. */
  source: string;
};

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function int(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/** 응답 글에서 JSON 덩어리를 꺼낸다. 앞뒤에 말이 붙어도 첫 '{'부터 마지막 '}'까지를 본다. */
export function parseJsonObject(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** AI가 돌려준 {"roles":[...]}를 검사해 배역 초안 목록으로 바꾼다. 모양이 다르면 빈 목록. */
export function rolesFromFacts(facts: unknown): RoleSuggestion[] {
  const list =
    facts && typeof facts === 'object' && Array.isArray((facts as { roles?: unknown }).roles)
      ? ((facts as { roles: unknown[] }).roles as unknown[])
      : [];
  const roles: RoleSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (roles.length >= MAX_DRAFT_ROLES) break;
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const title = text(raw.title, 100);
    const description = text(raw.description, 2000);
    // 배역명이 없으면 입력칸에 넣어도 저장이 안 되니 건너뛴다. 같은 이름은 한 번만.
    if (!title || seen.has(title)) continue;
    seen.add(title);

    let ageMin = int(raw.ageMin, 0, 100, 0);
    let ageMax = int(raw.ageMax, 0, 100, 0);
    // 앞뒤가 바뀐 연령대는 바로잡는다.
    if (ageMin > 0 && ageMax > 0 && ageMax < ageMin) [ageMin, ageMax] = [ageMax, ageMin];

    const roleType = String(raw.roleType ?? '');
    const gender = String(raw.gender ?? '');
    const hints = Array.isArray(raw.sceneHints) ? raw.sceneHints : [];
    roles.push({
      title,
      description,
      requirement: text(raw.requirement, 500),
      roleType: Object.hasOwn(ROLE_TYPES, roleType) ? roleType : '',
      gender: Object.hasOwn(ROLE_GENDERS, gender) ? gender : '',
      ageMin,
      ageMax,
      headcount: int(raw.headcount, 1, 999, 1),
      sceneHints: [
        ...new Set(
          hints.filter(
            (hint): hint is string =>
              typeof hint === 'string' && Object.hasOwn(SPECIAL_SCENES, hint),
          ),
        ),
      ],
      source: text(raw.source, 200),
    });
  }
  return roles;
}
