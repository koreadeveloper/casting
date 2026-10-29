import { randomUUID } from 'node:crypto';
import { getProfile, getUserById, getUserWithHash } from './accounts';
import { db, getApplication, reviewApplication } from './db';
import { ageOf } from './profile';
import type { ReviewStatus } from './types';

export type BoardColumnKey = 'review' | 'passed' | 'final' | 'hold';

export const BOARD_COLUMNS: { key: BoardColumnKey; title: string }[] = [
  { key: 'review', title: '서류 검토' },
  { key: 'passed', title: '서류 통과' },
  { key: 'final', title: '오디션 후보' },
  { key: 'hold', title: '보류' },
];

export type BoardRole = 'owner' | 'member';
export type BoardProject = { id: string; title: string; role: BoardRole };
export type BoardMember = { userId: string; name: string; role: BoardRole };
export type BoardVote = { userId: string; name: string };
/** 이 카드를 마지막으로 옮긴 사람 (팀 공유 단계라서 누가 바꿨는지 보여 준다) */
export type BoardMove = { userId: string; name: string; column: BoardColumnKey; at: string };
export type BoardNote = {
  id: string;
  body: string;
  userId: string;
  name: string;
  createdAt: string;
};
export type BoardCard = {
  kind: 'application';
  applicationId: string;
  name: string;
  age: number | null;
  photo: string;
  intro: string;
  roleTitle: string;
  status: ReviewStatus;
  shortlist: boolean;
  votes: BoardVote[];
  notes: BoardNote[];
  noteCount: number;
  lastMove: BoardMove | null;
};
/** 지원하지 않은 배우를 팀이 직접 후보로 올린 카드 */
export type BoardCandidateCard = {
  kind: 'candidate';
  candidateId: string;
  actorId: string;
  name: string;
  age: number | null;
  photo: string;
  intro: string;
  meta: string;
  votes: BoardVote[];
  notes: BoardNote[];
  noteCount: number;
  lastMove: BoardMove | null;
  addedBy: { userId: string; name: string };
};
export type BoardCardItem = BoardCard | BoardCandidateCard;
export type BoardColumn = { key: BoardColumnKey; title: string; cards: BoardCardItem[] };
export type Board = {
  project: { id: string; title: string };
  members: BoardMember[];
  columns: BoardColumn[];
};

type Row = Record<string, unknown>;

const INTRO_LIMIT = 80;
/** 보류 컬럼으로 묶는 상태값 (구버전 데이터의 'rejected'까지 포용) */
const HOLD_STATUSES = new Set<string>(['hold', 'excluded', 'rejected']);

function columnOf(status: ReviewStatus, shortlist: boolean): BoardColumnKey {
  if (shortlist) return 'final';
  if (status === 'interested') return 'passed';
  if (HOLD_STATUSES.has(status)) return 'hold';
  return 'review';
}

/** 보드에 보일 수 있는 프로젝트: 내가 owner이거나 team_members로 초대된 프로젝트(보관한 프로젝트 제외) */
export async function listMyBoardProjects(userId: string): Promise<BoardProject[]> {
  return (
    (await db()
      .prepare(
        `SELECT p.id, p.title, 'owner' AS role FROM projects p
         WHERE p.owner_id=? AND p.archived_at IS NULL
         UNION
         SELECT p.id, p.title, tm.member_role AS role FROM team_members tm
         JOIN projects p ON p.id=tm.project_id
         WHERE tm.user_id=? AND p.owner_id<>? AND p.archived_at IS NULL`,
      )
      .all(userId, userId, userId)) as { id: string; title: string; role: string }[]
  ).map((row) => ({
    id: row.id,
    title: row.title,
    role: row.role === 'owner' ? 'owner' : 'member',
  }));
}

export async function isBoardMember(projectId: string, userId: string) {
  const conn = db();
  if (await conn.prepare('SELECT 1 FROM projects WHERE id=? AND owner_id=?').get(projectId, userId))
    return true;
  return Boolean(
    await conn
      .prepare('SELECT 1 FROM team_members WHERE project_id=? AND user_id=?')
      .get(projectId, userId),
  );
}

