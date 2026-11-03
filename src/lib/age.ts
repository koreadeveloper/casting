/**
 * 생년월일(YYYY-MM-DD)로 오늘 기준 만 나이를 구한다.
 * 올해 생일이 아직 안 지났으면 한 살을 뺀다. 날짜가 이상하면 null.
 */
export function manAge(birthDate: string, today = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  // 지원서 서버 검사와 같은 범위(1~120세)
  return age >= 1 && age <= 120 ? age : null;
}
