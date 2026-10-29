import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidBusinessNumber,
  judgeDocument,
  maskBusinessNumber,
  namesMatch,
  schoolEmailDomain,
} from '../src/lib/verification-rules.ts';

const account = { name: '전나영', orgName: '봄날필름' };
const cert = {
  document_type: 'enrollment_certificate',
  readable: true,
  person_name: '전나영',
  organization: '한국예술종합학교',
  department: '영상원 영화과',
  enrollment_status: '재학',
  issue_date: '2026-10-20',
  business_number: '',
  tampering_signs: [],
};
const biz = {
  document_type: 'business_registration',
  readable: true,
  person_name: '김대표',
  organization: '봄날필름',
  department: '',
  enrollment_status: '',
  issue_date: '2024-03-02',
  business_number: '1248100998',
  tampering_signs: [],
};

test('이름 비교: 띄어쓰기 무시, 가린 글자(*) 허용', () => {
  assert.ok(namesMatch('전 나영', '전나영'));
  assert.ok(namesMatch('전*영', '전나영'));
  assert.ok(!namesMatch('김나영', '전나영'));
  assert.ok(!namesMatch('', '전나영'));
});

test('사업자등록번호 체크섬', () => {
  assert.ok(isValidBusinessNumber('124-81-00998'));
  assert.ok(!isValidBusinessNumber('124-81-00999'));
  assert.ok(!isValidBusinessNumber('12345'));
  assert.equal(maskBusinessNumber('1248100998'), '124-81-*****');
});

test('재학증명서: 조건이 다 맞으면 승인', () => {
  const verdict = judgeDocument('school', cert, account, '2026-10-29');
  assert.deepEqual(verdict.reasons, []);
  assert.ok(verdict.approved);
  assert.equal(verdict.orgName, '한국예술종합학교');
});

test('재학증명서: 이름·재학 상태·발급일·위변조 각각 거절', () => {
  const today = '2026-10-29';
  assert.ok(!judgeDocument('school', { ...cert, person_name: '홍길동' }, account, today).approved);
  assert.ok(
    !judgeDocument('school', { ...cert, enrollment_status: '졸업' }, account, today).approved,
  );
  assert.ok(
    !judgeDocument('school', { ...cert, issue_date: '2026-01-02' }, account, today).approved,
  );
  assert.ok(
    !judgeDocument('school', { ...cert, issue_date: '2026-11-30' }, account, today).approved,
  );
  assert.ok(
    !judgeDocument('school', { ...cert, tampering_signs: ['이름 칸 글꼴이 다름'] }, account, today)
      .approved,
  );
  assert.ok(!judgeDocument('school', { ...cert, document_type: 'other' }, account, today).approved);
  // 사업자등록증을 학교 인증에 올리면 거절
  assert.ok(!judgeDocument('school', biz, account, today).approved);
});

test('사업자등록증: 대표자가 달라도 상호가 소속과 같으면 승인', () => {
  const verdict = judgeDocument('business', biz, account, '2026-10-29');
  assert.ok(verdict.approved, verdict.reasons.join());
  assert.equal(verdict.detail, '124-81-*****');
  assert.ok(
    !judgeDocument('business', biz, { name: '전나영', orgName: '다른회사' }, '2026-10-29').approved,
  );
  assert.ok(
    !judgeDocument('business', { ...biz, business_number: '1248100999' }, account, '2026-10-29')
      .approved,
  );
});

test('학교 이메일은 .ac.kr만', () => {
  assert.equal(schoolEmailDomain('me@karts.ac.kr'), 'karts.ac.kr');
  assert.equal(schoolEmailDomain('me@mail.hanyang.ac.kr'), 'mail.hanyang.ac.kr');
  assert.equal(schoolEmailDomain('me@gmail.com'), null);
  assert.equal(schoolEmailDomain('me@ac.kr.evil.com'), null);
});