export async function isBoardOwner(projectId: string, userId: string) {
  return Boolean(
    await db().prepare('SELECT 1 FROM projects WHERE id=? AND owner_id=?').get(projectId, userId),
  );
}

export async function projectExists(projectId: string) {
  return Boolean(await db().prepare('SELECT 1 FROM projects WHERE id=?').get(projectId));
}

/**
 * 지원서 → 배역 → 프로젝트를 따라 보드 접근 권한을 확인한다.
 * project_id가 없는 레거시 배역은 배역 owner만 접근 가능.
 */
export async function applicationBoardAccess(applicationId: string, userId: string) {
  const row = (await db()
    .prepare(
      `SELECT r.project_id pid, r.owner_id oid
       FROM applications a JOIN roles r ON r.id=a.role_id WHERE a.id=?`,
    )
    .get(applicationId)) as { pid: string | null; oid: string | null } | undefined;
  if (!row) return 'missing' as const;
  if (row.pid)
    return (await isBoardMember(row.pid, userId)) ? ('member' as const) : ('denied' as const);
  return row.oid === userId ? ('member' as const) : ('denied' as const);
}

export async function listBoard(projectId: string): Promise<Board | null> {
  const conn = db();
  const project = (await conn
    .prepare('SELECT id, owner_id, title FROM projects WHERE id=?')
    .get(projectId)) as { id: string; owner_id: string; title: string } | undefined;
  if (!project) return null;

  const members: BoardMember[] = [];
  const owner = await getUserById(project.owner_id);
  if (owner) members.push({ userId: owner.id, name: owner.name, role: 'owner' });
  const memberRows = (await conn
    .prepare(
      `SELECT tm.user_id, tm.member_role, u.name FROM team_members tm
       JOIN users u ON u.id=tm.user_id
       WHERE tm.project_id=? ORDER BY tm.invited_at ASC`,
    )
    .all(projectId)) as { user_id: string; member_role: string; name: string }[];
  for (const row of memberRows) {
    if (members.some((member) => member.userId === row.user_id)) continue;
    members.push({
      userId: row.user_id,
      name: row.name,
      role: row.member_role === 'owner' ? 'owner' : 'member',
    });
  }

  const appRows = (await conn
    .prepare(
      `SELECT a.id, a.name, a.age, a.photo_url, a.introduction, a.status, a.shortlist,
              a.created_at, r.title role_title
       FROM applications a JOIN roles r ON r.id=a.role_id
       WHERE r.project_id=? ORDER BY a.created_at DESC`,
    )
    .all(projectId)) as Row[];

  const votesByApp = new Map<string, BoardVote[]>();
  const voteRows = (await conn
    .prepare(
      `SELECT v.application_id, v.user_id, u.name FROM board_votes v
       JOIN users u ON u.id=v.user_id
       JOIN applications a ON a.id=v.application_id
       JOIN roles r ON r.id=a.role_id
       WHERE r.project_id=? ORDER BY v.created_at ASC`,
    )
    .all(projectId)) as { application_id: string; user_id: string; name: string }[];
  for (const row of voteRows) {
    const list = votesByApp.get(row.application_id) || [];
    list.push({ userId: row.user_id, name: row.name });
    votesByApp.set(row.application_id, list);
  }

  const notesByApp = new Map<string, { notes: BoardNote[]; total: number }>();
  const noteRows = (await conn
    .prepare(
      `SELECT n.id, n.application_id, n.user_id, u.name, n.body, n.created_at FROM board_notes n
       JOIN users u ON u.id=n.user_id
       JOIN applications a ON a.id=n.application_id
       JOIN roles r ON r.id=a.role_id
       WHERE r.project_id=? ORDER BY n.created_at DESC`,
    )
    .all(projectId)) as {
    id: string;
    application_id: string;
    user_id: string;
    name: string;
    body: string;
    created_at: string;
  }[];
  for (const row of noteRows) {
    const bucket = notesByApp.get(row.application_id) || { notes: [], total: 0 };
    bucket.total += 1;
    if (bucket.notes.length < 3)
      bucket.notes.push({
        id: row.id,
        body: row.body,
        userId: row.user_id,
        name: row.name,
        createdAt: row.created_at,
      });
    notesByApp.set(row.application_id, bucket);
  }

  const candidateRows = (await conn
    .prepare(
      `SELECT id, project_id, actor_id, added_by, column_key, created_at
       FROM project_candidates WHERE project_id=? ORDER BY created_at DESC`,
    )
    .all(projectId)) as CandidateRow[];

  const votesByCand = new Map<string, BoardVote[]>();
  const candVoteRows = (await conn
    .prepare(
      `SELECT v.candidate_id, v.user_id, u.name FROM candidate_votes v
       JOIN users u ON u.id=v.user_id
       JOIN project_candidates c ON c.id=v.candidate_id
       WHERE c.project_id=? ORDER BY v.created_at ASC`,
    )
    .all(projectId)) as { candidate_id: string; user_id: string; name: string }[];
  for (const row of candVoteRows) {
    const list = votesByCand.get(row.candidate_id) || [];
    list.push({ userId: row.user_id, name: row.name });
    votesByCand.set(row.candidate_id, list);
  }

  const notesByCand = new Map<string, { notes: BoardNote[]; total: number }>();
  const candNoteRows = (await conn
    .prepare(
      `SELECT n.id, n.candidate_id, n.user_id, u.name, n.body, n.created_at FROM candidate_notes n
       JOIN users u ON u.id=n.user_id
       JOIN project_candidates c ON c.id=n.candidate_id
       WHERE c.project_id=? ORDER BY n.created_at DESC`,
    )
    .all(projectId)) as {
    id: string;
    candidate_id: string;
    user_id: string;
    name: string;
    body: string;
    created_at: string;
  }[];
  for (const row of candNoteRows) {
    const bucket = notesByCand.get(row.candidate_id) || { notes: [], total: 0 };
    bucket.total += 1;
    if (bucket.notes.length < 3)
      bucket.notes.push({
        id: row.id,
        body: row.body,
        userId: row.user_id,
        name: row.name,
        createdAt: row.created_at,
      });
    notesByCand.set(row.candidate_id, bucket);
  }

  // 카드별 마지막 이동 기록. 같은 카드의 기록 중 가장 최근 것만 남긴다.
  const lastMoves = new Map<string, BoardMove>();
  const moveRows = (await conn
    .prepare(
      `SELECT m.application_id, m.candidate_id, m.user_id, m.column_key, m.created_at, u.name
       FROM board_moves m
       JOIN users u ON u.id=m.user_id
       LEFT JOIN applications a ON a.id=m.application_id
       LEFT JOIN roles r ON r.id=a.role_id
       LEFT JOIN project_candidates c ON c.id=m.candidate_id
       WHERE r.project_id=? OR c.project_id=?
       ORDER BY m.created_at ASC`,
    )
    .all(projectId, projectId)) as {
    application_id: string | null;
    candidate_id: string | null;
    user_id: string;
    column_key: string;
    created_at: string;
    name: string;
  }[];
  for (const row of moveRows) {
    const key = row.application_id || row.candidate_id;
    if (!key) continue;
    lastMoves.set(key, {
      userId: row.user_id,
      name: row.name,
      column: row.column_key as BoardColumnKey,
      at: row.created_at,
    });
  }

  const columns: BoardColumn[] = BOARD_COLUMNS.map((column) => ({ ...column, cards: [] }));
  const byKey = new Map(columns.map((column) => [column.key, column]));

  for (const row of appRows) {
    const status = row.status as ReviewStatus;
    const shortlist = Boolean(row.shortlist);
    const intro = String(row.introduction);
    const bucket = notesByApp.get(String(row.id));
    const card: BoardCard = {
      kind: 'application',
      applicationId: String(row.id),
      name: String(row.name),
      age: row.age === null ? null : Number(row.age),
      photo: String(row.photo_url || ''),
      intro: intro.length > INTRO_LIMIT ? `${intro.slice(0, INTRO_LIMIT)}…` : intro,
      roleTitle: String(row.role_title || ''),
      status,
      shortlist,
      votes: votesByApp.get(String(row.id)) || [],
      notes: bucket?.notes || [],
      noteCount: bucket?.total || 0,
      lastMove: lastMoves.get(String(row.id)) || null,
    };
    byKey.get(columnOf(status, shortlist))?.cards.push(card);
  }

  for (const row of candidateRows) {
    const bucket = notesByCand.get(row.id);
    const key = BOARD_COLUMNS.some((column) => column.key === row.column_key)
      ? (row.column_key as BoardColumnKey)
      : 'review';
    byKey
      .get(key)
      ?.cards.push(
        await candidateCard(
          row,
          votesByCand.get(row.id) || [],
          bucket?.notes || [],
          bucket?.total || 0,
          lastMoves.get(row.id) || null,
        ),
      );
  }

  return { project: { id: project.id, title: project.title }, members, columns };
}

