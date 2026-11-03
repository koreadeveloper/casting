// 채팅 목록(공고별 폴더) 규칙. DB·Next에 기대지 않아 테스트로 지킨다.
// 폴더 = 공고(프로젝트). 폴더 안의 방 = 배우와의 방(단톡방 또는 개별방) + 팀 내부방(제작진만).

/** 읽은 시각을 저장할 때 쓰는 방 이름 */
export const threadKey = (applicationId: string, room: string) => `app:${applicationId}:${room}`;
export const teamThreadKey = (projectId: string) => `team:${projectId}`;
/** 배우는 로그인 없이 접수 토큰으로도 들어오므로, 읽음 기록은 지원서 기준으로 남긴다. */
export const actorReaderKey = (applicationId: string) => `actor:${applicationId}`;

export type InboxRoom = {
  /** 목록 안에서 방을 구분하는 값(threadKey 또는 teamThreadKey) */
  key: string;
  folderKey: string;
  folderTitle: string;
  kind: 'actor' | 'team';
  title: string;
  subtitle: string;
  photo: string;
  last: string;
  lastAt: string;
  unread: number;
  /** 배우와의 방이면 지원서·방·(배우에게만) 접수 토큰 */
  applicationId?: string;
  room?: string;
  receipt?: string;
  projectId?: string;
  projectTitle: string;
  roleTitle: string;
  mode: 'group' | 'private';
  /** 팀 내부방이면 사람 수 */
  members?: number;
};

export type InboxFolder = { key: string; title: string; unread: number; lastAt: string };

/** 내가 읽은 시각 뒤에 남이 보낸 메시지 수 */
export function unreadCount(messages: { at: string; mine: boolean }[], readAt: string) {
  return messages.filter((message) => !message.mine && message.at > readAt).length;
}

/** 방들을 공고별 폴더로 묶는다. 폴더와 방 모두 최근 대화순. */
export function buildFolders(rooms: InboxRoom[]): { folders: InboxFolder[]; rooms: InboxRoom[] } {
  const sorted = [...rooms].sort((a, b) =>
    a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0,
  );
  const folders = new Map<string, InboxFolder>();
  for (const room of sorted) {
    const folder = folders.get(room.folderKey);
    if (folder) folder.unread += room.unread;
    else
      folders.set(room.folderKey, {
        key: room.folderKey,
        title: room.folderTitle,
        unread: room.unread,
        lastAt: room.lastAt,
      });
  }
  return { folders: [...folders.values()], rooms: sorted };
}

/** 목록 칩으로 거른 방들. 'all' 전체, 'unread' 안 읽은 방, 그 밖에는 폴더 key */
export function filterRooms(rooms: InboxRoom[], filter: string) {
  if (filter === 'all') return rooms;
  if (filter === 'unread') return rooms.filter((room) => room.unread > 0);
  return rooms.filter((room) => room.folderKey === filter);
}
