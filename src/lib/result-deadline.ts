// 결과 자동 안내 기준. 순수 함수만 둔다.
// (리프 모듈 유지: node --test에서 바로 불러오도록 lib 내부 import를 두지 않는다)
//
// 제작진이 결과를 정하지 않으면 배우가 무기한 기다리게 된다.
// 그래서 '결과 기준일'(결과 안내일, 오디션 종료일이 더 늦으면 그날)의 다음 날이 되면
// 아직 결과 전인 지원자에게 자동으로 '불합격'을 안내한다. 제작진에게는 며칠 전부터 미리 알린다.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** 기준일 며칠 전부터 제작진에게 미리 알릴지 */
export const RESULT_WARNING_DAYS = 3;

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/** 한국 시간 기준 오늘(YYYY-MM-DD). 날짜 칸이 모두 한국 날짜라 서버 시간대와 상관없이 맞춘다. */
export function kstToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * 결과 기준일: 결과 안내일과 오디션 종료일 중 늦은 날.
 * 올바른 날짜만 쓴다. 예전 공고의 '11월 20일' 같은 글자 값은 날짜로 보지 않는다(자동 안내 안 함).
 */
export function resultDueDate(announcementDate: string, auditionEnd = '') {
  const dates = [announcementDate, auditionEnd].filter(isIsoDate).sort();
  // 결과 안내일이 날짜가 아니면 기준을 세우지 않는다(오디션 종료일만으로는 자동 안내하지 않는다).
  return isIsoDate(announcementDate) ? dates[dates.length - 1] : '';
}

/** 기준일 다음 날부터 자동 안내 대상이다. 기준일 당일까지는 제작진이 정할 수 있다. */
export function isResultOverdue(due: string, today: string) {
  return Boolean(due) && today > due;
}

/** 기준일까지 남은 날 수. 오늘이 기준일이면 0, 지났으면 음수. 기준일이 없으면 null. */
export function daysUntilResult(due: string, today: string): number | null {
  if (!isIsoDate(due) || !isIsoDate(today)) return null;
  const ms = Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** 미리 알림을 띄울 때인지: 기준일까지 0~RESULT_WARNING_DAYS일 남았을 때. */
export function isResultDueSoon(due: string, today: string) {
  const days = daysUntilResult(due, today);
  return days !== null && days >= 0 && days <= RESULT_WARNING_DAYS;
}

/** 'D-2', 오늘이면 'D-day' */
export function dDayLabel(days: number) {
  return days === 0 ? 'D-day' : `D-${days}`;
}
