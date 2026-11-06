import assert from 'node:assert/strict';
import test from 'node:test';
import { actorRooms, pickRoom, producerRooms } from '../src/lib/chat-rooms.ts';

test('주인 혼자인 공고도 단톡방 + 1:1 방이 생긴다', () => {
  assert.deepEqual(producerRooms(['owner'], 'owner'), ['', 'owner']);
  assert.deepEqual(actorRooms(['owner']), ['', 'owner']);
});

test('프로젝트가 없는 예전 배역은 단톡방 하나', () => {
  assert.deepEqual(producerRooms([], 'owner'), ['']);
  assert.deepEqual(actorRooms([]), ['']);
});

test('팀원이 있으면 단톡방 + 제작진 각자와의 1:1 방이 모두 생긴다', () => {
  const team = ['owner', 'member-a', 'member-b'];
  assert.deepEqual(producerRooms(team, 'owner'), ['', 'owner']);
  assert.deepEqual(producerRooms(team, 'member-a'), ['', 'member-a']);
  // 팀이 아닌 사람은 단톡방만(접근 자체는 chat-access에서 막는다)
  assert.deepEqual(producerRooms(team, 'stranger'), ['']);
  assert.deepEqual(actorRooms(team), ['', 'owner', 'member-a', 'member-b']);
});

test('팀에서 빠진 사람과의 예전 대화도 계속 본다', () => {
  assert.deepEqual(producerRooms([], 'owner', ['owner']), ['', 'owner']);
  assert.deepEqual(actorRooms(['owner', 'member-a'], ['old-member']), [
    '',
    'owner',
    'member-a',
    'old-member',
  ]);
});

test('들어갈 수 없는 방을 고르면 단톡방으로', () => {
  assert.equal(pickRoom(['', 'member-a'], 'member-a'), 'member-a');
  assert.equal(pickRoom(['', 'member-a'], 'member-b'), '');
  assert.equal(pickRoom([''], 123), '');
});
