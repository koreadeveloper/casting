// 채팅 목록(공고별 폴더)과 팀 내부방, 읽음 기록. 규칙은 inbox-rules.ts·chat-rooms.ts에 있다.

import { randomUUID } from 'node:crypto';
import { listMyBoardProjects } from './board';
import { MESSAGE_PREVIEW_SQL } from './chat-files';
import { actorRooms, hasPrivateRooms, producerRooms } from './chat-rooms';
import { db } from './db';
import {
  actorReaderKey,
  buildFolders,
  teamThreadKey,
  threadKey,
  unreadCount,
  type InboxRoom,
} from './inbox-rules';

type Row = Record<string, unknown>;
const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const marks = (count: number) => Array(count).fill('?').join(',');

/** 이 사람이 방을 지금 읽었다고 기록한다. */
export async function markRead(userKey: string, key: string) {
  await db()
    .prepare(
      `INSERT INTO chat_reads (user_key, thread_key, read_at) VALUES (?,?,?)
       ON CONFLICT (user_key, thread_key) DO UPDATE SET read_at = EXCLUDED.read_at`,
    )
    .run(userKey, key, new Date().toISOString());
}

async function readTimes(userKeys: string[]) {
  if (userKeys.length === 0) return new Map<string, string>();
  const rows = (await db()
    .prepare(
      `SELECT user_key, thread_key, read_at FROM chat_reads WHERE user_key IN (${marks(userKeys.length)})`,
    )
    .all(...userKeys)) as Row[];
  return new Map(
    rows.map((row) => [`${str(row.user_key)}|${str(row.thread_key)}`, str(row.read_at)]),
  );
}

async function messagesOf(applicationIds: string[]) {
  if (applicationIds.length === 0) return [] as Row[];
  return (await db()
    .prepare(
      `SELECT application_id, room, sender, sender_id, kind, created_at, ${MESSAGE_PREVIEW_SQL('chat_messages')} preview
       FROM chat_messages WHERE application_id IN (${marks(applicationIds.length)})
       ORDER BY created_at ASC`,
    )
    .all(...applicationIds)) as Row[];
}

/** 공고별 제작진 id(주인 먼저, 그다음 초대된 순서의 팀원) */
async function teamsOf(projectIds: string[], owners: Map<string, Row | { owner_id: unknown }>) {
  const teams = new Map<string, string[]>();
  for (const id of projectIds) teams.set(id, [str(owners.get(id)?.owner_id)].filter(Boolean));
  if (projectIds.length === 0) return teams;
  const rows = (await db()
    .prepare(
      `SELECT tm.project_id, tm.user_id FROM team_members tm JOIN projects p ON p.id=tm.project_id
       WHERE tm.project_id IN (${marks(projectIds.length)}) AND tm.user_id<>p.owner_id
       ORDER BY tm.invited_at ASC`,
    )
    .all(...projectIds)) as Row[];
  for (const row of rows) teams.get(str(row.project_id))?.push(str(row.user_id));
  return teams;
}

function preview(row: Row) {
  return str(row.kind) === 'offer' ? '📅 오디션 일정 제안' : str(row.preview);
}

