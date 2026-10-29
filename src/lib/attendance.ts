// 촬영 참석 재확인: 출연이 확정(합격)된 배우에게 촬영 며칠 전 참석 여부를 다시 묻는다.
// 기획서 '현장 펑크(노쇼)' 문제에 대한 장치. 날짜 계산만 모아 둬서 테스트할 수 있게 한다.

/** 촬영 며칠 전부터 참석 여부를 묻는지 (D-3 ~ 촬영 당일) */
export const ATTENDANCE_ASK_DAYS = 3;

export type AttendanceStatus = 'yes' | 'no';

export type AttendanceCheck = {
  applicationId: string;
  shootDate: string;
  status: AttendanceStatus;
  note: string;
  respondedAt: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 오늘(KST, YYYY-MM-DD) 이후의 가장 가까운 촬영일. 없으면 ''. 당일도 포함한다. */
export function nextShootDate(shootDates: string[], today: string) {
  return (
    shootDates
      .filter((date) => DATE.test(date) && date >= today)
      .sort()
      .at(0) ?? ''
  );
}

/** 두 날짜(YYYY-MM-DD) 사이의 날 수 */
export function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** 지금 참석 여부를 물어야 하는 촬영일인지 (D-3 ~ 당일) */
export function isAttendanceAskOpen(shootDate: string, today: string) {
  if (!DATE.test(shootDate)) return false;
  const days = daysBetween(today, shootDate);
  return days >= 0 && days <= ATTENDANCE_ASK_DAYS;
}

/** 'D-2', '오늘' 같은 짧은 표시 */
export function shootDayLabel(shootDate: string, today: string) {
  const days = daysBetween(today, shootDate);
  return days === 0 ? '오늘' : days === 1 ? '내일' : `D-${days}`;
}

/** '10월 31일 (금)' */
export function shootDateLabel(shootDate: string) {
  const date = new Date(`${shootDate}T00:00:00+09:00`);
  if (Number.isNaN(date.valueOf())) return shootDate;
  const day = date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  });
  const dow = date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' });
  return `${day} (${dow})`;
}

/** 배우의 답을 대화에 남길 문장. 제작진이 대화에서 바로 이어서 연락할 수 있게 한다. */
export function attendanceMessage(shootDate: string, status: AttendanceStatus, note: string) {
  const when = shootDateLabel(shootDate);
  return status === 'yes'
    ? `✅ ${when} 촬영에 참석할게요.`
    : `⚠️ ${when} 촬영 참석이 어려워요.${note ? `\n사유: ${note}` : ''}`;
}
