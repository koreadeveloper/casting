import assert from 'node:assert/strict';
import test from 'node:test';
import { koDate } from '../src/lib/dates.ts';

test('날짜는 화면마다 같은 모양으로 보여 준다', () => {
  assert.equal(koDate('2026-12-05'), '2026. 12. 5.');
  // 저장된 시각(UTC)은 한국 날짜로 본다: 11월 3일 16시(UTC) = 11월 4일 새벽(한국)
  assert.equal(koDate('2026-11-03T16:30:00.000Z'), '2026. 11. 4.');
  assert.equal(koDate(''), '');
  assert.equal(koDate('미정'), '미정');
});
