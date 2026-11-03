// 이용약관·개인정보처리방침에 들어가는 운영 정보.
export const LEGAL = {
  service: '캐스팅플로우',
  operator: '캐스팅플로우 팀',
  /** 개인정보 보호책임자. 법에서 성명 대신 부서명도 허용한다. 담당자가 정해지면 이름으로 바꿔도 된다. */
  officer: '캐스팅플로우 운영팀',
  /**
   * 개인정보·탈퇴·신고 문의를 받을 팀 이메일. 비어 있으면 처리방침·약관에서 이메일 줄을 숨기고
   * 문의하기 화면(/contact)으로만 안내한다. 채우면 문의 알림 메일도 이 주소로 간다(메일 설정 시).
   */
  contact: '',
  /** 약관과 처리방침이 효력을 갖는 날. 내용을 바꾸면 새 날짜로 고친다. */
  effective: '2026년 11월 3일',
};

export const TERMS_PATH = '/terms';
export const PRIVACY_PATH = '/privacy';
