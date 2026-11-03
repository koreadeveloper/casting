// 만 14세 미만 지원 정책(파일럿). 개인정보보호법상 만 14세 미만의 개인정보를 받으려면 법정대리인 동의가
// 필요한데, 아직 보호자 동의 절차가 없어서 지원서를 받지 않고 보호자가 제작진에게 직접 문의하도록 안내한다.

export const MIN_APPLY_AGE = 14;

export const CHILD_APPLY_MESSAGE =
  '만 14세 미만은 지금은 지원서를 받을 수 없어요. 보호자가 제작진에게 직접 문의해 주세요.';

/** 지원자 나이가 만 14세 미만인지(나이를 모르면 false) */
export function isUnderApplyAge(age: number | null | undefined) {
  return typeof age === 'number' && age < MIN_APPLY_AGE;
}

/** 모집 연령이 모두 만 14세 미만인 아역 배역인지(최대 나이가 1~13세) */
export function isChildRole(ageMin: number, ageMax: number) {
  return ageMax > 0 && ageMax < MIN_APPLY_AGE && ageMin <= ageMax;
}

/** 모집 연령에 만 14세 미만이 들어가는지(프로젝트 등록 화면 안내용) */
export function includesChildAge(ageMin: number, ageMax: number) {
  return (ageMin > 0 && ageMin < MIN_APPLY_AGE) || (ageMax > 0 && ageMax < MIN_APPLY_AGE);
}
