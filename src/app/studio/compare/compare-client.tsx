'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BackButton from '@/components/back-button';
import ProducerNav from '@/components/producer-nav';
import {
  applyPick,
  champion,
  createState,
  currentMatch,
  progress,
  roundName,
  roundProgress,
  type CompareState,
} from '@/lib/compare';
import styles from './compare.module.css';

type Source = 'role' | 'passed' | 'final' | 'favorites' | 'actors';
/** 지원자에서 뽑는 소스 — 배역을 하나 골라야 한다 */
const ROLE_SOURCES: Source[] = ['role', 'passed', 'final'];
type Stage = 'setup' | 'match' | 'done';

type Candidate = {
  id: string;
  name: string;
  age: number | null;
  photo: string;
  intro: string;
  meta: string;
  gender: string;
};

type RoleOption = { id: string; title: string; projectTitle: string };
type SavedResult = { id: string; title: string; winnerLabel: string; createdAt: string };

const SOURCES: { key: Source; label: string; hint: string }[] = [
  { key: 'role', label: '지원자 전체', hint: '제외 처리된 지원자는 빼고 비교합니다.' },
  {
    key: 'passed',
    label: '서류 통과',
    hint: '팀 보드에서 서류 통과로 옮긴 지원자끼리 비교합니다.',
  },
  { key: 'final', label: '오디션 후보', hint: '오디션 후보로 올린 지원자끼리 비교합니다.' },
  { key: 'favorites', label: '관심 배우', hint: '찜해 둔 배우들끼리 비교합니다.' },
  { key: 'actors', label: '전체 배우', hint: '공개 프로필 배우 전체가 대상입니다.' },
];

const GENDERS: [string, string][] = [
  ['', '구분 없음'],
  ['female', '여성만'],
  ['male', '남성만'],
];

const PICK_DELAY_MS = 380;

function Photo({ candidate, big }: { candidate: Candidate; big?: boolean }) {
  return (
    <div className={`${styles.photo}${big ? ` ${styles.photoBig}` : ''}`}>
      {candidate.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={candidate.photo} alt={`${candidate.name} 사진`} />
      ) : (
        <span className={styles.photoFallback}>{candidate.name.slice(-2)}</span>
      )}
    </div>
  );
}

