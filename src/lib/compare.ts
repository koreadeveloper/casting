/**
 * 이상형 월드컵식 토너먼트 로직.
 *
 * 상태(CompareState)는 순수 데이터이므로 JSON 직렬화가 가능하고,
 * 그대로 compare_results.bracket_json 컬럼에 저장할 수 있다.
 * 셔플은 Math.random 대신 시드 기반 PRNG를 써서 테스트에서 재현 가능하다.
 */

export const MIN_CANDIDATES = 4;
export const MAX_CANDIDATES = 16;

/** 한 경기. b === null && winner !== null 이면 부전승(bye). */
export type BracketPair = {
  a: string | null;
  b: string | null;
  winner: string | null;
};

export type CompareState = {
  /** 대진 셔플에 사용한 시드 (같은 시드면 같은 대진) */
  seed: number;
  /** 시드 순으로 섞인 후보 id 목록 */
  candidates: string[];
  /** rounds[0] = 첫 라운드 … 마지막 = 결승(경기 1개) */
  rounds: BracketPair[][];
  /**
   * '보류'로 뒤로 미룬 경기 키("라운드:경기") — 먼저 미룬 순서대로.
   * 예전에 저장된 결과에는 없으므로 선택 항목이다.
   */
  deferred?: string[];
};

function matchKey(roundIndex: number, pairIndex: number) {
  return `${roundIndex}:${pairIndex}`;
}

/** 부전승 자동 진출을 포함해 만들어진 대진의 첫 라운드 경기 수로 라운드 이름을 구한다. */
export function roundLabel(pairCount: number) {
  return pairCount <= 1 ? '결승' : `${pairCount * 2}강`;
}