export async function listVotes(applicationId: string): Promise<BoardVote[]> {
  return (
    (await db()
      .prepare(
        `SELECT v.user_id, u.name FROM board_votes v
         JOIN users u ON u.id=v.user_id
         WHERE v.application_id=? ORDER BY v.created_at ASC`,
      )
      .all(applicationId)) as { user_id: string; name: string }[]
  ).map((row) => ({ userId: row.user_id, name: row.name }));
}

export async function toggleVote(applicationId: string, userId: string) {
  const conn = db();
  const existing = await conn
    .prepare('SELECT 1 FROM board_votes WHERE application_id=? AND user_id=?')
    .get(applicationId, userId);
  if (existing) {
    await conn
      .prepare('DELETE FROM board_votes WHERE application_id=? AND user_id=?')
      .run(applicationId, userId);
  } else {
    await conn
      .prepare('INSERT INTO board_votes (application_id,user_id,created_at) VALUES (?,?,?)')
      .run(applicationId, userId, new Date().toISOString());
  }
  return { voted: !existing, votes: await listVotes(applicationId) };
}

export async function addNote(id: string, applicationId: string, userId: string, body: string) {
  const createdAt = new Date().toISOString();
  await db()
    .prepare(
      'INSERT INTO board_notes (id,application_id,user_id,body,created_at) VALUES (?,?,?,?,?)',
    )
    .run(id, applicationId, userId, body, createdAt);
  const user = await getUserById(userId);
  return { id, applicationId, userId, name: user?.name || '', body, createdAt };
}

