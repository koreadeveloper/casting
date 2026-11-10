// 관리자 화면에서 쓰는 날짜 표시. 서버·브라우저가 같은 글자를 내도록 한국 시간으로 고정한다.

const dayFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function valid(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 2026.11.10 */
export function formatDay(iso: string | null | undefined) {
  const date = valid(iso);
  return date ? dayFormat.format(date).replace(/\s/g, '').replace(/\.$/, '') : (iso ?? '');
}

/** 2026.11.10 15:03 */
export function formatDateTime(iso: string | null | undefined) {
  const date = valid(iso);
  return date ? `${formatDay(iso)} ${timeFormat.format(date)}` : (iso ?? '');
}