export default function CompareClient() {
  const [stage, setStage] = useState<Stage>('setup');

  // ── 설정 단계 상태 ──────────────────────────────
  const [source, setSource] = useState<Source>('role');
  // 배역에 성별이 정해져 있는 경우가 많아, 반대 성별을 빼고 비교할 수 있게 한다.
  const [gender, setGender] = useState('');
  const [unknownGender, setUnknownGender] = useState(0);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [roleId, setRoleId] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── 대결 단계 상태 ──────────────────────────────
  const [state, setState] = useState<CompareState | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 우승/저장 상태 ──────────────────────────────
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const [notice, setNotice] = useState('');
  const [results, setResults] = useState<SavedResult[]>([]);

  const byId = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate])),
    [candidates],
  );

  const loadResults = useCallback(async () => {
    try {
      const response = await fetch('/api/compare/results', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setResults(data.results ?? []);
    } catch {
      /* 목록 실패는 무시 */
    }
  }, []);

  useEffect(() => {
    void loadResults();
    fetch('/api/roles', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { roles: [] }))
      .then((data) => {
        const list: RoleOption[] = data.roles ?? [];
        setRoles(list);
        // 지원자 화면의 '이상형 월드컵으로 비교'에서 오면 그 배역을 먼저 고른다.
        const wanted = new URLSearchParams(location.search).get('role');
        const first = list.find((item) => item.id === wanted) ?? list[0];
        if (first) setRoleId(first.id);
      })
      .catch(() => setRoles([]));
  }, [loadResults]);

  // 후보 불러오기
  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError('');
    setCandidates([]);
    try {
      const params = new URLSearchParams({ source });
      if (ROLE_SOURCES.includes(source)) params.set('roleId', roleId);
      if (gender) params.set('gender', gender);
      const response = await fetch(`/api/compare?${params}`, { cache: 'no-store' });
      if (response.status === 401) {
        location.href = '/login?next=/studio/compare';
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '후보를 불러오지 못했습니다.');
      const list: Candidate[] = data.candidates;
      setCandidates(list);
      setUnknownGender(Number(data.unknownGender) || 0);
      setChecked(new Set(list.map((candidate) => candidate.id)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '후보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [source, roleId, gender]);

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pickCount(count: number) {
    setChecked(new Set(candidates.slice(0, count).map((candidate) => candidate.id)));
  }

  function start() {
    const ids = candidates.filter((candidate) => checked.has(candidate.id)).map((c) => c.id);
    try {
      setState(createState(ids, (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0));
      setStage('match');
      setPicked(null);
      setSaved('');
      setActionDone(false);
      setNotice('');
      setTitle(
        `${ROLE_SOURCES.includes(source) ? (roles.find((r) => r.id === roleId)?.title ?? '지원자') : '배우'} 월드컵 ${new Date()
          .toISOString()
          .slice(0, 10)}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '대진을 만들지 못했습니다.');
    }
  }

  const match = state ? currentMatch(state) : null;
  const winnerId = state ? champion(state) : null;
  const winner = winnerId ? byId.get(winnerId) : null;

  function choose(winnerPick: string) {
    if (!state || !match || picked) return;
    setPicked(winnerPick);
    timer.current = setTimeout(() => {
      const next = applyPick(state, match.roundIndex, match.pairIndex, winnerPick);
      setState(next);
      setPicked(null);
      if (champion(next)) setStage('done');
    }, PICK_DELAY_MS);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setStage('setup');
    setState(null);
    setPicked(null);
    setSaved('');
    setActionDone(false);
    setNotice('');
  }

  async function saveResult() {
    if (!state || !winner || saving) return;
    setSaving(true);
    try {
      const response = await fetch('/api/compare/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || `${winner.name} 월드컵`,
          roleId: ROLE_SOURCES.includes(source) ? roleId : undefined,
          bracket: state,
          winnerLabel: winner.name,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '저장하지 못했습니다.');
      setSaved(data.id);
      setNotice('결과를 저장했습니다.');
      void loadResults();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function winnerAction() {
    if (!winner || actionDone) return;
    try {
      if (ROLE_SOURCES.includes(source)) {
        const response = await fetch(`/api/applications/${winner.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'interested' }),
        });
        if (!response.ok) throw new Error();
        setNotice(`${winner.name} 지원자를 '관심 있음'으로 표시했습니다.`);
      } else {
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actorId: winner.id, favorite: true }),
        });
        if (!response.ok) throw new Error();
        setNotice(`${winner.name} 배우를 관심 배우로 저장했습니다.`);
      }
      setActionDone(true);
    } catch {
      setNotice('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  // ── 렌더 ─────────────────────────────────────────
  const checkedCount = candidates.filter((candidate) => checked.has(candidate.id)).length;
  const overall = state ? progress(state) : null;
  const round = state && match ? roundProgress(state, match.roundIndex) : null;

  return (
    <main className="app-shell wide">
      <ProducerNav active="compare" />
      <div className="screen-pad page-top">
        <BackButton fallback="/studio?tab=profile" label="뒤로" />
        <div className="title-row">
          <div>
            <p className="greet-sub">두 명씩 골라 최종 1인을 뽑습니다</p>
            <h1 className="page-title">이상형 월드컵</h1>
          </div>
          {stage !== 'setup' && (
            <button className="text-button" onClick={reset}>
              처음으로
            </button>
          )}
        </div>

        {stage === 'setup' && (
          <>
            <div className={styles.panel}>
              <p className={styles.panelTitle}>후보 소스</p>
              <div className={styles.sourceRow} role="radiogroup" aria-label="후보 소스">
                {SOURCES.map((item) => (
                  <button
                    key={item.key}
                    className={`${styles.sourceChip}${source === item.key ? ` ${styles.on}` : ''}`}
                    onClick={() => setSource(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {ROLE_SOURCES.includes(source) ? (
                <select
                  className={styles.select}
                  aria-label="배역 선택"
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                >
                  {roles.length === 0 && <option value="">등록된 배역이 없습니다</option>}
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.projectTitle} — {role.title}
                    </option>
                  ))}
                </select>
              ) : null}
              <p className={styles.hint}>{SOURCES.find((s) => s.key === source)?.hint}</p>
              <p className={styles.panelTitle}>성별</p>
              <div className={styles.sourceRow} role="radiogroup" aria-label="성별">
                {GENDERS.map(([value, label]) => (
                  <button
                    key={value || 'all'}
                    className={`${styles.sourceChip}${gender === value ? ` ${styles.on}` : ''}`}
                    onClick={() => setGender(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className={styles.hint}>
                성별을 고르면 반대 성별만 빠집니다. 성별을 알 수 없는 후보(비로그인 지원 등)는
                그대로 남습니다.
              </p>
              <button
                className="button button-soft full"
                disabled={loading || (ROLE_SOURCES.includes(source) && !roleId)}
                onClick={() => void loadCandidates()}
              >
                {loading ? '불러오는 중…' : '후보 불러오기'}
              </button>
              {error && <p className="form-error">{error}</p>}
              {gender && unknownGender > 0 && (
                <p className={styles.hint}>
                  성별을 알 수 없는 후보 {unknownGender}명도 함께 있습니다. 아래 목록에서 빼실 수
                  있어요.
                </p>
              )}
            </div>

            {candidates.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <p className={styles.panelTitle}>대진 후보 {checkedCount}명 선택</p>
                  <div className={styles.sizeRow}>
                    {[4, 8, 16]
                      .filter((count) => count <= candidates.length)
                      .map((count) => (
                        <button
                          key={count}
                          className={styles.sizeChip}
                          onClick={() => pickCount(count)}
                        >
                          {count}명
                        </button>
                      ))}
                    <button
                      className={styles.sizeChip}
                      onClick={() => pickCount(candidates.length)}
                    >
                      전체
                    </button>
                  </div>
                </div>
                <ul className={styles.candidateList}>
                  {candidates.map((candidate) => (
                    <li key={candidate.id}>
                      <label className={styles.candidateRow}>
                        <input
                          type="checkbox"
                          checked={checked.has(candidate.id)}
                          onChange={() => toggle(candidate.id)}
                        />
                        <Photo candidate={candidate} />
                        <span className={styles.candidateInfo}>
                          <strong>
                            {candidate.name}
                            {candidate.age !== null && <em>{candidate.age}세</em>}
                          </strong>
                          <small>{candidate.meta || candidate.intro.slice(0, 40)}</small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  className="button button-primary full"
                  disabled={checkedCount < 4 || checkedCount > 16}
                  onClick={start}
                >
                  {checkedCount < 4
                    ? '4명 이상 선택해 주세요'
                    : checkedCount > 16
                      ? '최대 16명까지 가능합니다'
                      : `${checkedCount}명으로 토너먼트 시작`}
                </button>
              </div>
            )}

            <HistoryList results={results} />
          </>
        )}

        {stage === 'match' && state && match && (
          <section className={styles.arena}>
            <div className={styles.progressHead}>
              <span className={styles.roundBadge}>
                {roundName(state, match.roundIndex)} · {round ? round.done + 1 : 1}/
                {round?.total ?? 1} 경기
              </span>
              <span className={styles.progressText}>{overall?.percent ?? 0}%</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${overall?.percent ?? 0}%` }} />
            </div>
            <div className={styles.duel}>
              {[match.pair.a, match.pair.b].map((id) => {
                const candidate = id ? byId.get(id) : null;
                if (!candidate) return null;
                return (
                  <button
                    key={candidate.id}
                    className={`${styles.duelCard}${picked === candidate.id ? ` ${styles.picked}` : ''}`}
                    onClick={() => choose(candidate.id)}
                    disabled={Boolean(picked)}
                  >
                    <Photo candidate={candidate} big />
                    <span className={styles.duelName}>{candidate.name}</span>
                    <span className={styles.duelMeta}>
                      {[candidate.age !== null ? `${candidate.age}세` : '', candidate.meta]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {candidate.intro && <span className={styles.duelIntro}>{candidate.intro}</span>}
                  </button>
                );
              })}
              <span className={styles.vsBadge} aria-hidden>
                VS
              </span>
            </div>
            <p className={styles.hint}>더 어울리는 후보를 탭해 주세요.</p>
          </section>
        )}

        {stage === 'done' && winner && (
          <section className={styles.finale}>
            <p className={styles.crown} aria-hidden>
              👑
            </p>
            <div className={styles.winnerCard}>
              <Photo candidate={winner} big />
              <strong className={styles.winnerName}>{winner.name}</strong>
              <span className={styles.duelMeta}>
                {[winner.age !== null ? `${winner.age}세` : '', winner.meta]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <div className={styles.panel}>
              <label className={styles.saveRow}>
                <span>결과 제목</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={100}
                  placeholder="예: 민수 역 최종 선택"
                />
              </label>
              <div className={styles.actionRow}>
                <button
                  className="button button-primary"
                  disabled={saving || Boolean(saved)}
                  onClick={() => void saveResult()}
                >
                  {saved ? '저장됨 ✓' : saving ? '저장 중…' : '결과 저장'}
                </button>
                <button
                  className="button button-soft"
                  disabled={actionDone}
                  onClick={() => void winnerAction()}
                >
                  {actionDone
                    ? '완료 ✓'
                    : ROLE_SOURCES.includes(source)
                      ? '관심으로 표시'
                      : '관심 배우로 저장'}
                </button>
              </div>
              {notice && <p className={styles.notice}>{notice}</p>}
              <button className="button button-outline full" onClick={reset}>
                새 토너먼트 시작
              </button>
            </div>
            <HistoryList results={results} />
          </section>
        )}
      </div>
    </main>
  );
}

function HistoryList({ results }: { results: SavedResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className={styles.panel}>
      <p className={styles.panelTitle}>이전 결과</p>
      <ul className={styles.history}>
        {results.map((result) => (
          <li key={result.id}>
            <span className={styles.historyTitle}>{result.title}</span>
            <span className={styles.historyMeta}>
              우승 {result.winnerLabel} · {result.createdAt.slice(0, 10)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
