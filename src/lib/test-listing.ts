// 배우 쪽 목록(공고 목록·검색·맞춤 공고·새 공고 알림)에서 숨기는 공고.
// 1) 작품 제목이 [테스트]·[TEST]로 시작하는 공고
// 2) 파일럿을 시작하기 전에 올라온 공고(팀이 시험으로 올린 것들). 데이터는 지우지 않으므로
//    다시 보이게 하려면 LISTINGS_VISIBLE_FROM을 ''로 바꾸면 된다.
// 제작진 화면과 지원 링크(직접 주소)는 그대로다. DB·Next에 기대지 않아 테스트로 지킨다.

export const TEST_TITLE_PREFIXES = ['[테스트]', '[test]'];

/** 이 시각(UTC) 전에 등록된 배역은 배우 쪽 목록에서 숨긴다. 빈 값이면 끈다. */
export const LISTINGS_VISIBLE_FROM = '2026-11-08T07:16:00.000Z';

export function isTestTitle(title: string) {
  const head = title.trim().toLowerCase();
  return TEST_TITLE_PREFIXES.some((prefix) => head.startsWith(prefix));
}

/** 배역 하나를 배우 쪽 목록에서 숨길지(화면 밖 계산·테스트용) */
export function isHiddenListing(title: string, createdAt: string, from = LISTINGS_VISIBLE_FROM) {
  return isTestTitle(title) || (Boolean(from) && createdAt < from);
}

/**
 * SQL 조건: 이 배역을 배우 쪽 목록에서 숨기는지. 프로젝트 제목(없으면 배역에 적힌 작품명)과 등록 시각을 본다.
 * roleAlias는 배역 표의 별칭(roles 또는 r).
 */
export function hiddenRoleSql(roleAlias: string, from = LISTINGS_VISIBLE_FROM) {
  const title = `LOWER(LTRIM(COALESCE((SELECT tp.title FROM projects tp WHERE tp.id=${roleAlias}.project_id), ${roleAlias}.project_title, '')))`;
  const conditions = TEST_TITLE_PREFIXES.map((prefix) => `${title} LIKE '${prefix}%'`);
  // 관리자가 내린 공고(/admin/roles)
  conditions.push(`${roleAlias}.admin_hidden_at IS NOT NULL`);
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(from))
    conditions.push(`${roleAlias}.created_at < '${from}'`);
  return `(${conditions.join(' OR ')})`;
}
