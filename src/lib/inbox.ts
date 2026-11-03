// 채팅 목록(공고별 폴더)과 팀 내부방, 읽음 기록. 규칙은 inbox-rules.ts·chat-rooms.ts에 있다.

import { randomUUID } from 'node:crypto';
import { listMyBoardProjects } from './board';
import { MESSAGE_PREVIEW_SQL } from './chat-files';
import { chatMode, producerRoom } from './chat-rooms';
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
        `SELECT p.id, p.owner_id, p.chat_mode,
           (SELECT COUNT(*) FROM team_members tm WHERE tm.project_id=p.id AND tm.user_id<>p.owner_id) members
         FROM projects p WHERE p.id IN (${marks(ids.length)})`,
      )
      .all(...ids)) as Row[];
    const byId = new Map(meta.map((row) => [str(row.id), row]));

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
        mode: chatMode(info?.chat_mode),
        members: members + 1,
      });
    }

    // 배우와의 방: 내 방(단톡방이면 기본 방, 개별방이면 주인은 기본 방·팀원은 자기 방)에 메시지가 있는 지원서
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
      const info = byId.get(project.id);
      const mode = chatMode(info?.chat_mode);
      const ownerId = str(info?.owner_id);
      const room = producerRoom(mode, ownerId, userId);
      const mine = messages.filter(
        (row) => str(row.application_id) === str(app.id) && str(row.room) === room,
      );
      if (mine.length === 0) continue;
      const key = threadKey(str(app.id), room);
      const last = mine.at(-1)!;
      rooms.push({
        key,
        folderKey: project.id,
        folderTitle: project.title,
        kind: 'actor',
        title: str(app.name),
        subtitle: `${str(app.role_title)} · ${mode === 'group' ? '단톡방' : '나와의 개별방'}`,
        photo: str(app.photo_url),
        last: preview(last),
        lastAt: str(last.created_at),
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
        mode,
      });
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
    if (mine.length === 0) continue;
    const key = threadKey(str(app.id), '');
    const last = mine.at(-1)!;
    rooms.push({
      key,
      folderKey: `role:${str(app.role_id)}`,
      folderTitle: str(app.project_title),
      kind: 'actor',
      title: str(app.name),
      subtitle: str(app.role_title),
      photo: str(app.photo_url),
      last: preview(last),
      lastAt: str(last.created_at),
      unread: unreadCount(
        mine.map((row) => ({ at: str(row.created_at), mine: str(row.sender) === 'producer' })),
        readAt(key),
      ),
      applicationId: str(app.id),
      room: '',
      projectTitle: str(app.project_title),
      roleTitle: str(app.role_title),
      mode: 'group',
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
         r.contact_name, p.chat_mode, p.owner_id, u.name owner_name
       FROM applications a JOIN roles r ON r.id=a.role_id
       LEFT JOIN projects p ON p.id=r.project_id
       LEFT JOIN users u ON u.id=COALESCE(p.owner_id, r.owner_id)
       WHERE a.actor_id=? AND a.chat_open=1`,
    )
    .all(actorId)) as Row[];
  const messages = await messagesOf(apps.map((app) => str(app.id)));
  const reads = await readTimes(apps.map((app) => actorReaderKey(str(app.id))));
  const names = new Map<string, string>();
  const roomIds = [...new Set(messages.map((row) => str(row.room)).filter(Boolean))];
  if (roomIds.length > 0)
    for (const row of (await db()
      .prepare(`SELECT id, name FROM users WHERE id IN (${marks(roomIds.length)})`)
      .all(...roomIds)) as Row[])
      names.set(str(row.id), str(row.name));

  const rooms: InboxRoom[] = [];
  for (const app of apps) {
    const mode = chatMode(app.project_id ? app.chat_mode : '');
    const own = messages.filter((row) => str(row.application_id) === str(app.id));
    // 개별방 방식이면 메시지가 있는 팀원별 방도 보여 준다. 단톡방 방식이면 기본 방만.
    const roomList = mode === 'private' ? ['', ...new Set(own.map((row) => str(row.room)))] : [''];
    for (const room of [...new Set(roomList)]) {
      const inRoom = own.filter((row) => str(row.room) === room);
      if (inRoom.length === 0 && room !== '') continue;
      const key = threadKey(str(app.id), room);
      const last = inRoom.at(-1);
      const peer = room
        ? names.get(room) || '제작진'
        : str(app.owner_name) || str(app.contact_name);
      rooms.push({
        key,
        folderKey: str(app.project_id) || `role:${str(app.role_id)}`,
        folderTitle: str(app.project_title),
        kind: 'actor',
        title: mode === 'group' ? '제작진 단톡방' : peer,
        subtitle: `${str(app.role_title)} · ${mode === 'group' ? `${peer} 외 제작진 전체` : '개별방'}`,
        photo: '',
        last: last ? preview(last) : '제작진과 대화가 열렸어요.',
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
        mode,
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
