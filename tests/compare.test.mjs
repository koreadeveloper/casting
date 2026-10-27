import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPick,
  buildBracket,
  champion,
  createState,
  currentMatch,
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

test('보류: 보류한 경기는 다른 경기를 먼저 치르고, 남은 게 그것뿐일 때 다시 나온다', async () => {
  const { deferMatch, canDefer, deferredCount } = await import('../src/lib/compare.ts');
  let state = createState(ids8, 3);
  const first = currentMatch(state);
  assert.equal(first.deferred, false);
  assert.equal(canDefer(state, first.roundIndex, first.pairIndex), true);
  state = deferMatch(state, first.roundIndex, first.pairIndex);
  assert.equal(deferredCount(state), 1);
  // 보류한 경기 대신 다음 경기가 나온다
  const second = currentMatch(state);
  assert.notDeepEqual([second.roundIndex, second.pairIndex], [first.roundIndex, first.pairIndex]);
  // 첫 라운드 나머지 3경기를 치르면 4강 1경기(보류 경기와 무관한 쪽)가 먼저 나오고,
  // 결국 보류한 경기만 남으면 그 경기가 '보류했던 경기'로 다시 나온다.
  let guard = 0;
  let match = currentMatch(state);
  while (match && !match.deferred && guard < 10) {
    state = applyPick(state, match.roundIndex, match.pairIndex, match.pair.a);
    match = currentMatch(state);
    guard += 1;
  }
  assert.equal(match.deferred, true);
  assert.deepEqual([match.roundIndex, match.pairIndex], [first.roundIndex, first.pairIndex]);
  // 남은 경기가 이것뿐이면 다시 보류할 수 없다
  assert.equal(canDefer(state, match.roundIndex, match.pairIndex), false);
  assert.throws(() => deferMatch(state, match.roundIndex, match.pairIndex));
  // 고르면 보류 목록에서 빠지고 대회가 이어진다
  state = applyPick(state, match.roundIndex, match.pairIndex, match.pair.b);
  assert.equal(deferredCount(state), 0);
  while ((match = currentMatch(state))) {
    state = applyPick(state, match.roundIndex, match.pairIndex, match.pair.a);
  }
  assert.ok(champion(state));
});

test('보류: 이미 보류한 경기를 다시 보류하면 순서가 맨 뒤로 간다', async () => {
  const { deferMatch } = await import('../src/lib/compare.ts');
  let state = createState(ids8, 5);
  // 첫 라운드 4경기를 모두 보류
  for (let i = 0; i < 4; i += 1) {
    const match = currentMatch(state);
    state = deferMatch(state, match.roundIndex, match.pairIndex);
  }
  const again = currentMatch(state);
  assert.equal(again.deferred, true);
  assert.equal(again.pairIndex, 0); // 먼저 보류한 것부터
  state = deferMatch(state, again.roundIndex, again.pairIndex);
  assert.equal(currentMatch(state).pairIndex, 1); // 다시 보류하면 다음 것이 앞으로
});