export async function getNote(id: string) {
  const row = (await db()
    .prepare('SELECT id, application_id, user_id, body, created_at FROM board_notes WHERE id=?')
    .get(id)) as
    | { id: string; application_id: string; user_id: string; body: string; created_at: string }
    | undefined;
  return row || null;
}

export async function deleteNote(id: string) {
  return (await db().prepare('DELETE FROM board_notes WHERE id=?').run(id)).changes > 0;
}

/** 이메일로 가입된 제작자를 팀 멤버로 추가. 대상이 없거나 producer가 아니면 null. */
export async function addMember(projectId: string, email: string) {
  const found = await getUserWithHash(email);
  if (!found || found.user.role !== 'producer') return null;
  const owner = (await db().prepare('SELECT owner_id FROM projects WHERE id=?').get(projectId)) as
    { owner_id: string } | undefined;
  if (owner && owner.owner_id !== found.user.id) {
    await db()
      .prepare(
        `INSERT OR IGNORE INTO team_members (project_id,user_id,member_role,invited_at)
         VALUES (?,?,?,?)`,
      )
      .run(projectId, found.user.id, 'member', new Date().toISOString());
  }
  return found.user;
}

/** 단계를 옮긴 사람과 시각을 남긴다. 팀원이 서로의 분류를 확인할 수 있게 하는 기록이다. */
async function recordMove(
  target: { applicationId?: string; candidateId?: string },
  userId: string,
  column: BoardColumnKey,
) {
  await db()
    .prepare(
      `INSERT INTO board_moves (id,application_id,candidate_id,user_id,column_key,created_at)
       VALUES (?,?,?,?,?,?)`,
    )
    .run(
      randomUUID(),
      target.applicationId ?? null,
      target.candidateId ?? null,
      userId,
      column,
      new Date().toISOString(),
    );
}

