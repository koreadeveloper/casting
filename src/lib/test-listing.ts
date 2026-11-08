// 테스트용 공고 숨기기. 작품 제목이 [테스트]·[TEST]로 시작하면 배우 쪽 목록(공고 목록·검색·새 공고 알림)에서 뺀다.
// 제작진 화면과 지원 링크(직접 주소)는 그대로라 팀 안에서는 계속 시험할 수 있다.
// DB·Next에 기대지 않아 테스트로 지킨다.

export const TEST_TITLE_PREFIXES = ['[테스트]', '[test]'];

export function isTestTitle(title: string) {
  const head = title.trim().toLowerCase();
  return TEST_TITLE_PREFIXES.some((prefix) => head.startsWith(prefix));
}

/**
 * SQL 조건: 이 배역이 테스트 공고인지. 프로젝트 제목(없으면 배역에 적힌 작품명)을 본다.
 * roleAlias는 배역 표의 별칭(roles 또는 r).
 */
export function testRoleSql(roleAlias: string) {
  const title = `LOWER(LTRIM(COALESCE((SELECT tp.title FROM projects tp WHERE tp.id=${roleAlias}.project_id), ${roleAlias}.project_title, '')))`;
  return `(${TEST_TITLE_PREFIXES.map((prefix) => `${title} LIKE '${prefix}%'`).join(' OR ')})`;
}
