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

/**
 * 공공데이터포털 서비스 키를 Decoding 값으로 맞춘다.
 * 포털은 같은 키를 Encoding(%2B·%3D 등이 섞인 값)·Decoding 두 가지로 보여 주는데, 요청할 때 한 번 더 인코딩하므로
 * Encoding 값을 그대로 쓰면 키가 망가진다. 복사하다 딸려 온 공백·줄바꿈도 지운다.
 */
export function normalizeServiceKey(raw: string) {
  const key = raw.replace(/\s/g, '');
  if (!/%[0-9a-f]{2}/i.test(key)) return key;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

/** 국세청 조회 실패를 사용자에게 알릴 때 붙이는 짧은 코드. 로그를 열지 않아도 원인을 좁힐 수 있게 한다. */
export function ntsFailureCode(httpStatus: number, body: unknown) {
  const data = (body ?? {}) as { status_code?: unknown; code?: unknown };
  const detail =
    typeof data.status_code === 'string' && data.status_code !== 'OK'
      ? data.status_code
      : typeof data.code === 'number' || typeof data.code === 'string'
        ? String(data.code)
        : '';
  return detail ? `${httpStatus}·${detail}`.slice(0, 40) : String(httpStatus);
}

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
 * 판정: 국세청 기록과 일치하고 계속사업자면 승인한다.
 * 계정 이름·소속과는 맞춰 보지 않는다. 둘 다 가입할 때 본인이 적는 값이라 사칭을 막지 못하고,
 * 직원이 대신 인증하거나 닉네임으로 가입한 사람만 막혔다. 대신 인증 표시에 국세청에서 확인한 상호를 보여 주고,
 * 남의 사업자로 받은 인증은 신고를 받아 관리자가 거둔다.
 */
export function judgeBusiness(input: BusinessInput, nts: NtsResult): Verdict {
  const reasons: string[] = [];
  if (!nts.matched)
    reasons.push(
      '국세청 기록과 일치하지 않아요. 사업자등록번호·대표자 성명·개업일자·상호를 사업자등록증과 똑같이 입력해 주세요.',
    );
  else if (nts.statusCode === '02') reasons.push('휴업 중인 사업자로 조회돼요.');
  else if (nts.statusCode === '03') reasons.push('폐업한 사업자로 조회돼요.');
  else if (nts.statusCode !== '01') reasons.push('사업자 상태를 확인할 수 없어요.');
  return {
    approved: reasons.length === 0,
    reasons,
    orgName: input.companyName.trim(),
    detail: maskBusinessNumber(input.businessNumber),
  };
}

/**
 * 본인(또는 본인 소속) 사업자로 보이는지: 대표자 성명이 계정 이름과 같거나, 상호가 가입 정보의 소속명과 같다.
 * 승인 여부와는 상관없다(그래서 judgeBusiness와 따로 둔다). 맞으면 관리자 확인함에서 자동으로 확인 처리하고,
 * 둘 다 다를 때만 관리자가 본다. 대표자 성명은 여기서 비교만 하고 저장하지 않는다.
 */
export function looksLikeOwner(input: BusinessInput, account: { name: string; orgName: string }) {
  const compact = (value: string) =>
    value.replace(/[\s·.()（）]|주식회사|\(주\)/g, '').toLowerCase();
  const company = compact(input.companyName);
  const org = compact(account.orgName);
  const sameOrg = Boolean(company && org) && (company.includes(org) || org.includes(company));
  return sameOrg || namesMatch(input.ownerName, account.name);
}
