// 가입 후 계정 정보(이름·소속) 고치기 규칙. DB·Next에 기대지 않아 테스트로 지킨다.

/** 제작자 소속 유형. 가입 화면과 계정 수정 화면이 같이 쓴다. */
export const ORG_TYPES = [
  '영화 제작사',
  '학생 제작팀',
  '영화동아리',
  '독립 제작자(개인)',
  '광고·숏폼 제작사',
  '기타',
];

export type AccountEdit = { name: string; orgType: string; orgName: string };

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/**
 * 제작자 계정 정보 요청을 읽어 저장할 값 또는 사용자에게 보여 줄 문제를 돌려준다.
 * (배우 이름은 프로필 편집에서 바꾼다)
 */
export function readAccountEdit(
  body: unknown,
  currentOrgType = '',
): { value: AccountEdit } | { error: string } {
  const raw = (body ?? {}) as Record<string, unknown>;
  const name = text(raw.name, 60);
  if (!name) return { error: '이름을 입력해 주세요.' };
  const orgType = text(raw.orgType, 40);
  // 목록에 없는 예전 값이라도 지금 저장된 값이면 그대로 둔다.
  if (!ORG_TYPES.includes(orgType) && !(orgType && orgType === currentOrgType))
    return { error: '소속 유형을 선택해 주세요.' };
  return { value: { name, orgType, orgName: text(raw.orgName, 100) } };
}

/**
 * 재학증명서 인증은 서류의 이름을 계정 이름과 맞춰 본 것이라, 이름을 바꾸면 다시 받아야 한다.
 * 띄어쓰기만 다른 경우는 같은 이름으로 본다.
 */
export function nameChanged(before: string, after: string) {
  const compact = (value: string) => value.replace(/\s/g, '');
  return compact(before) !== compact(after);
}