/** 결정적 난수 생성기 (mulberry32). */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** seed 기반 Fisher–Yates 셔플 (원본 배열 불변). */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const list = [...items];
  const rand = mulberry32(seed);
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function nextPowerOfTwo(n: number) {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

function cloneRounds(rounds: BracketPair[][]): BracketPair[][] {
  return rounds.map((round) => round.map((pair) => ({ ...pair })));
}

/** 라운드 r 의 승자를 다음 라운드 슬롯에 채운다. */
function advance(rounds: BracketPair[][], roundIndex: number, pairIndex: number, winner: string) {
  const parent = rounds[roundIndex + 1]?.[Math.floor(pairIndex / 2)];
  if (!parent) return;
  if (pairIndex % 2 === 0) parent.a = winner;
  else parent.b = winner;
}

/**
 * 4~16명의 후보로 토너먼트 대진을 만든다.
 * 2의 거듭제곱이 아니면 부전승(bye)을 골고루 배치하고,
 * 부전승 승자는 즉시 다음 라운드로 진출시킨 상태로 반환한다.
 * 같은 seed면 항상 같은 대진이 나온다.
 */
export function buildBracket(candidateIds: string[], seed = 1): BracketPair[][] {
  const ids = [...new Set(candidateIds)];
  if (ids.length < MIN_CANDIDATES) throw new Error(`후보가 ${MIN_CANDIDATES}명 이상 필요합니다.`);
  if (ids.length > MAX_CANDIDATES)
    throw new Error(`후보는 최대 ${MAX_CANDIDATES}명까지 비교할 수 있습니다.`);

  const size = nextPowerOfTwo(ids.length);
  const byeCount = size - ids.length;
  const shuffled = seededShuffle(ids, seed);

  // 부전승 슬롯을 대진 전체에 고르게 분산시킨다.
  const slots: (string | null)[] = new Array<string | null>(size).fill(null);
  const byeSlots = new Set(
    Array.from({ length: byeCount }, (_, i) => Math.floor(((2 * i + 1) * size) / (2 * byeCount))),
  );
  let cursor = 0;
  for (let i = 0; i < size; i += 1) {
    if (!byeSlots.has(i)) {
      slots[i] = shuffled[cursor];
      cursor += 1;
    }
  }

  const first: BracketPair[] = [];
  for (let i = 0; i < size; i += 2) {
    let a = slots[i];
    let b = slots[i + 1];
    if (a === null) [a, b] = [b, a]; // 항상 a 쪽에 실제 후보가 오게 정규화
    first.push({ a, b, winner: b === null ? a : null });
  }

  const rounds: BracketPair[][] = [first];
  for (let count = size / 4; count >= 1; count /= 2) {
    rounds.push(
      Array.from({ length: count }, () => ({ a: null, b: null, winner: null }) as BracketPair),
    );
  }
  // 부전승 승자를 다음 라운드로 즉시 진출
  first.forEach((pair, index) => {
    if (pair.winner) advance(rounds, 0, index, pair.winner);
  });
  return rounds;
}

/** buildBracket 결과를 진행 상태로 감싼다. */
export function createState(candidateIds: string[], seed = 1): CompareState {
  return {
    seed,
    candidates: seededShuffle([...new Set(candidateIds)], seed),
    rounds: buildBracket(candidateIds, seed),
  };
}

/** 직렬화된 상태가 토너먼트 형태인지 가볍게 확인한다. */
export function isCompareState(value: unknown): value is CompareState {
  if (!value || typeof value !== 'object') return false;
  const state = value as CompareState;
  return (
    Array.isArray(state.candidates) &&
    Array.isArray(state.rounds) &&
    state.rounds.length > 0 &&
    state.rounds.every(
      (round) =>
        Array.isArray(round) &&
        round.every(
          (pair) =>
            pair && typeof pair === 'object' && 'a' in pair && 'b' in pair && 'winner' in pair,
        ),
    )
  );
}

/** 지금 라운드에서 아직 승자를 고르지 않은 경기들 (경기 순서대로). */
function pendingMatches(state: CompareState) {
  for (let roundIndex = 0; roundIndex < state.rounds.length; roundIndex += 1) {
    const round = state.rounds[roundIndex];
    const pending = round
      .map((pair, pairIndex) => ({ roundIndex, pairIndex, pair }))
      .filter(({ pair }) => pair.a !== null && pair.b !== null && pair.winner === null);
    if (pending.length) return pending;
  }
  return [];
}

/**
 * 아직 승자를 고르지 않은 다음 경기를 찾는다. 모두 끝났으면 null.
 * '보류'한 경기는 같은 라운드의 다른 경기를 모두 고른 뒤, 미룬 순서대로 다시 나온다.
 */
export function currentMatch(state: CompareState) {
  const pending = pendingMatches(state);
  if (!pending.length) return null;
  const deferred = state.deferred ?? [];
  const fresh = pending.find(
    (item) => !deferred.includes(matchKey(item.roundIndex, item.pairIndex)),
  );
  if (fresh) return fresh;
  return [...pending].sort(
    (x, y) =>
      deferred.indexOf(matchKey(x.roundIndex, x.pairIndex)) -
      deferred.indexOf(matchKey(y.roundIndex, y.pairIndex)),
  )[0];
}

/** 보류할 수 있는지 — 같은 라운드에 남은 다른 경기가 있어야 뒤로 미룰 수 있다. */
export function canDefer(state: CompareState) {
  return pendingMatches(state).length > 1;
}

/**
 * 결정하기 어려운 경기를 '보류'해 이 라운드의 맨 뒤로 미룬다 (원본 불변).
 * 다시 보류하면 또 맨 뒤로 간다. 라운드에 이 경기만 남았으면 그대로 둔다.
 */
export function deferMatch(
  state: CompareState,
  roundIndex: number,
  pairIndex: number,
): CompareState {
  const pair = state.rounds[roundIndex]?.[pairIndex];
  if (!pair) throw new Error('경기를 찾을 수 없습니다.');
  if (pair.a === null || pair.b === null) throw new Error('아직 진행할 수 없는 경기입니다.');
  if (pair.winner !== null) throw new Error('이미 승자가 정해진 경기입니다.');
  const key = matchKey(roundIndex, pairIndex);
  return { ...state, deferred: [...(state.deferred ?? []).filter((item) => item !== key), key] };
}

/**
 * 경기 승자를 선택해 새 상태를 반환한다 (원본 불변).
 * 마지막 경기까지 고르면 우승자가 확정된다.
 */
export function applyPick(
  state: CompareState,
  roundIndex: number,
  pairIndex: number,
  winnerId: string,
): CompareState {
  const pair = state.rounds[roundIndex]?.[pairIndex];
  if (!pair) throw new Error('경기를 찾을 수 없습니다.');
  if (pair.a === null || pair.b === null) throw new Error('아직 진행할 수 없는 경기입니다.');
  if (pair.winner !== null) throw new Error('이미 승자가 정해진 경기입니다.');
  if (winnerId !== pair.a && winnerId !== pair.b) throw new Error('이 경기의 후보가 아닙니다.');

  const rounds = cloneRounds(state.rounds);
  rounds[roundIndex][pairIndex].winner = winnerId;
  advance(rounds, roundIndex, pairIndex, winnerId);
  const key = matchKey(roundIndex, pairIndex);
  const deferred = (state.deferred ?? []).filter((item) => item !== key);
  return { ...state, rounds, ...(state.deferred ? { deferred } : {}) };
}

/** 우승자 id. 아직 결승이 끝나지 않았으면 null. */
export function champion(state: CompareState): string | null {
  return state.rounds[state.rounds.length - 1]?.[0]?.winner ?? null;
}

/** 실제로 선택이 필요한 경기 기준 전체 진행률. */
export function progress(state: CompareState) {
  let done = 0;
  let total = 0;
  for (const round of state.rounds) {
    for (const pair of round) {
      if (pair.b === null && pair.winner !== null) continue; // 부전승
      total += 1;
      if (pair.winner !== null) done += 1;
    }
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** 특정 라운드 안에서의 진행 상황 (표시용: "3/4 경기"). 부전승은 제외. */
export function roundProgress(state: CompareState, roundIndex: number) {
  const round = state.rounds[roundIndex] ?? [];
  const playable = round.filter((pair) => !(pair.b === null && pair.winner !== null));
  return {
    total: playable.length,
    done: playable.filter((pair) => pair.winner !== null).length,
  };
}

/** 라운드 표시 이름 ("8강", "4강", "결승"). */
export function roundName(state: CompareState, roundIndex: number) {
  return roundLabel(state.rounds[roundIndex]?.length ?? 1);
}