/** 제작진(주인·팀원)의 채팅 목록: 내가 주인이거나 팀원인 공고마다 팀 내부방과 배우와의 방들. */
export async function producerInbox(userId: string) {
  const projects = await listMyBoardProjects(userId);
  const rooms: InboxRoom[] = [];
  const reads = await readTimes([userId]);
  const readAt = (key: string) => reads.get(`${userId}|${key}`) ?? '';

  if (projects.length > 0) {
    const ids = projects.map((project) => project.id);
    const meta = (await db()
      .prepare(
        `SELECT p.id, p.owner_id,
           (SELECT COUNT(*) FROM team_members tm WHERE tm.project_id=p.id AND tm.user_id<>p.owner_id) members
         FROM projects p WHERE p.id IN (${marks(ids.length)})`,
      )
      .all(...ids)) as Row[];
    const byId = new Map(meta.map((row) => [str(row.id), row]));
    const teams = await teamsOf(ids, byId);

    // 팀 내부방: 팀원이 한 명이라도 있는 공고만
    const teamRows = (await db()
      .prepare(
        `SELECT t.project_id, t.sender_id, t.body, t.created_at, u.name FROM team_messages t
         LEFT JOIN users u ON u.id=t.sender_id
         WHERE t.project_id IN (${marks(ids.length)}) ORDER BY t.created_at ASC`,
      )
      .all(...ids)) as Row[];
    for (const project of projects) {
      const info = byId.get(project.id);
      const members = Number(info?.members ?? 0);
      if (members === 0) continue;
      const messages = teamRows.filter((row) => str(row.project_id) === project.id);
      const last = messages.at(-1);
      const key = teamThreadKey(project.id);
      rooms.push({
        key,
        folderKey: project.id,
        folderTitle: project.title,
        kind: 'team',
        title: '팀 내부방',
        subtitle: `제작진 ${members + 1}명 · 배우에게는 보이지 않아요`,
        photo: '',
        last: last ? `${str(last.name)}: ${str(last.body)}` : '팀원끼리 이야기를 나눠 보세요.',
        lastAt: last ? str(last.created_at) : '',
        unread: unreadCount(
          messages.map((row) => ({ at: str(row.created_at), mine: str(row.sender_id) === userId })),
          readAt(key),
        ),
        projectId: project.id,
        projectTitle: project.title,
        roleTitle: '',
        members: members + 1,
      });
    }

    // 배우와의 방: 지원서마다 단톡방 + (팀원이 있으면) 나와 배우의 1:1 방.
    // 대화가 아직 없어도 보여 줘서 목록에서 바로 말을 걸 수 있게 한다(빈 방은 정렬상 아래로 간다).
    const apps = (await db()
      .prepare(
        `SELECT a.id, a.name, a.photo_url, r.title role_title, r.project_id
         FROM applications a JOIN roles r ON r.id=a.role_id
         WHERE r.project_id IN (${marks(ids.length)})`,
      )
      .all(...ids)) as Row[];
    const messages = await messagesOf(apps.map((app) => str(app.id)));
    for (const app of apps) {
      const project = projects.find((item) => item.id === str(app.project_id))!;
      const ownerId = str(byId.get(project.id)?.owner_id);
      const team = teams.get(project.id) ?? [ownerId];
      const own = messages.filter((row) => str(row.application_id) === str(app.id));
      const existing = own.map((row) => str(row.room)).filter(Boolean);
      for (const room of producerRooms(team, userId, existing)) {
        const mine = own.filter((row) => str(row.room) === room);
        const key = threadKey(str(app.id), room);
        const last = mine.at(-1);
        const group = room === '';
        rooms.push({
          key,
          folderKey: project.id,
          folderTitle: project.title,
          kind: 'actor',
          title: str(app.name),
          subtitle: `${str(app.role_title)} · ${
            !hasPrivateRooms(team) ? '배우와 대화' : group ? '단톡방' : '1:1 (나와 배우)'
          }`,
          photo: str(app.photo_url),
          last: last ? preview(last) : '아직 대화가 없어요. 먼저 말을 걸어 보세요.',
          lastAt: last ? str(last.created_at) : '',
          unread: unreadCount(
            mine.map((row) => ({
              at: str(row.created_at),
              // 예전 메시지는 보낸 사람 id가 없어서, 주인이 보낸 것으로 본다.
              mine:
                str(row.sender) === 'producer' &&
                (str(row.sender_id) === userId || (!str(row.sender_id) && userId === ownerId)),
            })),
            readAt(key),
          ),
          applicationId: str(app.id),
          room,
          projectId: project.id,
          projectTitle: project.title,
          roleTitle: str(app.role_title),
        });
      }
    }
  }

  // 프로젝트가 생기기 전의 예전 배역(주인만)
  const legacy = (await db()
    .prepare(
      `SELECT a.id, a.name, a.photo_url, r.id role_id, r.title role_title, r.project_title
       FROM applications a JOIN roles r ON r.id=a.role_id
       WHERE r.owner_id=? AND (r.project_id IS NULL OR r.project_id='')`,
    )
    .all(userId)) as Row[];
  const legacyMessages = await messagesOf(legacy.map((app) => str(app.id)));
  for (const app of legacy) {
    const mine = legacyMessages.filter((row) => str(row.application_id) === str(app.id));
    const key = threadKey(str(app.id), '');
    const last = mine.at(-1);
    rooms.push({
      key,
      folderKey: `role:${str(app.role_id)}`,
      folderTitle: str(app.project_title),
      kind: 'actor',
      title: str(app.name),
      subtitle: str(app.role_title),
      photo: str(app.photo_url),
      last: last ? preview(last) : '아직 대화가 없어요. 먼저 말을 걸어 보세요.',
      lastAt: last ? str(last.created_at) : '',
      unread: unreadCount(
        mine.map((row) => ({ at: str(row.created_at), mine: str(row.sender) === 'producer' })),
        readAt(key),
      ),
      applicationId: str(app.id),
      room: '',
      projectTitle: str(app.project_title),
      roleTitle: str(app.role_title),
    });
  }
  return buildFolders(rooms);
}

