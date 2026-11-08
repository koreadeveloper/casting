// 팀이 시험용으로 만든 배우 계정을 제작자 쪽 목록(배우 찾기·둘러보기·추천·이상형 월드컵·후보 추가)에서 숨긴다.
// 프로필 주소로 직접 들어가는 것과 지원서는 그대로다. DB·Next에 기대지 않아 테스트로 지킨다.
// 주의: 이름으로 거르므로, 같은 이름의 실제 배우가 가입하면 그 배우도 숨겨진다. 그때는 이 목록에서 빼고
// 시험용 계정은 로그인해서 '제작자 배우 검색에 내 프로필 공개'를 끄거나 탈퇴시키면 된다.

export const HIDDEN_ACTOR_NAMES = ['캐스팅플로우', '김용환', '이서윤', '테스트배우'];

const compact = (name: string) => name.replace(/\s+/g, '').toLowerCase();

export function isHiddenActor(name: string) {
  const value = compact(name);
  if (!value) return false;
  if (value.startsWith('[테스트]') || value.startsWith('[test]')) return true;
  return HIDDEN_ACTOR_NAMES.some((hidden) => compact(hidden) === value);
}
