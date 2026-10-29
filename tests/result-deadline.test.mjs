import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESULT_WARNING_DAYS,
  dDayLabel,
  daysUntilResult,
  isResultDueSoon,
  isResultOverdue,
  kstToday,
  resultDueDate,
} from '../src/lib/result-deadline.ts';

test('결과 기준일: 결과 안내일과 오디션 종료일 중 늦은 날', () => {
  assert.equal(resultDueDate('2026-11-10', '2026-11-14'), '2026-11-14');
  assert.equal(resultDueDate('2026-11-20', '2026-11-14'), '2026-11-20');
  assert.equal(resultDueDate('2026-11-20'), '2026-11-20');
  assert.equal(resultDueDate('2026-11-20', ''), '2026-11-20');
});

test('결과 기준일: 날짜가 아닌 값은 쓰지 않는다', () => {
  // 예전 공고의 글자 날짜는 자동 안내 기준이 되지 않는다
  assert.equal(resultDueDate('11월 20일', '2026-11-14'), '');
  assert.equal(resultDueDate(''), '');
  assert.equal(resultDueDate('2026-02-30'), '');
  assert.equal(resultDueDate('2026-11-20', '미정'), '2026-11-20');
});

test('자동 안내: 기준일 당일까지는 하지 않고 다음 날부터 한다', () => {
  assert.equal(isResultOverdue('2026-11-20', '2026-11-19'), false);
  assert.equal(isResultOverdue('2026-11-20', '2026-11-20'), false);
  assert.equal(isResultOverdue('2026-11-20', '2026-11-21'), true);
  assert.equal(isResultOverdue('', '2030-01-01'), false);
});

test('남은 날 수와 미리 알림 기간', () => {
  assert.equal(daysUntilResult('2026-11-20', '2026-11-17'), 3);
  assert.equal(daysUntilResult('2026-11-20', '2026-11-20'), 0);
  assert.equal(daysUntilResult('2026-11-20', '2026-11-22'), -2);
  assert.equal(daysUntilResult('', '2026-11-22'), null);
  // 월 경계
  assert.equal(daysUntilResult('2026-12-01', '2026-11-30'), 1);
  assert.equal(RESULT_WARNING_DAYS, 3);
  assert.equal(isResultDueSoon('2026-11-20', '2026-11-16'), false);
  assert.equal(isResultDueSoon('2026-11-20', '2026-11-17'), true);
  assert.equal(isResultDueSoon('2026-11-20', '2026-11-20'), true);
  assert.equal(isResultDueSoon('2026-11-20', '2026-11-21'), false);
  assert.equal(dDayLabel(2), 'D-2');
  assert.equal(dDayLabel(0), 'D-day');
});

test('한국 시간 기준 오늘: UTC 15시면 한국은 이미 다음 날', () => {
  assert.equal(kstToday(new Date('2026-11-20T14:59:00Z')), '2026-11-20');
  assert.equal(kstToday(new Date('2026-11-20T15:00:00Z')), '2026-11-21');
});
