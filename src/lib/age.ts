// 만 나이 계산. AI 없이 날짜만 비교한다.
// 서버(Vercel)는 UTC로 돌아가므로 '오늘'은 늘 한국 날짜로 본다.
// 그러지 않으면 생일 당일 새벽 0~9시에 서버 화면에서만 한 살 적게 나온다.

/** 한국 기준 오늘 'YYYY-MM-DD' */
export function koreaToday(now = new Date()): string {
  // en-CA 형식이 YYYY-MM-DD로 나온다.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * 생년월일(YYYY-MM-DD)로 한국 날짜 기준 만 나이를 구한다.
 * 올해 생일(월·일)이 아직 안 왔으면 한 살을 뺀다. 생일 당일부터 한 살 많아진다.
 * 2월 29일생은 평년에는 3월 1일에 한 살 많아진다(2월 28일까지는 그대로).
 * 없는 날짜이거나 1~120세 밖이면 null.
 */
export function manAge(birthDate: string, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  // 2023-02-30 같은 없는 날짜는 받지 않는다.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  const [nowYear, nowMonth, nowDay] = koreaToday(now).split('-').map(Number);
  let age = nowYear - year;
  if (nowMonth < month || (nowMonth === month && nowDay < day)) age -= 1;
  // 지원서 서버 검사와 같은 범위(1~120세)
  return age >= 1 && age <= 120 ? age : null;
}
