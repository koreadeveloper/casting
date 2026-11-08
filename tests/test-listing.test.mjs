import assert from 'node:assert/strict';
import test from 'node:test';
import { hiddenRoleSql, isHiddenListing, isTestTitle } from '../src/lib/test-listing.ts';

test('[테스트]·[TEST]로 시작하는 제목만 테스트 공고', () => {
  assert.equal(isTestTitle('[테스트] 세종대학교 WS2 <등골>'), true);
  assert.equal(isTestTitle('  [TEST] 단편'), true);
  assert.equal(isTestTitle('[Test]단편'), true);
  assert.equal(isTestTitle('테스트 드라이브'), false);
  assert.equal(isTestTitle('단편 [테스트]'), false);
});

test('파일럿 시작 전에 올라온 공고는 숨기고, 그 뒤 공고는 보인다', () => {
  const from = '2026-11-08T07:16:00.000Z';
  assert.equal(isHiddenListing('<등골>', '2026-11-01T00:00:00.000Z', from), true);
  assert.equal(isHiddenListing('<등골>', '2026-11-09T00:00:00.000Z', from), false);
  assert.equal(isHiddenListing('[테스트] 새 공고', '2026-11-09T00:00:00.000Z', from), true);
  assert.equal(isHiddenListing('<등골>', '2026-11-01T00:00:00.000Z', ''), false);
});

test('SQL 조건: 프로젝트 제목·등록 시각', () => {
  const sql = hiddenRoleSql('r', '2026-11-08T07:16:00.000Z');
  assert.match(sql, /tp\.id=r\.project_id/);
  assert.match(sql, /LIKE '\[테스트\]%'/);
  assert.match(sql, /r\.created_at < '2026-11-08T07:16:00\.000Z'/);
  assert.doesNotMatch(hiddenRoleSql('r', ''), /created_at/);
});
