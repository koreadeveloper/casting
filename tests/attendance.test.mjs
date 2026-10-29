import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceMessage,
  isAttendanceAskOpen,
  nextShootDate,
  shootDayLabel,
} from '../src/lib/attendance.ts';

test('다음 촬영일: 지난 날은 빼고 당일은 포함', () => {
  const dates = ['2026-11-05', '2026-10-28', '2026-10-29', 'x'];
  assert.equal(nextShootDate(dates, '2026-10-29'), '2026-10-29');
  assert.equal(nextShootDate(dates, '2026-10-30'), '2026-11-05');
  assert.equal(nextShootDate(dates, '2026-11-06'), '');
});

test('참석 확인은 촬영 3일 전부터 당일까지만 묻는다', () => {
  assert.ok(isAttendanceAskOpen('2026-11-01', '2026-10-29'));
  assert.ok(isAttendanceAskOpen('2026-10-29', '2026-10-29'));
  assert.ok(!isAttendanceAskOpen('2026-11-02', '2026-10-29'));
  assert.ok(!isAttendanceAskOpen('2026-10-28', '2026-10-29'));
  assert.equal(shootDayLabel('2026-10-29', '2026-10-29'), '오늘');
  assert.equal(shootDayLabel('2026-10-30', '2026-10-29'), '내일');
  assert.equal(shootDayLabel('2026-11-01', '2026-10-29'), 'D-3');
});

test('대화에 남길 문장', () => {
  assert.match(
    attendanceMessage('2026-10-31', 'yes', ''),
    /^✅ 10월 31일 \(토\) 촬영에 참석할게요/,
  );
  assert.match(attendanceMessage('2026-10-31', 'no', '독감'), /어려워요\.\n사유: 독감$/);
});
