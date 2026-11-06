// 국세청 사업자등록정보 진위확인 결과로 제작사 인증을 판정하는 규칙. DB·Next·네트워크에 기대지 않아 테스트로 지킨다.
// 조회 자체는 nts.ts가 하고, 승인·거절은 여기 고정된 규칙으로 정한다.

import {
  isValidBusinessNumber,
  maskBusinessNumber,
  namesMatch,
  type Verdict,
} from './verification-rules.ts';

/** 사용자가 입력한 사업자 정보 */
export type BusinessInput = {
  /** 사업자등록번호(하이픈 있어도 됨) */
  businessNumber: string;
  /** 대표자 성명 */
  ownerName: string;
  /** 개업일자 YYYY-MM-DD */
  openDate: string;
  /** 상호 */
  companyName: string;
};

/** 국세청 조회 결과에서 판정에 쓰는 값 */
export type NtsResult = {
  /** 입력한 번호·대표자·개업일(·상호)이 국세청 기록과 맞는지 */
  matched: boolean;
  /** 01 계속사업자 · 02 휴업자 · 03 폐업자 · '' 알 수 없음 */
  statusCode: string;
  statusText: string;
};

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

/** 입력값 형식 검사. 문제가 있으면 사용자에게 보여 줄 말, 없으면 빈 목록 */
export function businessInputProblems(input: BusinessInput, today: string) {
  const problems: string[] = [];
  if (!isValidBusinessNumber(input.businessNumber))
    problems.push('사업자등록번호 10자리를 정확히 입력해 주세요.');
  if (!input.ownerName.trim()) problems.push('대표자 성명을 입력해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.openDate)) problems.push('개업일자를 입력해 주세요.');
  else if (input.openDate > today) problems.push('개업일자가 오늘보다 뒤로 되어 있어요.');
  if (!input.companyName.trim()) problems.push('상호를 입력해 주세요.');
  return problems;
}

/** 국세청 API에 보낼 한 건(validate 요청의 businesses 항목) */
export function ntsRequestItem(input: BusinessInput) {
  return {
    b_no: digitsOnly(input.businessNumber),
    start_dt: input.openDate.replace(/-/g, ''),
    p_nm: input.ownerName.trim(),
    p_nm2: '',
    b_nm: input.companyName.trim(),
    corp_no: '',
    b_sector: '',
    b_type: '',
  };
}

/** 국세청 validate 응답 한 건을 판정용 값으로 */
export function readNtsItem(item: unknown): NtsResult {
  const row = (item ?? {}) as { valid?: unknown; status?: { b_stt_cd?: unknown; b_stt?: unknown } };
  return {
    matched: row.valid === '01',
    statusCode: typeof row.status?.b_stt_cd === 'string' ? row.status.b_stt_cd : '',
    statusText: typeof row.status?.b_stt === 'string' ? row.status.b_stt : '',
  };
}

/**
 * 판정: 국세청 기록과 일치하고 계속사업자여야 하며, 대표자가 계정 주인이거나 상호가 가입 정보의 소속과 같아야 한다.
 * (사업자번호·대표자·개업일은 남이 알 수도 있는 정보라, 계정 정보와도 맞춰 본다)
 */
export function judgeBusiness(
  input: BusinessInput,
  nts: NtsResult,
  account: { name: string; orgName: string },
): Verdict {
  const reasons: string[] = [];
  if (!nts.matched)
    reasons.push(
      '국세청 기록과 일치하지 않아요. 사업자등록번호·대표자 성명·개업일자·상호를 사업자등록증과 똑같이 입력해 주세요.',
    );
  else if (nts.statusCode === '02') reasons.push('휴업 중인 사업자로 조회돼요.');
  else if (nts.statusCode === '03') reasons.push('폐업한 사업자로 조회돼요.');
  else if (nts.statusCode !== '01') reasons.push('사업자 상태를 확인할 수 없어요.');

  const compact = (value: string) =>
    value.replace(/[\s·.()（）]|주식회사|\(주\)/g, '').toLowerCase();
  const sameOrg =
    Boolean(account.orgName.trim()) &&
    (compact(input.companyName).includes(compact(account.orgName)) ||
      compact(account.orgName).includes(compact(input.companyName)));
  if (!namesMatch(input.ownerName, account.name) && !sameOrg)
    reasons.push(
      '대표자 성명이나 상호가 계정 정보(이름·소속)와 달라요. 가입 정보의 소속을 상호와 같게 맞춰 주세요.',
    );
  return {
    approved: reasons.length === 0,
    reasons,
    orgName: input.companyName.trim(),
    detail: maskBusinessNumber(input.businessNumber),
  };
}
