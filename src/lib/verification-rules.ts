// 제작진 인증 판정 규칙. AI는 서류에서 사실(종류·이름·학교·발급일·사업자번호·위변조 흔적)만 읽어 오고,
// 승인·거절은 여기 고정된 규칙으로 정한다. 규칙이 코드에 있어야 왜 거절됐는지 설명할 수 있고 테스트할 수 있다.

export type VerificationKind = 'school' | 'business';

/** 학교 인증 유효 기간: 기획서 '재학증명서(1년마다 갱신)' */
export const SCHOOL_VALID_DAYS = 365;
/** 재학증명서는 최근 발급본만 받는다 */
export const CERT_MAX_AGE_DAYS = 90;

/** AI가 서류에서 읽어 온 내용 */
export type DocumentFacts = {
  document_type: 'enrollment_certificate' | 'business_registration' | 'other';
  readable: boolean;
  /** 재학증명서: 학생 이름 / 사업자등록증: 대표자 이름 */
  person_name: string;
  /** 학교 이름 / 상호(법인명) */
  organization: string;
  department: string;
  /** 재학·휴학·졸업 등 학적 상태 (재학증명서만) */
  enrollment_status: string;
  /** YYYY-MM-DD, 못 읽으면 '' */
  issue_date: string;
  /** 사업자등록번호 숫자 10자리(하이픈 없이), 없으면 '' */
  business_number: string;
  /** 위·변조나 합성이 의심되는 근거. 없으면 빈 목록 */
  tampering_signs: string[];
};

export type Verdict = {
  approved: boolean;
  /** 거절 사유(사용자에게 그대로 보여 준다). 승인이면 빈 목록 */
  reasons: string[];
  orgName: string;
  detail: string;
};

const compact = (value: string) => value.replace(/[\s·.()（）]/g, '').toLowerCase();

/** 이름이 같은지. 서류에 '홍*동'처럼 가려져 있으면 *를 아무 글자 하나로 본다. */
export function namesMatch(documentName: string, accountName: string) {
  const doc = compact(documentName);
  const account = compact(accountName);
  if (!doc || !account) return false;
  if (doc === account) return true;
  if (!doc.includes('*') || doc.length !== account.length) return false;
  return [...doc].every((char, index) => char === '*' || char === account[index]);
}

/** 사업자등록번호 검증(국세청 체크섬). 형식이 맞는지까지만 보고, 실제 영업 상태는 보지 않는다. */
export function isValidBusinessNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!/^\d{10}$/.test(digits)) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(digits[index]) * weights[index];
  sum += Math.floor((Number(digits[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(digits[9]);
}

export function maskBusinessNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-*****` : '';
}

function daysSince(date: string, today: string) {
  const from = Date.parse(`${date}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  return Number.isNaN(from) ? null : Math.round((to - from) / 86400000);
}

/** 서류 판정 */
export function judgeDocument(
  kind: VerificationKind,
  facts: DocumentFacts,
  account: { name: string; orgName: string },
  today: string,
): Verdict {
  const reasons: string[] = [];
  if (!facts.readable)
    reasons.push('서류 글씨를 읽을 수 없어요. 밝은 곳에서 전체가 나오게 다시 찍어 주세요.');
  if (facts.tampering_signs.length)
    reasons.push(`서류가 수정되었을 수 있어요: ${facts.tampering_signs.slice(0, 2).join(', ')}`);

  if (kind === 'school') {
    if (facts.document_type !== 'enrollment_certificate')
      reasons.push('재학증명서가 아닌 것 같아요. 학교에서 발급한 재학증명서를 올려 주세요.');
    if (!namesMatch(facts.person_name, account.name))
      reasons.push(`서류의 이름(${facts.person_name || '확인 안 됨'})이 계정 이름과 달라요.`);
    if (!facts.enrollment_status.includes('재학'))
      reasons.push(`재학 상태가 확인되지 않아요(${facts.enrollment_status || '표시 없음'}).`);
    const age = facts.issue_date ? daysSince(facts.issue_date, today) : null;
    if (age === null) reasons.push('발급일을 확인할 수 없어요.');
    else if (age < 0) reasons.push('발급일이 오늘보다 뒤로 되어 있어요.');
    else if (age > CERT_MAX_AGE_DAYS)
      reasons.push(`${CERT_MAX_AGE_DAYS}일 안에 발급한 재학증명서만 받을 수 있어요.`);
    if (!facts.organization) reasons.push('학교 이름을 확인할 수 없어요.');
    return {
      approved: reasons.length === 0,
      reasons,
      orgName: facts.organization,
      detail: facts.department,
    };
  }

  if (facts.document_type !== 'business_registration')
    reasons.push('사업자등록증이 아닌 것 같아요. 사업자등록증(또는 사업자등록증명)을 올려 주세요.');
  if (!isValidBusinessNumber(facts.business_number))
    reasons.push('사업자등록번호가 올바르지 않거나 읽을 수 없어요.');
  const sameOrg =
    Boolean(account.orgName.trim()) &&
    Boolean(facts.organization) &&
    (compact(facts.organization).includes(compact(account.orgName)) ||
      compact(account.orgName).includes(compact(facts.organization)));
  if (!namesMatch(facts.person_name, account.name) && !sameOrg)
    reasons.push(
      '대표자 이름이나 상호가 계정 정보(이름·소속)와 달라요. 가입 정보의 소속을 상호와 같게 맞춰 주세요.',
    );
  if (!facts.organization) reasons.push('상호를 확인할 수 없어요.');
  return {
    approved: reasons.length === 0,
    reasons,
    orgName: facts.organization,
    detail: maskBusinessNumber(facts.business_number),
  };
}

/** 학교 이메일: 대학 도메인(.ac.kr)만 받는다. */
export function schoolEmailDomain(email: string) {
  const match = /^[^\s@]+@([a-z0-9-]+(?:\.[a-z0-9-]+)*\.ac\.kr)$/i.exec(email.trim());
  return match ? match[1].toLowerCase() : null;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

/** 화면 표시용 배지. 학교 인증과 제작사 인증은 따로 붙고, 둘 다 있으면 둘 다 보인다. */
export type ProducerBadges = {
  school?: { name: string; until: string };
  business?: { name: string };
};

export const UNVERIFIED_NOTE = '이전 작품 이력이 확인되지 않았어요';
