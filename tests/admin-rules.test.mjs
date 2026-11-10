import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminEmailList,
  isAdminAccount,
  loginMethods,
  matchesMember,
} from '../src/lib/admin-rules.ts';

const env = { ADMIN_EMAILS: ' Boss@Example.com, , not-an-email ,ops@example.com' };

test('관리자 목록: 쉼표로 나누고 소문자로, 메일 형식이 아닌 값은 버린다', () => {
  assert.deepEqual(adminEmailList(env), ['boss@example.com', 'ops@example.com']);
  // 설정이 없으면 팀 공식 계정이 기본 관리자
  assert.deepEqual(adminEmailList({}), ['castingflowofficial@gmail.com']);
  assert.deepEqual(adminEmailList({ ADMIN_EMAILS: '  ' }), ['castingflowofficial@gmail.com']);
});

test('관리자는 메일이 확인되고 정지되지 않은 계정만', () => {
  const user = { email: 'boss@example.com', emailVerified: true, suspendedAt: null };
  assert.equal(isAdminAccount(user, env), true);
  assert.equal(isAdminAccount({ ...user, email: 'BOSS@example.com' }, env), true);
  assert.equal(isAdminAccount({ ...user, emailVerified: false }, env), false);
  assert.equal(isAdminAccount({ ...user, suspendedAt: '2026-01-01' }, env), false);
  assert.equal(isAdminAccount({ ...user, email: 'someone@example.com' }, env), false);
  assert.equal(isAdminAccount(user, {}), false);
  assert.equal(isAdminAccount({ ...user, email: 'CastingFlowOfficial@gmail.com' }, {}), true);
});

test('가입 방식: 비밀번호가 있으면 이메일, 연결된 소셜마다 표시, 순서 고정', () => {
  assert.deepEqual(loginMethods(true, []), ['email']);
  assert.deepEqual(loginMethods(false, ['kakao', 'google']), ['google', 'kakao']);
  assert.deepEqual(loginMethods(true, ['google', 'google', 'other']), ['email', 'google']);
  assert.deepEqual(loginMethods(false, []), []);
});

test('회원 거르기: 검색어·가입 방식·역할·상태', () => {
  const member = {
    email: 'actor@example.com',
    name: '김배우',
    phone: '010-1234-5678',
    orgName: '',
    role: 'actor',
    methods: ['email', 'google'],
    suspendedAt: null,
  };
  const all = { query: '', method: '', role: '', status: '' };
  assert.equal(matchesMember(member, all), true);
  assert.equal(matchesMember(member, { ...all, query: '배우' }), true);
  assert.equal(matchesMember(member, { ...all, query: 'ACTOR@' }), true);
  assert.equal(matchesMember(member, { ...all, query: '없는사람' }), false);
  assert.equal(matchesMember(member, { ...all, method: 'google' }), true);
  assert.equal(matchesMember(member, { ...all, method: 'kakao' }), false);
  assert.equal(matchesMember(member, { ...all, method: 'none' }), false);
  assert.equal(matchesMember({ ...member, methods: [] }, { ...all, method: 'none' }), true);
  assert.equal(matchesMember(member, { ...all, role: 'producer' }), false);
  assert.equal(matchesMember(member, { ...all, status: 'suspended' }), false);
  assert.equal(
    matchesMember({ ...member, suspendedAt: '2026-01-01' }, { ...all, status: 'suspended' }),
    true,
  );
});
