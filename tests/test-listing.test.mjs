import assert from 'node:assert/strict';
import test from 'node:test';
import { isTestTitle, testRoleSql } from '../src/lib/test-listing.ts';

test('[테스트]·[TEST]로 시작하는 제목만 테스트 공고', () => {
  assert.equal(isTestTitle('[테스트] 세종대학교 WS2 <등골>'), true);
  assert.equal(isTestTitle('  [TEST] 단편'), true);
  assert.equal(isTestTitle('[Test]단편'), true);
  assert.equal(isTestTitle('테스트 드라이브'), false);
  assert.equal(isTestTitle('단편 [테스트]'), false);
});

test('SQL 조건은 프로젝트 제목을 먼저 보고 소문자로 비교한다', () => {
  const sql = testRoleSql('r');
  assert.match(sql, /tp\.id=r\.project_id/);
  assert.match(sql, /LIKE '\[테스트\]%'/);
  assert.match(sql, /LIKE '\[test\]%'/);
});
