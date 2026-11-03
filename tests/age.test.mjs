import test from 'node:test';
import assert from 'node:assert/strict';
import { koreaToday, manAge } from '../src/lib/age.ts';

// 한국 시간으로 그 날짜 낮 12시 (UTC 03:00)
const korea = (date) => new Date(`${date}T03:00:00Z`);

test('만 나이: 생일 전날까지는 그대로, 생일 당일부터 한 살 많아진다', () => {
  assert.equal(manAge('2001-11-01', korea('2026-10-31')), 24);
  assert.equal(manAge('2001-11-01', korea('2026-11-01')), 25);
  assert.equal(manAge('2001-11-01', korea('2026-11-03')), 25);
  assert.equal(manAge('1999-12-25', korea('2026-11-03')), 26);
  assert.equal(manAge('1999-12-25', korea('2026-12-25')), 27);
});

test('만 나이: 월이 같으면 일까지 비교한다', () => {
  assert.equal(manAge('2000-03-15', korea('2026-03-14')), 25);
  assert.equal(manAge('2000-03-15', korea('2026-03-15')), 26);
});

test('만 나이: 2월 29일생은 평년에 3월 1일부터 한 살 많아진다', () => {
  assert.equal(manAge('2004-02-29', korea('2027-02-28')), 22);
  assert.equal(manAge('2004-02-29', korea('2027-03-01')), 23);
  assert.equal(manAge('2004-02-29', korea('2028-02-29')), 24);
});

test('만 나이: 서버가 UTC여도 한국 날짜로 센다', () => {
  // 한국 2026-11-01 새벽 1시 = UTC 2026-10-31 16:00. 한국에서는 이미 생일이다.
  const dawn = new Date('2026-10-31T16:00:00Z');
  assert.equal(koreaToday(dawn), '2026-11-01');
  assert.equal(manAge('2001-11-01', dawn), 25);
});

test('만 나이: 없는 날짜·형식이 틀린 값·범위 밖은 null', () => {
  assert.equal(manAge('2001-02-30', korea('2026-11-03')), null);
  assert.equal(manAge('2001-13-01', korea('2026-11-03')), null);
  assert.equal(manAge('2001.11.01', korea('2026-11-03')), null);
  assert.equal(manAge('', korea('2026-11-03')), null);
  assert.equal(manAge('2026-06-01', korea('2026-11-03')), null); // 0세
  assert.equal(manAge('2030-01-01', korea('2026-11-03')), null); // 미래
});

test('달력에서 고를 수 있는 가장 늦은 생년월일은 만 1세가 되는 날', async () => {
  const { latestBirthDate, manAge } = await import('../src/lib/age.ts');
  // 한국 시간 2026-11-03 오후
  const now = new Date('2026-11-03T07:00:00Z');
  assert.equal(latestBirthDate(now), '2025-11-03');
  assert.equal(manAge(latestBirthDate(now), now), 1);
  // 그보다 하루 늦으면 만 0세라 저장되지 않는다
  assert.equal(manAge('2025-11-04', now), null);
  assert.equal(manAge('2026-11-02', now), null);
  // 2월 29일
  assert.equal(latestBirthDate(new Date('2028-02-29T03:00:00Z')), '2027-02-28');
});
