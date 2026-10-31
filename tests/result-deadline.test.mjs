import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import {
  RESULT_WARNING_DAYS,
  dDayLabel,
  daysUntilResult,
  isResultDelayed,
  isResultDueSoon,
  isResultOverdue,
  kstToday,
  resultDueDate,
  resultNoticeKind,
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

test('기준일 지남: 당일까지는 아니고 다음 날부터', () => {
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

test('결과 안내 지연: 결과 전이고 기준일이 지났을 때만', () => {
  assert.equal(isResultDelayed('received', '2026-11-20', '2026-11-20'), false);
  assert.equal(isResultDelayed('received', '2026-11-20', '2026-11-21'), true);
  // 제작진이 정한 결과는 기준일이 지나도 그대로다(지연이 아니다)
  assert.equal(isResultDelayed('not_selected', '2026-11-20', '2026-11-21'), false);
  assert.equal(isResultDelayed('cast', '2026-11-20', '2026-11-21'), false);
  assert.equal(isResultDelayed('audition', '2026-11-20', '2026-11-21'), false);
  // 기준일이 없는 공고는 지연으로 보지 않는다
  assert.equal(isResultDelayed('received', '', '2030-01-01'), false);
});

test('제작진 결과 알림: 기준일 3일 전부터 요청, 지나면 결과 입력 요청, 결과 전 지원자가 없으면 없음', () => {
  assert.equal(resultNoticeKind('2026-11-20', '2026-11-16', 2), null);
  assert.equal(resultNoticeKind('2026-11-20', '2026-11-17', 2), 'soon');
  assert.equal(resultNoticeKind('2026-11-20', '2026-11-20', 2), 'soon');
  assert.equal(resultNoticeKind('2026-11-20', '2026-11-21', 2), 'overdue');
  assert.equal(resultNoticeKind('2026-11-20', '2027-03-01', 1), 'overdue');
  assert.equal(resultNoticeKind('2026-11-20', '2026-11-21', 0), null);
  assert.equal(resultNoticeKind('', '2026-11-21', 3), null);
});

// 날짜 경과만으로 불합격을 정하거나 공개하는 코드가 다시 들어오지 않게 막는다.
// 결과(public_stage)는 제작진이 고른 값을 받는 updateApplication에서만 바뀌어야 한다.
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

// SQL에 'not_selected'를 직접 박아 넣는 UPDATE(=제작진 선택 없이 불합격 확정)를 찾는다.
const AUTO_REJECT = /public_stage\s*=\s*'not_selected'/;

test('날짜 경과만으로 불합격을 공개하는 코드가 없다', () => {
  // 검사식이 예전 자동 마감 코드를 실제로 잡아내는지 먼저 확인한다.
  assert.ok(
    AUTO_REJECT.test("UPDATE applications SET public_stage='not_selected', result_auto_at=?"),
  );
  const offenders = sourceFiles('src').filter((file) => {
    const code = readFileSync(file, 'utf8');
    return AUTO_REJECT.test(code) || /closeOverdueResults/.test(code);
  });
  assert.deepEqual(offenders, []);
});
