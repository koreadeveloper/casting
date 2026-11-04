// 화면에 보이는 날짜 형식을 하나로 맞춘다: '2026. 12. 5.' (toLocaleDateString('ko-KR')과 같은 모양)
// 'YYYY-MM-DD'는 시간대 영향 없이 글자 그대로 바꾸고, 시각이 들어 있으면 한국 날짜로 본다.

export function koDate(value: string | null | undefined): string {
  if (!value) return '';
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain) return `${Number(plain[1])}. ${Number(plain[2])}. ${Number(plain[3])}.`;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}
