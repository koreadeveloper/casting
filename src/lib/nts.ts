// 국세청 사업자등록정보 진위확인 조회(공공데이터포털 '국세청_사업자등록정보 진위확인 및 상태조회 서비스').
// 서버에서만 쓴다. 서비스 키는 환경변수 NTS_SERVICE_KEY(공공데이터포털의 일반 인증키. Decoding·Encoding 값 둘 다 받는다).

import {
  normalizeServiceKey,
  ntsFailureCode,
  ntsRequestItem,
  readNtsItem,
  type BusinessInput,
  type NtsResult,
} from './nts-rules';

const ENDPOINT = 'https://api.odcloud.kr/api/nts-businessman/v1/validate';

export class NtsUnavailable extends Error {}

export function ntsConfigured() {
  return Boolean(normalizeServiceKey(process.env.NTS_SERVICE_KEY || ''));
}

export async function validateBusiness(input: BusinessInput): Promise<NtsResult> {
  const key = normalizeServiceKey(process.env.NTS_SERVICE_KEY || '');
  if (!key)
    throw new NtsUnavailable('사업자 조회가 아직 설정되지 않았어요. 잠시 뒤에 다시 시도해 주세요.');
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&returnType=JSON`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ businesses: [ntsRequestItem(input)] }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error('국세청 조회 연결 실패', error);
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new NtsUnavailable(
      `국세청 조회에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요. (코드 ${timedOut ? '시간 초과' : '연결 실패'})`,
    );
  }
  const data = (await response.json().catch(() => null)) as {
    status_code?: string;
    data?: unknown[];
  } | null;
  if (!response.ok || !data || data.status_code !== 'OK' || !Array.isArray(data.data)) {
    console.error('국세청 조회 실패', response.status, data);
    // 코드 예: 401(키가 틀림·미승인), 429(호출 한도 초과), 500대(국세청 쪽 장애)
    throw new NtsUnavailable(
      `국세청 조회가 지금 되지 않아요. 잠시 뒤에 다시 시도해 주세요. (코드 ${ntsFailureCode(response.status, data)})`,
    );
  }
  return readNtsItem(data.data[0]);
}
