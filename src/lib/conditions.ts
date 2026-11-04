// 지원서의 '촬영 가능·지역 이동·출연료 수용' 답(yes·no·unsure)을 보여 주는 말과 색.
// 가능은 초록, 불가는 빨강, 조율 필요는 주황으로 화면마다 똑같이 쓴다.

export function conditionLabel(value: string) {
  return value === 'yes'
    ? '가능'
    : value === 'no'
      ? '불가'
      : value === 'unsure'
        ? '조율 필요'
        : '미응답';
}

/** 글자 색 클래스(globals.css의 .cond-yes / .cond-no / .cond-unsure) */
export function conditionTone(value: string) {
  return value === 'yes'
    ? 'cond-yes'
    : value === 'no'
      ? 'cond-no'
      : value === 'unsure'
        ? 'cond-unsure'
        : '';
}
