import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFolders, filterRooms, threadKey, unreadCount } from '../src/lib/inbox-rules.ts';

const room = (key, folderKey, lastAt, unread) => ({
  key,
  folderKey,
  folderTitle: folderKey === 'p1' ? '커피와 담배' : '등골',
  kind: 'actor',
  title: key,
  subtitle: '',
  photo: '',
  last: '',
  lastAt,
  unread,
  projectTitle: '',
  roleTitle: '',
  mode: 'group',
});

test('읽은 시각 뒤에 남이 보낸 메시지만 안 읽음으로 센다', () => {
  const messages = [
    { at: '2026-11-03T01:00:00Z', mine: false },
    { at: '2026-11-03T02:00:00Z', mine: true },
    { at: '2026-11-03T03:00:00Z', mine: false },
  ];
  assert.equal(unreadCount(messages, ''), 2);
  assert.equal(unreadCount(messages, '2026-11-03T02:30:00Z'), 1);
  assert.equal(unreadCount(messages, '2026-11-03T04:00:00Z'), 0);
});

test('공고별 폴더로 묶고, 폴더와 방은 최근 대화순', () => {
  const { folders, rooms } = buildFolders([
    room('a', 'p1', '2026-11-01T00:00:00Z', 1),
    room('b', 'p2', '2026-11-03T00:00:00Z', 0),
    room('c', 'p1', '2026-11-02T00:00:00Z', 2),
  ]);
  assert.deepEqual(
    rooms.map((item) => item.key),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(
    folders.map((item) => [item.key, item.unread]),
    [
      ['p2', 0],
      ['p1', 3],
    ],
  );
  assert.deepEqual(
    filterRooms(rooms, 'p1').map((item) => item.key),
    ['c', 'a'],
  );
  assert.deepEqual(
    filterRooms(rooms, 'unread').map((item) => item.key),
    ['c', 'a'],
  );
  assert.equal(filterRooms(rooms, 'all').length, 3);
});

test('방 이름은 지원서와 방으로 만든다', () => {
  assert.equal(threadKey('app1', ''), 'app:app1:');
  assert.equal(threadKey('app1', 'user-1'), 'app:app1:user-1');
});

test('폴더 이름은 괄호 안의 작품 이름', async () => {
  const { folderLabel } = await import('../src/lib/inbox-rules.ts');
  assert.equal(folderLabel('[테스트] 세종대학교 WS2 <등골>'), '등골');
  assert.equal(folderLabel('졸업작품 〈커피와 담배〉'), '커피와 담배');
  assert.equal(folderLabel('단편영화 《봄날》'), '봄날');
  assert.equal(folderLabel('여름의 끝'), '여름의 끝');
  assert.equal(folderLabel('빈 괄호 <>'), '빈 괄호 <>');
});
