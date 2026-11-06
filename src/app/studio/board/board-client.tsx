'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import BackButton from '@/components/back-button';
import ChatThread from '@/components/chat-thread';
import { conditionLabel, conditionTone } from '@/lib/conditions';
import PhotoLightbox from '@/components/photo-lightbox';
import ProducerNav from '@/components/producer-nav';
import { profileAge } from '@/lib/profile';
import { useBackClose } from '@/lib/use-back-close';
import styles from './board.module.css';
import CandidateProposalBlock, {
  proposalBadge,
  type BoardRoleOption,
  type CandidateProposal,
} from './candidate-proposal';

type BoardRole = 'owner' | 'member';
type ColumnKey = 'review' | 'passed' | 'final' | 'hold';
type ProjectItem = { id: string; title: string; role: BoardRole };
type Member = { userId: string; name: string; role: BoardRole };
type Vote = { userId: string; name: string };
type Note = { id: string; body: string; userId: string; name: string; createdAt: string };
/** 단계는 팀 공유 값이라, 마지막으로 옮긴 사람을 카드에 적어 준다. */
type Move = { userId: string; name: string; column: ColumnKey; at: string };
/** 상세 패널에서 보여 줄 지원서 전체 내용 */
type AppDetail = {
  name: string;
  age: number | null;
  email: string;
  phone: string;
  introduction: string;
  photoUrls: string[];
  videoUrl: string;
  available: string;
  travel: string;
  payAccepted: string;
  skill: string;
  createdAt: string;
};

/** 상세 패널에서 쓸 사진들. 지원서를 받아왔으면 고른 사진 전부, 아니면 카드의 사진 한 장. */
function detailPhotos(detail: { card: Card; application: AppDetail | null }): string[] {
  const fromApplication = detail.application?.photoUrls ?? [];
  if (fromApplication.length > 0) return fromApplication;
  return detail.card.photo ? [detail.card.photo] : [];
}
type CardBase = {
  name: string;
  age: number | null;
  photo: string;
  intro: string;
  votes: Vote[];
  notes: Note[];
  noteCount: number;
  lastMove: Move | null;
};
type ApplicationCard = CardBase & {
  kind: 'application';
  applicationId: string;
  roleTitle: string;
  status: string;
  shortlist: boolean;
};
type CandidateCard = CardBase & {
  kind: 'candidate';
  candidateId: string;
  actorId: string;
  meta: string;
  addedBy: { userId: string; name: string };
  proposals: CandidateProposal[];
  applied: boolean;
};
type Card = ApplicationCard | CandidateCard;
type ActorResult = {
  userId: string;
  name: string;
  birthYear: number | null;
  age?: number | null;
  region: string;
  tags: string[];
  photos: string[];
};
type Column = { key: ColumnKey; title: string; cards: Card[] };
type BoardData = {
  project: { id: string; title: string; role: BoardRole };
  members: Member[];
  columns: Column[];
  roles: BoardRoleOption[];
};

/**
 * 카드 정렬. 기본은 보드가 내려준 순서(최신 지원순)이고,
 * '하트순'을 고르면 팀원 지지가 많은 사람이 위로 온다. 하트 수가 같으면 원래 순서를 지킨다.
 */
function sortCards(cards: Card[], sort: 'recent' | 'votes'): Card[] {
  if (sort === 'recent') return cards;
  return [...cards].sort((a, b) => b.votes.length - a.votes.length);
}

/** '방금', '3시간 전', '10/21' 처럼 이동 시각을 짧게 적는다. */
function moveAgo(at: string) {
  const minutes = Math.floor((Date.now() - Date.parse(at)) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  return new Date(at).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  });
}

/** 카드 종류에 관계없이 스레드·드래그 등의 키로 쓰는 고유 id */
function cardRefId(card: Card) {
  return card.kind === 'candidate' ? card.candidateId : card.applicationId;
}

function cardTarget(card: Card) {
  return card.kind === 'candidate'
    ? { candidateId: card.candidateId }
    : { applicationId: card.applicationId };
}

const DOT: Record<ColumnKey, string> = {
  review: styles.dotReview,
  passed: styles.dotPassed,
  final: styles.dotFinal,
  hold: styles.dotHold,
};

