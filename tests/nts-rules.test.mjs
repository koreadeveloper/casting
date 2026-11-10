import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeServiceKey,
  ntsFailureCode,
  businessInputProblems,
  judgeBusiness,
  looksLikeOwner,
  ntsRequestItem,
  readNtsItem,
} from '../src/lib/nts-rules.ts';

// 검증 숫자가 맞는 예시 번호(국세청 체크섬 규칙)
const input = {
  businessNumber: '220-81-62517',
  ownerName: '홍길동',
  openDate: '2020-03-02',
  companyName: '세종필름',
};
const ok = { matched: true, statusCode: '01', statusText: '계속사업자' };

test('입력 형식 검사', () => {
  assert.deepEqual(businessInputProblems(input, '2026-11-06'), []);
  assert.equal(businessInputProblems({ ...input, businessNumber: '123' }, '2026-11-06').length, 1);
  assert.match(
    businessInputProblems({ ...input, openDate: '2030-01-01' }, '2026-11-06')[0],
    /오늘보다 뒤/,
  );
});

test('국세청에 보낼 값: 숫자만, 날짜는 YYYYMMDD', () => {
  const item = ntsRequestItem(input);
  assert.equal(item.b_no, '2208162517');
  assert.equal(item.start_dt, '20200302');
  assert.equal(item.p_nm, '홍길동');
  assert.equal(item.b_nm, '세종필름');
});

test('국세청 응답 읽기', () => {
  assert.deepEqual(
    readNtsItem({ valid: '01', status: { b_stt_cd: '01', b_stt: '계속사업자' } }),
    ok,
  );
  assert.equal(readNtsItem({ valid: '02', valid_msg: '확인할 수 없습니다.' }).matched, false);
  assert.equal(readNtsItem(null).matched, false);
});

test('국세청 기록과 일치하고 계속사업자면 승인 (계정 이름·소속과는 맞춰 보지 않음)', () => {
  const verdict = judgeBusiness(input, ok);
  assert.equal(verdict.approved, true);
  assert.equal(verdict.orgName, '세종필름');
  assert.equal(verdict.detail, '220-81-*****');
});

test('불일치·휴업·폐업은 거절', () => {
  assert.equal(judgeBusiness(input, { ...ok, matched: false }).approved, false);
  assert.match(judgeBusiness(input, { ...ok, statusCode: '02' }).reasons[0], /휴업/);
  assert.match(judgeBusiness(input, { ...ok, statusCode: '03' }).reasons[0], /폐업/);
});

test('서비스 키: Encoding 값·공백이 섞여도 Decoding 값으로 맞춘다', () => {
  const decoded = 'abc+def/ghi==';
  assert.equal(normalizeServiceKey(decoded), decoded);
  assert.equal(normalizeServiceKey('abc%2Bdef%2Fghi%3D%3D'), decoded);
  assert.equal(normalizeServiceKey(' abc+def/ghi==\n'), decoded);
  // 잘못된 %는 그대로 둔다
  assert.equal(normalizeServiceKey('abc%zz'), 'abc%zz');
});

test('국세청 실패 코드: HTTP 상태와 응답 코드를 짧게', () => {
  assert.equal(ntsFailureCode(401, null), '401');
  assert.equal(ntsFailureCode(200, { status_code: 'BAD_JSON_REQUEST' }), '200·BAD_JSON_REQUEST');
  assert.equal(ntsFailureCode(401, { code: -4, msg: '등록되지 않은 인증키 입니다.' }), '401·-4');
});

test('본인 사업자로 보이는지: 대표자 성명이나 상호가 계정 정보와 맞으면 참', () => {
  // input: 대표자 홍길동, 상호 세종필름
  assert.equal(looksLikeOwner(input, { name: '홍길동', orgName: '' }), true);
  assert.equal(looksLikeOwner(input, { name: '김팀원', orgName: '(주)세종필름' }), true);
  assert.equal(looksLikeOwner(input, { name: '김팀원', orgName: '세종필름 연출팀' }), true);
  // 둘 다 다르면 관리자가 확인한다
  assert.equal(looksLikeOwner(input, { name: '세종마켓', orgName: '다른회사' }), false);
  assert.equal(looksLikeOwner(input, { name: '김팀원', orgName: '' }), false);
});
