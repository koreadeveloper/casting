import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPick,
  buildBracket,
  canDefer,
  champion,
  createState,
  currentMatch,
  deferMatch,
  progress,
  roundProgress,
} from '../src/lib/compare.ts';

const ids8 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

test('8명 브래킷: 첫 라운드 4경기, 부전승 없음', () => {
  const rounds = buildBracket(ids8, 7);
  assert.equal(rounds.length, 3); // 8강 → 4강 → 결승
  assert.equal(rounds[0].length, 4);
  assert.equal(rounds[1].length, 2);
  assert.equal(rounds[2].length, 1);
  for (const pair of rounds[0]) {
    assert.ok(pair.a);
    assert.ok(pair.b);
    assert.equal(pair.winner, null);
  }
  // 모든 후보가 첫 라운드에 정확히 한 번씩 등장
  const entries = rounds[0].flatMap((pair) => [pair.a, pair.b]).sort();
  assert.deepEqual(entries, [...ids8].sort());
});

test('6명 브래킷: 2개 부전승이 자동 진출된다', () => {
  const ids6 = ids8.slice(0, 6);
  const rounds = buildBracket(ids6, 3);
  assert.equal(rounds[0].length, 4);
  const byes = rounds[0].filter((pair) => pair.b === null);
  assert.equal(byes.length, 2);
  for (const bye of byes) {
    assert.equal(bye.winner, bye.a); // 부전승은 즉시 승자 확정
  }
  const real = rounds[0].filter((pair) => pair.b !== null);
  assert.equal(real.length, 2);
  // 부전승 승자는 다음 라운드 슬롯에 이미 채워져 있다
  const advanced = rounds[1].flatMap((pair) => [pair.a, pair.b]).filter(Boolean);
  assert.equal(advanced.length, 2);
  for (const bye of byes) assert.ok(advanced.includes(bye.a));
});

test('픽을 진행하면 우승자가 결정되고 상태는 JSON 직렬화 가능하다', () => {
  let state = createState(ids8, 42);
  // 첫 라운드 4경기: 항상 a를 고른다
  for (let p = 0; p < 4; p += 1) {
    const cur = currentMatch(state);
    assert.equal(cur.roundIndex, 0);
    state = applyPick(state, cur.roundIndex, cur.pairIndex, cur.pair.a);
  }
  assert.equal(champion(state), null);
  // 4강 2경기
  for (let p = 0; p < 2; p += 1) {
    const cur = currentMatch(state);
    assert.equal(cur.roundIndex, 1);
    state = applyPick(state, cur.roundIndex, cur.pairIndex, cur.pair.a);
  }
  const final = currentMatch(state);
  assert.equal(final.roundIndex, 2);
  state = applyPick(state, final.roundIndex, final.pairIndex, final.pair.b);
  assert.equal(champion(state), state.rounds[2][0].b);
  assert.equal(currentMatch(state), null);
  // 직렬화 → 복원 후에도 우승자 동일
  const revived = JSON.parse(JSON.stringify(state));
  assert.equal(champion(revived), champion(state));
});

test('applyPick은 원본 상태를 바꾸지 않고 진행률이 오른다', () => {
  const state = createState(ids8, 9);
  const cur = currentMatch(state);
  const next = applyPick(state, cur.roundIndex, cur.pairIndex, cur.pair.b);
  assert.equal(state.rounds[0][0].winner, null);
  assert.equal(next.rounds[0][0].winner, cur.pair.b);
  assert.deepEqual(progress(state), { done: 0, total: 7, percent: 0 });
  assert.equal(progress(next).done, 1);
  assert.deepEqual(roundProgress(next, 0), { total: 4, done: 1 });
});

test('같은 시드면 같은 대진, 다른 시드면 대진이 달라진다', () => {
  assert.deepEqual(buildBracket(ids8, 5), buildBracket(ids8, 5));
  const first = JSON.stringify(buildBracket(ids8, 1)[0]);
  const others = [2, 3, 4, 5, 6].map((seed) => JSON.stringify(buildBracket(ids8, seed)[0]));
  assert.ok(others.some((bracket) => bracket !== first));
});

test('bye가 있는 대진도 끝까지 진행하면 우승자가 나온다', () => {
  let state = createState(ids8.slice(0, 6), 11);
  assert.equal(progress(state).total, 5); // 실제 경기는 5개 (부전승 제외)
  for (let i = 0; i < 5; i += 1) {
    const cur = currentMatch(state);
    assert.ok(cur, `${i}번째 경기가 있어야 함`);
    state = applyPick(state, cur.roundIndex, cur.pairIndex, cur.pair.a);
  }
  assert.ok(champion(state));
  assert.equal(currentMatch(state), null);
});

test('잘못된 픽과 후보 수는 오류를 던진다', () => {
  const state = createState(ids8, 2);
  const cur = currentMatch(state);
  assert.throws(() => applyPick(state, cur.roundIndex, cur.pairIndex, 'x'));
  assert.throws(() => applyPick(state, 9, 0, 'a'));
  assert.throws(() => buildBracket(['a', 'b', 'c']));
  assert.throws(() => buildBracket(ids8.concat('i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q')));
});

test('보류한 대결은 같은 라운드 맨 뒤로 미뤄졌다가 다시 나온다', () => {
  const state = createState(ids8, 4);
  const first = currentMatch(state);
  assert.equal(first.pairIndex, 0);
  assert.ok(canDefer(state));
  let next = deferMatch(state, first.roundIndex, first.pairIndex);
  assert.equal(state.deferred, undefined); // 원본 불변
  assert.equal(currentMatch(next).pairIndex, 1);
  // 나머지 3경기를 고르면 보류했던 0번 경기가 다시 나온다
  for (let i = 0; i < 3; i += 1) {
    const cur = currentMatch(next);
    assert.notEqual(cur.pairIndex, 0);
    next = applyPick(next, cur.roundIndex, cur.pairIndex, cur.pair.a);
  }
  const back = currentMatch(next);
  assert.deepEqual([back.roundIndex, back.pairIndex], [0, 0]);
  assert.equal(canDefer(next), false); // 라운드에 이 경기만 남으면 보류 불가
  next = applyPick(next, 0, 0, back.pair.b);
  assert.deepEqual(next.deferred, []);
  assert.equal(currentMatch(next).roundIndex, 1);
});

test('여러 번 보류하면 미룬 순서대로 돌아오고, 끝까지 우승자가 나온다', () => {
  let state = createState(ids8, 8);
  state = deferMatch(state, 0, 0);
  state = deferMatch(state, 0, 1);
  state = deferMatch(state, 0, 0); // 다시 보류하면 또 맨 뒤로
  assert.deepEqual(state.deferred, ['0:1', '0:0']);
  const order = [];
  while (!champion(state)) {
    const cur = currentMatch(state);
    if (cur.roundIndex === 0) order.push(cur.pairIndex);
    state = applyPick(state, cur.roundIndex, cur.pairIndex, cur.pair.a);
  }
  assert.deepEqual(order, [2, 3, 1, 0]);
  assert.equal(progress(state).percent, 100);
  assert.throws(() => deferMatch(state, 0, 0)); // 이미 끝난 경기
});