export async function moveCard(applicationId: string, column: BoardColumnKey, userId: string) {
  const application = await getApplication(applicationId);
  if (!application) return null;
  await recordMove({ applicationId }, userId, column);
  const rescued = HOLD_STATUSES.has(application.status);
  switch (column) {
    case 'final':
      return await reviewApplication(applicationId, {
        shortlist: true,
        status: rescued ? 'interested' : application.status,
      });
    case 'passed':
      return await reviewApplication(applicationId, { status: 'interested', shortlist: false });
    case 'hold':
      return await reviewApplication(applicationId, { status: 'hold', shortlist: false });
    case 'review':
      return await reviewApplication(applicationId, { status: 'reviewing', shortlist: false });
  }
}

/* ── 등록 배우 후보 (미지원 배우 직접 추가) ─────────────────── */

type CandidateRow = {
  id: string;
  project_id: string;
  actor_id: string;
  added_by: string;
  column_key: string;
  created_at: string;
};

async function candidateCard(
  row: CandidateRow,
  votes: BoardVote[],
  notes: BoardNote[],
  noteCount: number,
  lastMove: BoardMove | null = null,
): Promise<BoardCandidateCard> {
  const profile = await getProfile(row.actor_id);
  const actor = await getUserById(row.actor_id);
  const adder = await getUserById(row.added_by);
  const intro = profile?.intro || '';
  return {
    kind: 'candidate',
    candidateId: row.id,
    actorId: row.actor_id,
    name: profile?.name || actor?.name || '',
    age: profile ? ageOf(profile.birthYear) : null,
    photo: profile?.photos[0] || '',
    intro: intro.length > INTRO_LIMIT ? `${intro.slice(0, INTRO_LIMIT)}…` : intro,
    meta: [profile?.region || '', ...(profile?.tags || []).slice(0, 3)].filter(Boolean).join(' · '),
    votes,
    notes,
    noteCount,
    lastMove,
    addedBy: { userId: row.added_by, name: adder?.name || '' },
  };
}

export async function getCandidate(candidateId: string) {
  const row = (await db()
    .prepare(
      'SELECT id, project_id, actor_id, added_by, column_key, created_at FROM project_candidates WHERE id=?',
    )
    .get(candidateId)) as CandidateRow | undefined;
  return row || null;
}

export async function findCandidate(projectId: string, actorId: string) {
  const row = (await db()
    .prepare(
      'SELECT id, project_id, actor_id, added_by, column_key, created_at FROM project_candidates WHERE project_id=? AND actor_id=?',
    )
    .get(projectId, actorId)) as CandidateRow | undefined;
  return row || null;
}

/** 후보 → 프로젝트를 따라 보드 접근 권한을 확인한다. */
export async function candidateBoardAccess(candidateId: string, userId: string) {
  const candidate = await getCandidate(candidateId);
  if (!candidate) return 'missing' as const;
  return (await isBoardMember(candidate.project_id, userId))
    ? ('member' as const)
    : ('denied' as const);
}

/** 카드 렌더용 단일 후보 카드 (투표·메모 포함). */
export async function getCandidateCard(candidateId: string): Promise<BoardCandidateCard | null> {
  const row = await getCandidate(candidateId);
  if (!row) return null;
  const noteRows = (await db()
    .prepare(
      `SELECT n.id, n.user_id, u.name, n.body, n.created_at FROM candidate_notes n
       JOIN users u ON u.id=n.user_id
       WHERE n.candidate_id=? ORDER BY n.created_at DESC`,
    )
    .all(candidateId)) as {
    id: string;
    user_id: string;
    name: string;
    body: string;
    created_at: string;
  }[];
  const notes = noteRows.slice(0, 3).map((note) => ({
    id: note.id,
    body: note.body,
    userId: note.user_id,
    name: note.name,
    createdAt: note.created_at,
  }));
  return await candidateCard(row, await listCandidateVotes(candidateId), notes, noteRows.length);
}

export async function addCandidate(projectId: string, actorId: string, userId: string) {
  const id = randomUUID();
  await db()
    .prepare(
      `INSERT INTO project_candidates (id,project_id,actor_id,added_by,column_key,created_at)
       VALUES (?,?,?,?,?,?)`,
    )
    .run(id, projectId, actorId, userId, 'review', new Date().toISOString());
  return (await getCandidate(id))!;
}

