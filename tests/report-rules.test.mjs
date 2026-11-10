import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REPORT_REASONS,
  isReportClosed,
  isReportStatus,
  isReportTarget,
  parseReport,
  reportReasons,
} from '../src/lib/report-rules.ts';

const ok = {
  reason: 'fake_role',
  body: '촬영 장소와 출연료가 공고와 전혀 달랐어요.',
  email: 'A@Ex.com',
  agree: true,
};

test('신고 대상 종류', () => {
  assert.equal(isReportTarget('role'), true);
  assert.equal(isReportTarget('actor'), true);
  assert.equal(isReportTarget('chat'), true);
  assert.equal(isReportTarget('user'), false);
  assert.equal(isReportTarget('toString'), false);
});

test('대상·신고하는 쪽마다 고를 수 있는 사유', () => {
  // 모든 사유는 이름이 있다
  for (const target of ['role', 'actor', 'chat'])
    for (const side of ['guest', 'actor', 'producer'])
      for (const reason of reportReasons(target, side)) assert.ok(REPORT_REASONS[reason]);
  // 무단 불참은 제작진이 대화(배우)를 신고할 때만
  assert.ok(reportReasons('chat', 'producer').includes('no_show'));
  assert.ok(!reportReasons('chat', 'actor').includes('no_show'));
  assert.ok(!reportReasons('role', 'guest').includes('no_show'));
  assert.ok(!reportReasons('actor', 'producer').includes('no_show'));
  // 배우가 대화(제작진)를 신고할 때는 부적절한 요구·출연료 문제를 고를 수 있다
  assert.ok(reportReasons('chat', 'actor').includes('inappropriate_request'));
  assert.ok(reportReasons('chat', 'actor').includes('pay'));
  // 모든 경우 '기타'가 있다
  for (const target of ['role', 'actor', 'chat'])
    assert.ok(reportReasons(target, 'producer').includes('other'));
});

test('입력 검사: 정상', () => {
  assert.deepEqual(parseReport(ok, 'role', 'guest'), {
    reason: 'fake_role',
    body: ok.body,
    email: 'a@ex.com',
  });
});

test('입력 검사: 그 대상에서 고를 수 없는 사유는 거절', () => {
  assert.match(parseReport({ ...ok, reason: 'no_show' }, 'role', 'guest').error, /사유/);
  assert.match(parseReport({ ...ok, reason: 'no_show' }, 'chat', 'actor').error, /사유/);
  assert.equal('error' in parseReport({ ...ok, reason: 'no_show' }, 'chat', 'producer'), false);
  assert.match(parseReport({ ...ok, reason: '' }, 'role', 'guest').error, /사유/);
  assert.match(parseReport({ ...ok, reason: 'constructor' }, 'role', 'guest').error, /사유/);
});

test('입력 검사: 내용 길이·이메일·동의', () => {
  assert.match(parseReport({ ...ok, body: '짧아요' }, 'role', 'guest').error, /10자/);
  assert.match(parseReport({ ...ok, body: '          ' }, 'role', 'guest').error, /10자/);
  assert.equal(parseReport({ ...ok, body: 'x'.repeat(5000) }, 'role', 'guest').body.length, 2000);
  assert.match(parseReport({ ...ok, email: 'not-email' }, 'role', 'guest').error, /이메일/);
  assert.match(parseReport({ ...ok, agree: false }, 'role', 'guest').error, /동의/);
  assert.match(parseReport({ ...ok, agree: 'true' }, 'role', 'guest').error, /동의/);
});

test('입력 검사: 계정 이메일이 있으면 입력한 이메일 대신 그것을 쓴다', () => {
  const parsed = parseReport({ ...ok, email: '' }, 'role', 'producer', 'Me@Team.kr');
  assert.equal(parsed.email, 'me@team.kr');
  assert.equal(
    parseReport({ ...ok, email: 'other@x.com' }, 'role', 'producer', 'me@team.kr').email,
    'me@team.kr',
  );
});

test('처리 상태', () => {
  assert.equal(isReportStatus('new'), true);
  assert.equal(isReportStatus('done'), false);
  assert.equal(isReportClosed('actioned'), true);
  assert.equal(isReportClosed('dismissed'), true);
  assert.equal(isReportClosed('reviewing'), false);
  assert.equal(isReportClosed('new'), false);
});
