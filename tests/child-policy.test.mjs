import assert from 'node:assert/strict';
import test from 'node:test';
import {
  includesChildAge,
  isChildProfile,
  isChildRole,
  isUnderApplyAge,
} from '../src/lib/child-policy.ts';

test('만 14세 미만 지원자는 막고, 나이를 모르면 막지 않는다', () => {
  assert.equal(isUnderApplyAge(13), true);
  assert.equal(isUnderApplyAge(14), false);
  assert.equal(isUnderApplyAge(null), false);
});

test('최대 나이가 13세 이하인 배역은 아역 배역', () => {
  assert.equal(isChildRole(8, 10), true);
  assert.equal(isChildRole(0, 13), true);
  assert.equal(isChildRole(10, 16), false);
  assert.equal(isChildRole(0, 0), false);
  assert.equal(isChildRole(25, 30), false);
});

test('모집 연령에 14세 미만이 걸치면 등록 화면에서 안내한다', () => {
  assert.equal(includesChildAge(10, 16), true);
  assert.equal(includesChildAge(0, 0), false);
  assert.equal(includesChildAge(20, 29), false);
});

test('프로필: 생년월일이나 출생 연도로 만 14세 미만이 확실하면 막는다', () => {
  assert.equal(isChildProfile(13, 2013, 2026), true);
  assert.equal(isChildProfile(14, 2012, 2026), false);
  // 출생 연도만 있으면 가능한 최대 만 나이(올해-출생 연도)가 14 미만일 때만
  assert.equal(isChildProfile(null, 2013, 2026), true);
  assert.equal(isChildProfile(null, 2012, 2026), false);
  assert.equal(isChildProfile(null, null, 2026), false);
});