/** 후보 제거 시 달린 투표·메모도 함께 지운다. */
export async function removeCandidate(candidateId: string) {
  const conn = db();
  await conn.prepare('DELETE FROM candidate_votes WHERE candidate_id=?').run(candidateId);
  await conn.prepare('DELETE FROM candidate_notes WHERE candidate_id=?').run(candidateId);
  return (
    (await conn.prepare('DELETE FROM project_candidates WHERE id=?').run(candidateId)).changes > 0
  );
}

export async function moveCandidate(candidateId: string, column: BoardColumnKey, userId: string) {
  const result = await db()
    .prepare('UPDATE project_candidates SET column_key=? WHERE id=?')
    .run(column, candidateId);
  if (result.changes === 0) return null;
  await recordMove({ candidateId }, userId, column);
  return await getCandidate(candidateId);
}

export async function listCandidateVotes(candidateId: string): Promise<BoardVote[]> {
  return (
    (await db()
      .prepare(
        `SELECT v.user_id, u.name FROM candidate_votes v
         JOIN users u ON u.id=v.user_id
         WHERE v.candidate_id=? ORDER BY v.created_at ASC`,
      )
      .all(candidateId)) as { user_id: string; name: string }[]
  ).map((row) => ({ userId: row.user_id, name: row.name }));
}

export async function toggleCandidateVote(candidateId: string, userId: string) {
  const conn = db();
  const existing = await conn
    .prepare('SELECT 1 FROM candidate_votes WHERE candidate_id=? AND user_id=?')
    .get(candidateId, userId);
  if (existing) {
    await conn
      .prepare('DELETE FROM candidate_votes WHERE candidate_id=? AND user_id=?')
      .run(candidateId, userId);
  } else {
    await conn
      .prepare('INSERT INTO candidate_votes (candidate_id,user_id,created_at) VALUES (?,?,?)')
      .run(candidateId, userId, new Date().toISOString());
  }
  return { voted: !existing, votes: await listCandidateVotes(candidateId) };
}

export async function addCandidateNote(
  id: string,
  candidateId: string,
  userId: string,
  body: string,
) {
  const createdAt = new Date().toISOString();
  await db()
    .prepare(
      'INSERT INTO candidate_notes (id,candidate_id,user_id,body,created_at) VALUES (?,?,?,?,?)',
    )
    .run(id, candidateId, userId, body, createdAt);
  const user = await getUserById(userId);
  return { id, candidateId, userId, name: user?.name || '', body, createdAt };
}

/* ── 지원서·후보 양쪽 테이블을 아우르는 메모 조회/수정/삭제 ──── */

export type StoredNote = {
  id: string;
  targetKind: 'application' | 'candidate';
  targetId: string;
  userId: string;
  body: string;
  createdAt: string;
};

export async function getAnyNote(id: string): Promise<StoredNote | null> {
  const appNote = await getNote(id);
  if (appNote)
    return {
      id: appNote.id,
      targetKind: 'application',
      targetId: appNote.application_id,
      userId: appNote.user_id,
      body: appNote.body,
      createdAt: appNote.created_at,
    };
  const row = (await db()
    .prepare('SELECT id, candidate_id, user_id, body, created_at FROM candidate_notes WHERE id=?')
    .get(id)) as
    | { id: string; candidate_id: string; user_id: string; body: string; created_at: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    targetKind: 'candidate',
    targetId: row.candidate_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function noteBoardAccess(note: StoredNote, userId: string) {
  return note.targetKind === 'candidate'
    ? await candidateBoardAccess(note.targetId, userId)
    : await applicationBoardAccess(note.targetId, userId);
}

export async function updateNoteBody(note: StoredNote, body: string): Promise<BoardNote> {
  const table = note.targetKind === 'candidate' ? 'candidate_notes' : 'board_notes';
  await db().prepare(`UPDATE ${table} SET body=? WHERE id=?`).run(body, note.id);
  const user = await getUserById(note.userId);
  return {
    id: note.id,
    body,
    userId: note.userId,
    name: user?.name || '',
    createdAt: note.createdAt,
  };
}

export async function deleteStoredNote(note: StoredNote) {
  if (note.targetKind === 'candidate')
    return (await db().prepare('DELETE FROM candidate_notes WHERE id=?').run(note.id)).changes > 0;
  return await deleteNote(note.id);
}
