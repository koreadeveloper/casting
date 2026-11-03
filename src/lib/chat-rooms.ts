// 배우와의 대화방 규칙. 프로젝트마다 방식을 하나 고른다.
// - group(단톡): 프로젝트 주인·팀원 모두와 배우가 한 방(room '')에서 이야기한다.
// - private(개별방): 팀원마다 배우와 따로 이야기한다. 주인의 방은 예전 대화가 있던 room '',
//   팀원의 방은 그 팀원의 사용자 id. 다른 사람의 방은 주인도 볼 수 없다(완전 비공개).
// DB·Next에 기대지 않아 테스트로 지킨다.

export type ChatMode = 'group' | 'private';

export const CHAT_MODE_LABEL: Record<ChatMode, string> = {
  group: '단톡방 (팀 전체 + 배우)',
  private: '개별방 (팀원마다 배우와 따로)',
};

/** 저장된 값을 방식으로. 비어 있거나 모르는 값은 단톡방으로 본다. */
export function chatMode(value: unknown): ChatMode {
  return value === 'private' ? 'private' : 'group';
}

/** 제작진 한 사람이 들어가는 방. 단톡방이거나 프로젝트 주인이면 기본 방(''), 아니면 자기 방. */
export function producerRoom(mode: ChatMode, ownerId: string, userId: string) {
  return mode === 'private' && userId !== ownerId ? userId : '';
}

/**
 * 배우가 들어갈 수 있는 방. 기본 방('')은 늘 있고, 개별방 방식이면 팀원이 말을 걸어 생긴 방들이 더해진다.
 * existingRooms는 이 지원서에 메시지가 있는 방 id들('' 제외).
 */
export function actorRooms(mode: ChatMode, existingRooms: string[]) {
  return mode === 'private' ? ['', ...existingRooms.filter(Boolean)] : [''];
}

/** 배우가 고른 방이 들어갈 수 있는 방이면 그대로, 아니면 기본 방 */
export function pickActorRoom(mode: ChatMode, existingRooms: string[], requested: unknown) {
  const rooms = actorRooms(mode, existingRooms);
  return typeof requested === 'string' && rooms.includes(requested) ? requested : '';
}