/** 배우의 채팅 목록: 내가 지원한 공고마다, 제작진이 연 방들(단톡방 하나 또는 팀원별 방). */
export async function actorInbox(actorId: string) {
  const apps = (await db()
    .prepare(
      `SELECT a.id, a.receipt_token, r.id role_id, r.title role_title,
         COALESCE(p.title, r.project_title) project_title, r.project_id,
         r.contact_name, p.owner_id, u.name owner_name
       FROM applications a JOIN roles r ON r.id=a.role_id
       LEFT JOIN projects p ON p.id=r.project_id
       LEFT JOIN users u ON u.id=COALESCE(p.owner_id, r.owner_id)
       WHERE a.actor_id=?`,
    )
    .all(actorId)) as Row[];
  const messages = await messagesOf(apps.map((app) => str(app.id)));
  const reads = await readTimes(apps.map((app) => actorReaderKey(str(app.id))));
  const projectIds = [...new Set(apps.map((app) => str(app.project_id)).filter(Boolean))];
  const owners = new Map(apps.map((app) => [str(app.project_id), { owner_id: app.owner_id }]));
  const teams = await teamsOf(projectIds, owners);
  const everyone = [
    ...[...teams.values()].flat(),
    ...messages.map((row) => str(row.room)).filter(Boolean),
  ];
  const names = new Map<string, string>();
  const unique = [...new Set(everyone)];
  if (unique.length > 0)
    for (const row of (await db()
      .prepare(`SELECT id, name FROM users WHERE id IN (${marks(unique.length)})`)
      .all(...unique)) as Row[])
      names.set(str(row.id), str(row.name));

  const rooms: InboxRoom[] = [];
  for (const app of apps) {
    const team = app.project_id ? (teams.get(str(app.project_id)) ?? []) : [];
    const own = messages.filter((row) => str(row.application_id) === str(app.id));
    const existing = own.map((row) => str(row.room)).filter(Boolean);
    const solo = !hasPrivateRooms(team);
    for (const room of actorRooms(team, existing)) {
      const inRoom = own.filter((row) => str(row.room) === room);
      const key = threadKey(str(app.id), room);
      const last = inRoom.at(-1);
      const lead = str(app.owner_name) || str(app.contact_name) || '제작진';
      rooms.push({
        key,
        folderKey: str(app.project_id) || `role:${str(app.role_id)}`,
        folderTitle: str(app.project_title),
        kind: 'actor',
        title: room ? names.get(room) || '제작진' : solo ? lead : '제작진 단톡방',
        subtitle: `${str(app.role_title)} · ${
          room ? '1:1 대화' : solo ? '제작진과 대화' : `제작진 ${team.length}명 모두와 함께`
        }`,
        photo: '',
        last: last ? preview(last) : '궁금한 점을 제작진에게 물어보세요.',
        lastAt: last ? str(last.created_at) : '',
        unread: unreadCount(
          inRoom.map((row) => ({ at: str(row.created_at), mine: str(row.sender) === 'actor' })),
          reads.get(`${actorReaderKey(str(app.id))}|${key}`) ?? '',
        ),
        applicationId: str(app.id),
        room,
        receipt: str(app.receipt_token),
        projectId: str(app.project_id),
        projectTitle: str(app.project_title),
        roleTitle: str(app.role_title),
      });
    }
  }
  return buildFolders(rooms);
}

// --- 팀 내부방 ---

export type TeamMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

export async function listTeamMessages(projectId: string): Promise<TeamMessage[]> {
  return (
    (await db()
      .prepare(
        `SELECT t.id, t.sender_id, t.body, t.created_at, u.name FROM team_messages t
         LEFT JOIN users u ON u.id=t.sender_id WHERE t.project_id=? ORDER BY t.created_at ASC`,
      )
      .all(projectId)) as Row[]
  ).map((row) => ({
    id: str(row.id),
    senderId: str(row.sender_id),
    senderName: str(row.name) || '제작진',
    body: str(row.body),
    createdAt: str(row.created_at),
  }));
}

export async function sendTeamMessage(projectId: string, senderId: string, body: string) {
  await db()
    .prepare(
      'INSERT INTO team_messages (id, project_id, sender_id, body, created_at) VALUES (?,?,?,?,?)',
    )
    .run(randomUUID(), projectId, senderId, body, new Date().toISOString());
}
