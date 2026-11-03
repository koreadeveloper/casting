// 출연 불가 일정처럼 날짜('YYYY-MM-DD') 목록을 기간으로 넣고 보여 주는 규칙.
// 저장은 지금처럼 날짜 하나하나의 목록으로 하고(검색·적합도 계산이 그대로 동작), 화면에서만 기간으로 묶는다.

export const MAX_UNAVAILABLE_DAYS = 366;

const DAY = 24 * 60 * 60 * 1000;
const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10);

function valid(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && toDate(toTime(date)) === date;
}

/** 시작~끝(포함) 날짜들. 끝이 비면 하루. 순서가 바뀌어 들어와도 맞춰 주고, 너무 길면 max일까지만. */
export function expandRange(start: string, end = '', max = MAX_UNAVAILABLE_DAYS) {
  if (!valid(start) || (end && !valid(end))) return [];
  let [from, to] = [toTime(start), toTime(end || start)];
  if (from > to) [from, to] = [to, from];
  const days: string[] = [];
  for (let time = from; time <= to && days.length < max; time += DAY) days.push(toDate(time));
  return days;
}

/** 이미 있는 날짜에 새 날짜를 더한다(중복 없이, 정렬, 최대 max일). */
export function addDates(current: string[], added: string[], max = MAX_UNAVAILABLE_DAYS) {
  return [...new Set([...current, ...added])].sort().slice(0, max);
}

/** 이어지는 날짜끼리 묶는다. ['12-01','12-02','12-05'] → [{12-01~12-02, 2일}, {12-05, 1일}] */
export function groupDateRanges(dates: string[]) {
  const sorted = [...new Set(dates.filter(valid))].sort();
  const ranges: { start: string; end: string; days: number }[] = [];
  for (const date of sorted) {
    const last = ranges.at(-1);
    if (last && toTime(date) - toTime(last.end) === DAY) {
      last.end = date;
      last.days += 1;
    } else ranges.push({ start: date, end: date, days: 1 });
  }
  return ranges;
}

/** 화면 표시: '12.1' 또는 '12.1 ~ 12.31 (31일)'. 해가 다르면 연도를 붙인다. */
export function rangeLabel(range: { start: string; end: string; days: number }) {
  const short = (date: string, withYear: boolean) => {
    const [y, m, d] = date.split('-').map(Number);
    return withYear ? `${y}.${m}.${d}` : `${m}.${d}`;
  };
  const thisYear = String(new Date().getFullYear());
  const year = !range.start.startsWith(thisYear) || !range.end.startsWith(thisYear);
  if (range.days === 1) return short(range.start, year);
  return `${short(range.start, year)} ~ ${short(range.end, year)} (${range.days}일)`;
}
