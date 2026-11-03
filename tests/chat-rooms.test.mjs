import assert from 'node:assert/strict';
import test from 'node:test';
import { actorRooms, chatMode, pickActorRoom, producerRoom } from '../src/lib/chat-rooms.ts';

test('저장된 값이 없거나 모르면 단톡방', () => {
  assert.equal(chatMode(''), 'group');
  assert.equal(chatMode(null), 'group');
  assert.equal(chatMode('private'), 'private');
  assert.equal(chatMode('PRIVATE'), 'group');
});

test('단톡방은 모두 기본 방, 개별방은 팀원마다 자기 방', () => {
  assert.equal(producerRoom('group', 'owner', 'member'), '');
  assert.equal(producerRoom('group', 'owner', 'owner'), '');
  assert.equal(producerRoom('private', 'owner', 'owner'), '');
  assert.equal(producerRoom('private', 'owner', 'member-a'), 'member-a');
});

test('배우는 개별방 방식에서만 팀원별 방에 들어간다', () => {
  assert.deepEqual(actorRooms('group', ['member-a']), ['']);
  assert.deepEqual(actorRooms('private', ['member-a', '']), ['', 'member-a']);
  assert.equal(pickActorRoom('private', ['member-a'], 'member-a'), 'member-a');
  // 없는 방이나 단톡방 방식에서는 기본 방으로
  assert.equal(pickActorRoom('private', ['member-a'], 'member-b'), '');
  assert.equal(pickActorRoom('group', ['member-a'], 'member-a'), '');
  assert.equal(pickActorRoom('private', [], 123), '');
});
