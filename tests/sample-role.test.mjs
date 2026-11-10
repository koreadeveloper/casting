import assert from 'node:assert/strict';
import test from 'node:test';
import { SAMPLE_ROLE_SLUG, isSampleRoleSlug, sampleRole } from '../src/lib/sample-role.ts';

test('예시 공고는 오늘 기준으로 늘 모집 중', () => {
  const role = sampleRole('2026-12-25');
  assert.equal(role.isClosed, false);
  assert.equal(role.deadline, '2027-01-08');
  assert.deepEqual(role.shootDates, ['2027-01-22', '2027-01-23']);
  assert.equal(role.shootDate, role.shootDates[0]);
  assert.ok(role.deadline > '2026-12-25');
  assert.ok(role.announcementDate > role.deadline);
  assert.ok(role.shootDates[0] > role.announcementDate);
});

test('예시 공고 주소는 실제 공고 주소(16자리 16진수)와 겹치지 않는다', () => {
  assert.equal(isSampleRoleSlug(SAMPLE_ROLE_SLUG), true);
  assert.equal(isSampleRoleSlug('0123456789abcdef'), false);
  assert.doesNotMatch(SAMPLE_ROLE_SLUG, /^[0-9a-f]{16}$/);
  assert.equal(sampleRole('2026-11-10').slug, SAMPLE_ROLE_SLUG);
});

test('예시 공고는 계정·프로젝트에 연결되지 않는다', () => {
  const role = sampleRole('2026-11-10');
  assert.equal(role.ownerId, null);
  assert.equal(role.projectId, null);
});
