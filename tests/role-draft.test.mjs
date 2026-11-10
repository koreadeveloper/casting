import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DRAFT_ROLES, parseJsonObject, rolesFromFacts } from '../src/lib/role-draft.ts';

test('앞뒤에 말이 붙은 응답에서도 JSON을 꺼낸다', () => {
  assert.deepEqual(parseJsonObject('초안입니다.\n{"roles":[]}\n끝'), { roles: [] });
  assert.equal(parseJsonObject('JSON이 아님'), null);
  assert.equal(parseJsonObject('{"roles":['), null);
});

test('정해진 값만 남기고 숫자 범위를 맞춘다', () => {
  const [role] = rolesFromFacts({
    roles: [
      {
        title: ' 정숙 역 ',
        description: '횟집을 운영하는 엄마.',
        requirement: '부산 사투리',
        roleType: 'lead',
        gender: 'female',
        ageMin: '50',
        ageMax: 59,
        headcount: 0,
        sceneHints: ['smoking', 'smoking', 'hacking', 'none'],
        source: '50대 엄마 정숙',
      },
    ],
  });
  assert.equal(role.title, '정숙 역');
  assert.equal(role.roleType, 'lead');
  assert.equal(role.gender, 'female');
  assert.equal(role.ageMin, 50);
  assert.equal(role.ageMax, 59);
  assert.equal(role.headcount, 1);
  // 목록에 없는 장면·'없음'은 버리고 중복은 한 번만
  assert.deepEqual(role.sceneHints, ['smoking']);
});

test('목록에 없는 비중·성별은 비우고, 뒤바뀐 연령대는 바로잡는다', () => {
  const [role] = rolesFromFacts({
    roles: [{ title: '태오', roleType: '주인공', gender: 'man', ageMin: 35, ageMax: 25 }],
  });
  assert.equal(role.roleType, '');
  assert.equal(role.gender, '');
  assert.equal(role.ageMin, 25);
  assert.equal(role.ageMax, 35);
  assert.deepEqual(role.sceneHints, []);
});

test('배역명이 없거나 겹치는 배역은 빼고, 개수를 제한한다', () => {
  const roles = rolesFromFacts({
    roles: [{ description: '이름 없음' }, { title: 'A' }, { title: 'A' }, null, 'x'],
  });
  assert.deepEqual(
    roles.map((role) => role.title),
    ['A'],
  );
  const many = rolesFromFacts({
    roles: Array.from({ length: 30 }, (_, index) => ({ title: `배역 ${index}` })),
  });
  assert.equal(many.length, MAX_DRAFT_ROLES);
});

test('모양이 다른 응답은 빈 목록', () => {
  assert.deepEqual(rolesFromFacts(null), []);
  assert.deepEqual(rolesFromFacts({ roles: 'x' }), []);
  assert.deepEqual(rolesFromFacts([]), []);
});