// 서류 검토 → 서류 통과 → 오디션 후보 흐름의 단계 번호. 보류는 흐름 밖이라 번호 대신 표시만 한다.
const STEP: Record<ColumnKey, string> = {
  review: '01',
  passed: '02',
  final: '03',
  hold: '—',
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  if (!navigator.onLine) throw new Error('연결이 끊겼습니다. 다시 연결한 뒤 시도해 주세요.');
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청을 완료하지 못했습니다.');
  return data as T;
}

function initials(name: string) {
  return name.slice(-2);
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return '';
  const now = new Date();
  const sameDay =
    date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) ===
    now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  if (sameDay)
    return date.toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  });
}

export default function BoardClient({ meId }: { meId: string }) {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectId, setProjectId] = useState('');
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<ColumnKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<ActorResult[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);
  // 카드 정렬. 자동으로 바꾸지 않고 눌렀을 때만 바뀐다 — 보는 중에 카드가 혼자 움직이면 헷갈린다.
  const [sort, setSort] = useState<'recent' | 'votes'>('recent');
  // 보드를 떠나지 않고 보는 상세 패널. 지원서는 서버에서 전체 내용을 받아 온다.
  const [detail, setDetail] = useState<{ card: Card; application: AppDetail | null } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPhotoAt, setDetailPhotoAt] = useState<number | null>(null);
  // 팀 보드에서 연 배우와의 대화(지원자만)
  const [chatCard, setChatCard] = useState<Card | null>(null);
  useBackClose(Boolean(chatCard), () => setChatCard(null));
  // 상세 패널·후보 추가 시트·카드 메뉴는 휴대폰 뒤로가기로 닫힌다.
  useBackClose(Boolean(detail), () => setDetail(null));
  useBackClose(pickerOpen, () => setPickerOpen(false));
  useBackClose(Boolean(menuFor), () => setMenuFor(null));

  // 보드를 다시 불러오면 열려 있는 상세 패널의 카드도 새 내용으로 바꾼다(제안 상태·투표 등).
  useEffect(() => {
    if (!board) return;
    setDetail((current) => {
      if (!current) return current;
      const fresh = board.columns
        .flatMap((column) => column.cards)
        .find((card) => cardRefId(card) === cardRefId(current.card));
      return fresh ? { ...current, card: fresh } : current;
    });
  }, [board]);

  async function openDetail(card: Card) {
    setDetail({ card, application: null });
    setDetailPhotoAt(null);
    if (card.kind !== 'application') return;
    setDetailLoading(true);
    try {
      const result = await api<{ application: AppDetail }>(
        `/api/applications/${card.applicationId}`,
      );
      // 그 사이 다른 카드를 열었으면 덮어쓰지 않는다
      setDetail((current) =>
        current && cardRefId(current.card) === cardRefId(card)
          ? { ...current, application: result.application }
          : current,
      );
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : '상세를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  }
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const loadBoard = useCallback(
    async (id: string, quiet = false) => {
      if (!id) {
        setBoard(null);
        return;
      }
      if (!quiet) setBoardLoading(true);
      try {
        setBoard(await api<BoardData>(`/api/board?projectId=${encodeURIComponent(id)}`));
      } catch (error) {
        setBoard(null);
        showToast(error instanceof Error ? error.message : '보드를 불러오지 못했습니다.');
      } finally {
        if (!quiet) setBoardLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ projects: ProjectItem[] }>('/api/board');
        setProjects(data.projects);
        if (data.projects[0]) setProjectId(data.projects[0].id);
      } catch (error) {
        if (String(error).includes('인증')) {
          location.href = '/login?next=/studio/board';
          return;
        }
        showToast(error instanceof Error ? error.message : '보드를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [showToast]);

  useEffect(() => {
    void loadBoard(projectId);
  }, [projectId, loadBoard]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!pickerOpen) return;
    const timer = setTimeout(
      async () => {
        setPickerLoading(true);
        try {
          const data = await api<{ results: ActorResult[] }>(
            `/api/actors?limit=30&q=${encodeURIComponent(pickerQuery)}`,
          );
          setPickerResults(data.results);
        } catch {
          setPickerResults([]);
        } finally {
          setPickerLoading(false);
        }
      },
      pickerQuery ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [pickerQuery, pickerOpen]);

  function patchCard(id: string, patch: (card: Card) => Card) {
    setBoard((current) =>
      current
        ? {
            ...current,
            columns: current.columns.map((column) => ({
              ...column,
              cards: column.cards.map((card) => (cardRefId(card) === id ? patch(card) : card)),
            })),
          }
        : current,
    );
  }

  function findCard(id: string) {
    if (!board) return null;
    for (const column of board.columns) {
      const card = column.cards.find((item) => cardRefId(item) === id);
      if (card) return { card, column: column.key };
    }
    return null;
  }

  async function toggleVote(card: Card) {
    const id = cardRefId(card);
    try {
      const result = await api<{ voted: boolean; votes: Vote[] }>('/api/board/votes', {
        method: 'POST',
        body: JSON.stringify(cardTarget(card)),
      });
      patchCard(id, (item) => ({ ...item, votes: result.votes }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : '투표하지 못했습니다.');
    }
  }

  async function submitNote(card: Card) {
    const id = cardRefId(card);
    const body = (noteDrafts[id] || '').trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const result = await api<{ note: Note }>('/api/board/notes', {
        method: 'POST',
        body: JSON.stringify({ ...cardTarget(card), body }),
      });
      patchCard(id, (item) => ({
        ...item,
        notes: [result.note, ...item.notes].slice(0, 3),
        noteCount: item.noteCount + 1,
      }));
      setNoteDrafts((current) => ({ ...current, [id]: '' }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : '메모를 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function saveNoteEdit(card: Card) {
    if (!editingNote || busy) return;
    const text = editingNote.text.trim();
    if (!text) return;
    setBusy(true);
    try {
      const result = await api<{ note: Note }>('/api/board/notes', {
        method: 'PATCH',
        body: JSON.stringify({ id: editingNote.id, body: text }),
      });
      patchCard(cardRefId(card), (item) => ({
        ...item,
        notes: item.notes.map((entry) =>
          entry.id === result.note.id ? { ...entry, body: result.note.body } : entry,
        ),
      }));
      setEditingNote(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '메모를 수정하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function removeNote(card: Card, note: Note) {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/api/board/notes?id=${encodeURIComponent(note.id)}`, { method: 'DELETE' });
      patchCard(cardRefId(card), (item) => ({
        ...item,
        notes: item.notes.filter((entry) => entry.id !== note.id),
        noteCount: Math.max(0, item.noteCount - 1),
      }));
      if (editingNote?.id === note.id) setEditingNote(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '메모를 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function move(card: Card, column: ColumnKey) {
    if (busy) return;
    setBusy(true);
    setMenuFor(null);
    try {
      await api('/api/board/move', {
        method: 'POST',
        body: JSON.stringify({ ...cardTarget(card), column }),
      });
      await loadBoard(projectId, true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '카드를 이동하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function addCandidate(actor: ActorResult) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<{ candidate: CandidateCard; duplicated?: boolean }>(
        '/api/candidates',
        {
          method: 'POST',
          body: JSON.stringify({ projectId, actorId: actor.userId }),
        },
      );
      showToast(
        result.duplicated
          ? `${result.candidate.name}님은 이미 후보로 등록되어 있습니다.`
          : `${result.candidate.name}님을 후보로 추가했습니다.`,
      );
      await loadBoard(projectId, true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '후보를 추가하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function removeCandidate(card: CandidateCard) {
    if (busy) return;
    setMenuFor(null);
    if (
      !window.confirm(`${card.name}님을 후보에서 제거할까요? 등록된 투표와 메모도 함께 삭제됩니다.`)
    )
      return;
    setBusy(true);
    try {
      await api(`/api/candidates?id=${encodeURIComponent(card.candidateId)}`, {
        method: 'DELETE',
      });
      showToast('후보를 제거했습니다.');
      await loadBoard(projectId, true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '후보를 제거하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const email = inviteEmail.trim();
    if (!email) return;
    setBusy(true);
    try {
      const result = await api<{ member: Member }>('/api/board/members', {
        method: 'POST',
        body: JSON.stringify({ projectId, email }),
      });
      setBoard((current) =>
        current && !current.members.some((m) => m.userId === result.member.userId)
          ? { ...current, members: [...current.members, result.member] }
          : current,
      );
      setInviteEmail('');
      setInviteOpen(false);
      showToast(`${result.member.name}님을 팀에 초대했습니다.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '초대하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function toggleThread(id: string) {
    setOpenThreads((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onDrop(event: React.DragEvent<HTMLElement>, column: ColumnKey) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || dragId;
    setDropKey(null);
    setDragId(null);
    if (!id) return;
    const found = findCard(id);
    if (found && found.column !== column) void move(found.card, column);
  }

  const isOwner = board?.project.role === 'owner';
  const totalCards = board?.columns.reduce((sum, column) => sum + column.cards.length, 0) ?? 0;
  const addedActorIds = new Set(
    board?.columns.flatMap((column) =>
      column.cards
        .filter((card): card is CandidateCard => card.kind === 'candidate')
        .map((card) => card.actorId),
    ) ?? [],
  );

  return (
    <main className="app-shell wide">
      <ProducerNav active="board" />
      <div className="screen-pad page-top">
        <BackButton fallback="/studio?tab=profile" label="뒤로" />
        <div className="title-row">
          <div>
            <p className="greet-sub">팀원과 함께 지원자를 검토하세요</p>
            <h1 className="page-title">팀 보드</h1>
          </div>
          <span className="count-pill">{loading ? '…' : `${totalCards}장`}</span>
        </div>

        {loading ? (
          <div className="empty-card">보드를 여는 중…</div>
        ) : projects.length === 0 ? (
          <div className="empty-card">
            팀 보드에 표시할 프로젝트가 없습니다.
            <br />
            <a href="/studio/projects/new">프로젝트 만들기 →</a>
          </div>
        ) : (
          <>
            <div className={styles.projectRow} role="group" aria-label="프로젝트 선택">
              {projects.map((project) => (
                <button
                  key={project.id}
                  className={`${styles.projectPill}${project.id === projectId ? ` ${styles.active}` : ''}`}
                  onClick={() => setProjectId(project.id)}
                >
                  {project.title}
                  <span className={styles.roleTag}>
                    {project.role === 'owner' ? '오너' : '팀원'}
                  </span>
                </button>
              ))}
            </div>

            {board && (
              <p className={styles.sharedNote}>
                <strong>단계(서류 검토·서류 통과·오디션 후보·보류)는 팀 전체가 함께 보는 값</strong>
                이에요. 한 명이 옮기면 모두에게 똑같이 보이고, 카드에 누가 옮겼는지 남습니다.
                <strong> ♥ 픽과 메모는 사람별</strong>로 쌓이고 이름이 함께 표시돼요.
              </p>
            )}

            {board && (
              <div className={styles.teamBar}>
                <div className={styles.memberStrip} aria-label="팀원 목록">
                  {board.members.map((member) => (
                    <div
                      key={member.userId}
                      className={`${styles.member}${member.role === 'owner' ? ` ${styles.owner}` : ''}`}
                    >
                      <span className={styles.memberAvatar}>{initials(member.name)}</span>
                      <span className={styles.memberName}>{member.name}</span>
                      {member.role === 'owner' && <i className={styles.ownerTag}>오너</i>}
                    </div>
                  ))}
                </div>
                <button
                  className={styles.addCandidateBtn}
                  onClick={() => {
                    setPickerQuery('');
                    setPickerResults([]);
                    setPickerOpen(true);
                  }}
                >
                  + 후보 배우 추가
                </button>
                {board && (
                  <p className="chat-mode-pick">
                    배우 대화방
                    <strong>
                      {board.members.length > 1
                        ? '단톡방(제작진 모두 + 배우)과 제작진별 1:1 방이 자동으로 생겨요'
                        : '단톡방과 나와 배우의 1:1 방이 자동으로 생겨요 · 팀원을 초대하면 단톡방에 함께해요'}
                    </strong>
                  </p>
                )}
                {isOwner && !inviteOpen && (
                  <button className={styles.inviteBtn} onClick={() => setInviteOpen(true)}>
                    + 팀원 초대
                  </button>
                )}
                {isOwner && inviteOpen && (
                  <form className={styles.inviteForm} onSubmit={invite}>
                    <input
                      type="email"
                      placeholder="제작자 이메일 입력"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      aria-label="초대할 팀원 이메일"
                      autoFocus
                    />
                    <button type="submit" disabled={busy}>
                      초대
                    </button>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => setInviteOpen(false)}
                    >
                      취소
                    </button>
                  </form>
                )}
              </div>
            )}

            {!boardLoading && board && (
              <div className={styles.sortRow} role="group" aria-label="카드 정렬">
                <span>정렬</span>
                {(
                  [
                    ['recent', '최신 지원순'],
                    ['votes', '하트순'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sort === key}
                    className={sort === key ? styles.on : ''}
                    onClick={() => setSort(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {boardLoading && <p className={styles.boardLoading}>보드를 불러오는 중…</p>}
            {!boardLoading && board && (
              <ol className={styles.pipeline} aria-label="진행 단계">
                {board.columns
                  .filter((column) => column.key !== 'hold')
                  .map((column) => (
                    <li
                      key={column.key}
                      className={column.cards.length > 0 ? styles.pipelineLive : undefined}
                    >
                      <b>{STEP[column.key]}</b>
                      <span>{column.title}</span>
                      <em>{column.cards.length}</em>
                    </li>
                  ))}
              </ol>
            )}
            {!boardLoading && board && (
              <div className={styles.board}>
                {board.columns.map((column) => (
                  <section
                    key={column.key}
                    className={`${styles.column}${dropKey === column.key ? ` ${styles.dropTarget}` : ''}`}
                    aria-label={column.title}
                    onDragOver={(event) => {
                      if (!dragId) return;
                      event.preventDefault();
                      if (dropKey !== column.key) setDropKey(column.key);
                    }}
                    onDragLeave={() => setDropKey((key) => (key === column.key ? null : key))}
                    onDrop={(event) => onDrop(event, column.key)}
                  >
                    <header className={styles.columnHead}>
                      <span className={styles.stepNo}>{STEP[column.key]}</span>
                      <span className={`${styles.columnDot} ${DOT[column.key]}`} />
                      <h2>{column.title}</h2>
                      <span className={styles.columnCount}>{column.cards.length}</span>
                    </header>
                    {sortCards(column.cards, sort).length === 0 && (
                      <div className={styles.emptyCol}>카드가 없습니다</div>
                    )}
                    {sortCards(column.cards, sort).map((card) => {
                      const id = cardRefId(card);
                      const removable =
                        card.kind === 'candidate' && (isOwner || card.addedBy.userId === meId);
                      return (
                        <article
                          key={id}
                          className={`${styles.card}${dragId === id ? ` ${styles.dragging}` : ''}`}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', id);
                            event.dataTransfer.effectAllowed = 'move';
                            setDragId(id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDropKey(null);
                          }}
                        >
                          <div className={styles.cardTop}>
                            <span className={styles.cardPhoto}>
                              {card.photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={card.photo} alt="" loading="lazy" />
                              ) : (
                                initials(card.name)
                              )}
                            </span>
                            <div className={styles.cardWho}>
                              <strong>
                                {card.name}
                                {card.age !== null && <small>{card.age}세</small>}
                                <em
                                  className={`${styles.kindBadge}${card.kind === 'candidate' ? ` ${styles.candidate}` : ''}`}
                                >
                                  {card.kind === 'candidate' ? '등록 배우' : '지원자'}
                                </em>
                                {card.kind === 'candidate' &&
                                  (() => {
                                    const badge = proposalBadge(card.proposals, card.applied);
                                    return badge ? (
                                      <em
                                        className={`${styles.kindBadge} ${styles[`pb_${badge.tone}`]}`}
                                      >
                                        {badge.label}
                                      </em>
                                    ) : null;
                                  })()}
                              </strong>
                              <span className={styles.cardRole}>
                                {card.kind === 'candidate' ? card.meta : card.roleTitle}
                              </span>
                            </div>
                            <button
                              className={styles.menuBtn}
                              aria-label={`${card.name} 단계 이동`}
                              aria-expanded={menuFor === id}
                              onClick={() => setMenuFor((current) => (current === id ? null : id))}
                            >
                              ⋯
                            </button>
                          </div>
                          {menuFor === id && (
                            <>
                              <div
                                className={styles.menuBackdrop}
                                onClick={() => setMenuFor(null)}
                              />
                              <div className={styles.moveMenu} role="menu">
                                <small>이동할 단계</small>
                                {board.columns
                                  .filter((target) => target.key !== column.key)
                                  .map((target) => (
                                    <button
                                      key={target.key}
                                      role="menuitem"
                                      onClick={() => void move(card, target.key)}
                                    >
                                      {target.title}
                                    </button>
                                  ))}
                                {card.kind === 'candidate' && (
                                  <small>
                                    {card.addedBy.name
                                      ? `${card.addedBy.name}님이 등록한 후보`
                                      : '직접 등록된 후보'}
                                  </small>
                                )}
                                {removable && (
                                  <button
                                    className={styles.danger}
                                    role="menuitem"
                                    onClick={() => void removeCandidate(card)}
                                  >
                                    후보 제거
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                          {card.intro && <p className={styles.cardIntro}>{card.intro}</p>}
                          {/* 단계는 팀 공유 값이다. 누가 옮겼는지 적어 줘야 서로의 분류를 확인할 수 있다. */}
                          <p className={styles.moveLog}>
                            {card.lastMove
                              ? `${card.lastMove.name}님이 ${moveAgo(card.lastMove.at)} ${column.title}(으)로 이동`
                              : '아직 이동 기록이 없어요'}
                          </p>
                          <div className={styles.cardActions}>
                            <button
                              className={`${styles.voteBtn}${card.votes.some((vote) => vote.userId === meId) ? ` ${styles.on}` : ''}`}
                              aria-pressed={card.votes.some((vote) => vote.userId === meId)}
                              onClick={() => void toggleVote(card)}
                            >
                              {card.votes.some((vote) => vote.userId === meId) ? '♥' : '♡'}{' '}
                              {card.votes.length}
                            </button>
                            {card.votes.length > 0 && (
                              <span className={styles.voterNames}>
                                {card.votes.map((vote) => vote.name).join(', ')}
                              </span>
                            )}
                            <button
                              className={`${styles.noteToggle}${openThreads.has(id) ? ` ${styles.on}` : ''}`}
                              aria-expanded={openThreads.has(id)}
                              onClick={() => toggleThread(id)}
                            >
                              메모 {card.noteCount}
                            </button>
                            {/* 카드 전체가 드래그 대상이라, 상세 보기는 버튼으로만 연다 */}
                            <button
                              className={styles.detailBtn}
                              onClick={() => void openDetail(card)}
                            >
                              상세
                            </button>
                          </div>
                          {openThreads.has(id) && (
                            <div className={styles.noteThread}>
                              {card.noteCount > card.notes.length && (
                                <span className={styles.memberName}>
                                  이전 메모 {card.noteCount - card.notes.length}개
                                </span>
                              )}
                              {card.notes.map((note) => (
                                <div key={note.id} className={styles.noteItem}>
                                  <div className={styles.noteHead}>
                                    <strong>{note.name}</strong>
                                    <time>{timeLabel(note.createdAt)}</time>
                                    {note.userId === meId && editingNote?.id !== note.id && (
                                      <span className={styles.noteOps}>
                                        <button
                                          onClick={() =>
                                            setEditingNote({ id: note.id, text: note.body })
                                          }
                                        >
                                          수정
                                        </button>
                                        <button onClick={() => void removeNote(card, note)}>
                                          삭제
                                        </button>
                                      </span>
                                    )}
                                  </div>
                                  {editingNote?.id === note.id ? (
                                    <form
                                      className={styles.noteForm}
                                      onSubmit={(event) => {
                                        event.preventDefault();
                                        void saveNoteEdit(card);
                                      }}
                                    >
                                      <input
                                        value={editingNote.text}
                                        onChange={(event) =>
                                          setEditingNote({
                                            id: note.id,
                                            text: event.target.value,
                                          })
                                        }
                                        maxLength={500}
                                        aria-label="메모 수정"
                                        autoFocus
                                      />
                                      <button type="submit" disabled={busy}>
                                        저장
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.ghostBtn}
                                        onClick={() => setEditingNote(null)}
                                      >
                                        취소
                                      </button>
                                    </form>
                                  ) : (
                                    <p>{note.body}</p>
                                  )}
                                </div>
                              ))}
                              <form
                                className={styles.noteForm}
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  void submitNote(card);
                                }}
                              >
                                <input
                                  placeholder="메모를 남기세요"
                                  value={noteDrafts[id] || ''}
                                  onChange={(event) =>
                                    setNoteDrafts((current) => ({
                                      ...current,
                                      [id]: event.target.value,
                                    }))
                                  }
                                  maxLength={500}
                                  aria-label={`${card.name} 메모 입력`}
                                />
                                <button type="submit" disabled={busy}>
                                  등록
                                </button>
                              </form>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </section>
                ))}
              </div>
            )}
            {!boardLoading && !board && !loading && projects.length > 0 && (
              <div className="empty-card">보드를 불러오지 못했습니다.</div>
            )}
          </>
        )}
      </div>
      {pickerOpen && (
        <div className="sheet-backdrop" onClick={() => setPickerOpen(false)}>
          <section
            className={`detail-sheet ${styles.pickerSheet}`}
            role="dialog"
            aria-modal="true"
            aria-label="후보 배우 추가"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-title">
              <span>후보 배우 추가</span>
              <button onClick={() => setPickerOpen(false)} aria-label="닫기">
                ×
              </button>
            </div>
            <input
              className={styles.pickerSearch}
              type="search"
              placeholder="이름·지역·태그·특기로 검색"
              value={pickerQuery}
              onChange={(event) => setPickerQuery(event.target.value)}
              aria-label="배우 검색"
              autoFocus
            />
            <div className={styles.pickerList}>
              {pickerLoading && <p className={styles.pickerMsg}>검색 중…</p>}
              {!pickerLoading && pickerResults.length === 0 && (
                <p className={styles.pickerMsg}>조건에 맞는 배우가 없습니다.</p>
              )}
              {!pickerLoading &&
                pickerResults.map((actor) => {
                  const added = addedActorIds.has(actor.userId);
                  const age = profileAge(actor);
                  return (
                    <div key={actor.userId} className={styles.pickerRow}>
                      <span className={styles.cardPhoto}>
                        {actor.photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={actor.photos[0]} alt="" loading="lazy" />
                        ) : (
                          initials(actor.name)
                        )}
                      </span>
                      <div className={styles.pickerWho}>
                        <strong>
                          {actor.name}
                          {age !== null && <small>{age}세</small>}
                        </strong>
                        <span>
                          {[actor.region, ...actor.tags.slice(0, 3)].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <button
                        className={styles.pickerAdd}
                        disabled={added || busy}
                        onClick={() => void addCandidate(actor)}
                      >
                        {added ? '추가됨' : '추가'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      )}
      {/* 보드 위에 띄우는 상세 패널. 다른 화면으로 넘어가면 칸반 맥락이 끊겨서 여기서 바로 본다. */}
      {detail && (
        <div className="sheet-backdrop" onClick={() => setDetail(null)}>
          <section
            className="detail-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${detail.card.name} 상세`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-title">
              <span>{detail.card.kind === 'application' ? '지원자 상세' : '후보 배우'}</span>
              <button onClick={() => setDetail(null)} aria-label="닫기">
                ×
              </button>
            </div>

            <div className="detail-profile">
              {detailPhotos(detail).length > 0 ? (
                <button
                  className="avatar-open"
                  onClick={() => setDetailPhotoAt(0)}
                  aria-label={`${detail.card.name} 사진 크게 보기`}
                >
                  <span className="avatar avatar-large">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={detailPhotos(detail)[0]} alt="" />
                  </span>
                </button>
              ) : (
                <span className="avatar avatar-large">{initials(detail.card.name)}</span>
              )}
              <div>
                <h2>
                  {detail.card.name} <small>{detail.card.age ? `(${detail.card.age})` : ''}</small>
                </h2>
                <p>
                  {detail.card.kind === 'application'
                    ? (detail.application?.introduction ?? detail.card.intro)
                    : detail.card.intro}
                </p>
                <span>
                  {detail.card.kind === 'application'
                    ? detail.card.roleTitle
                    : detail.card.meta || '등록 배우'}
                </span>
              </div>
            </div>

            {detailLoading && <p className={styles.boardLoading}>상세를 불러오는 중…</p>}

            {detail.card.kind === 'application' && detail.application && (
              <>
                <div className="detail-grid">
                  <div>
                    <span>촬영 가능</span>
                    <strong className={conditionTone(detail.application.available)}>
                      {conditionLabel(detail.application.available)}
                    </strong>
                  </div>
                  <div>
                    <span>지역 이동</span>
                    <strong className={conditionTone(detail.application.travel)}>
                      {conditionLabel(detail.application.travel)}
                    </strong>
                  </div>
                  <div>
                    <span>출연료 수용</span>
                    <strong className={conditionTone(detail.application.payAccepted)}>
                      {conditionLabel(detail.application.payAccepted)}
                    </strong>
                  </div>
                </div>
                <div className="detail-block">
                  <h3>자료와 연락처</h3>
                  <p>필수 역량: {detail.application.skill || '미입력'}</p>
                  <p>
                    연락처: {detail.application.phone} · {detail.application.email}
                  </p>
                  {detail.application.photoUrls.length > 0 && (
                    <button className="text-button" onClick={() => setDetailPhotoAt(0)}>
                      사진 크게 보기
                      {detail.application.photoUrls.length > 1 &&
                        ` (${detail.application.photoUrls.length}장)`}
                    </button>
                  )}
                  {detail.application.videoUrl && (
                    <a href={detail.application.videoUrl} target="_blank" rel="noreferrer">
                      연기 영상 열기 ↗
                    </a>
                  )}
                </div>
                <button
                  className="button button-primary full"
                  style={{ marginTop: 12 }}
                  onClick={() => setChatCard(detail.card)}
                >
                  배우와 대화하기
                </button>
              </>
            )}

            {detail.card.kind === 'candidate' && (
              <div className="detail-block">
                <h3>등록 후보</h3>
                <p>
                  {detail.card.addedBy.name
                    ? `${detail.card.addedBy.name}님이 후보로 올렸어요.`
                    : '팀에서 후보로 올린 배우예요.'}
                </p>
                <a href={`/actors/${detail.card.actorId}`}>프로필 전체 보기 ↗</a>
              </div>
            )}
            {detail.card.kind === 'candidate' && board && (
              <CandidateProposalBlock
                key={detail.card.candidateId}
                actorName={detail.card.name}
                actorId={detail.card.actorId}
                proposals={detail.card.proposals}
                applied={detail.card.applied}
                roles={board.roles ?? []}
                onSent={() => void loadBoard(projectId, true)}
              />
            )}

            <div className="detail-block">
              <h3>팀 의견</h3>
              <p>
                {detail.card.votes.length > 0
                  ? `♥ ${detail.card.votes.length} · ${detail.card.votes.map((vote) => vote.name).join(', ')}`
                  : '아직 픽한 팀원이 없어요.'}
              </p>
              <p className={styles.moveLog}>
                {detail.card.lastMove
                  ? `${detail.card.lastMove.name}님이 ${moveAgo(detail.card.lastMove.at)} 옮김`
                  : '아직 이동 기록이 없어요'}
              </p>
              {detail.card.notes.length > 0 && (
                <div className={styles.noteThread}>
                  {detail.card.notes.map((note) => (
                    <p key={note.id}>
                      <strong>{note.name}</strong> {note.body}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {detail && detailPhotoAt !== null && detailPhotos(detail).length > 0 && (
        <PhotoLightbox
          photos={detailPhotos(detail)}
          startAt={detailPhotoAt}
          name={detail.card.name}
          onClose={() => setDetailPhotoAt(null)}
        />
      )}

      {chatCard && chatCard.kind === 'application' && board && (
        <div className="sheet-backdrop" onClick={() => setChatCard(null)}>
          <section
            className="detail-sheet chat-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${chatCard.name}님과의 대화`}
            onClick={(event) => event.stopPropagation()}
          >
            <ChatThread
              applicationId={chatCard.applicationId}
              mode="producer"
              peerName={chatCard.name}
              peerPhoto={chatCard.photo || undefined}
              peerSub={chatCard.roleTitle}
              projectTitle={board.project.title}
              roleTitle={chatCard.roleTitle}
              projectImage="/covers/etc.svg"
              onClose={() => setChatCard(null)}
            />
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" onClick={() => setToast('')}>
          <span>{toast}</span>
          <button aria-label="닫기">×</button>
        </div>
      )}
    </main>
  );
}
