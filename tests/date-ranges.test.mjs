import assert from 'node:assert/strict';
import test from 'node:test';
import { addDates, expandRange, groupDateRanges, rangeLabel } from '../src/lib/date-ranges.ts';

test('기간을 날짜 목록으로 펼친다', () => {
  assert.deepEqual(expandRange('2026-12-30', '2027-01-02'), [
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
  ]);
  assert.deepEqual(expandRange('2026-12-05'), ['2026-12-05']);
  // 거꾸로 넣어도 맞춰 준다
  assert.deepEqual(expandRange('2026-12-03', '2026-12-01'), [
    '2026-12-01',
    '2026-12-02',
    '2026-12-03',
  ]);
  assert.deepEqual(expandRange('2026-02-30'), []);
  assert.equal(expandRange('2026-01-01', '2027-12-31', 366).length, 366);
});

test('날짜를 더할 때 중복 없이 정렬한다', () => {
  assert.deepEqual(addDates(['2026-12-05', '2026-12-01'], ['2026-12-01', '2026-12-03']), [
    '2026-12-01',
    '2026-12-03',
    '2026-12-05',
  ]);
});

test('이어지는 날짜는 기간 하나로 묶어 보여 준다', () => {
  const ranges = groupDateRanges(['2026-12-02', '2026-12-01', '2026-12-03', '2026-12-10']);
  assert.deepEqual(ranges, [
    { start: '2026-12-01', end: '2026-12-03', days: 3 },
    { start: '2026-12-10', end: '2026-12-10', days: 1 },
  ]);
  assert.match(rangeLabel(ranges[0]), /12\.1 ~ 12\.3 \(3일\)$/);
  assert.match(rangeLabel(ranges[1]), /12\.10$/);
  assert.equal(
    rangeLabel({ start: '2030-01-30', end: '2030-02-01', days: 3 }),
    '2030.1.30 ~ 2030.2.1 (3일)',
  );
});
