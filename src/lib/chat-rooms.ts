// 배우와의 대화방 규칙. 지원서마다 방이 자동으로 다 만들어진다(고르는 방식 없음).
// - 단톡방(room ''): 공고의 제작진 모두(주인 + 팀원)와 배우.
// - 1:1 방(room = 제작진 사용자 id): 제작진 한 사람과 배우. 다른 제작진은 볼 수 없다.
// 팀원 없이 주인 혼자인 공고는 두 방의 사람이 같으므로 단톡방 하나만 둔다.
// DB·Next에 기대지 않아 테스트로 지킨다.

export const GROUP_ROOM = '';

/** 팀(주인 + 팀원)이 두 명 이상이어야 1:1 방이 따로 생긴다. */
export function hasPrivateRooms(teamIds: string[]) {
  return new Set(teamIds.filter(Boolean)).size > 1;
}

/**
 * 제작진 한 사람이 들어가는 방: 단톡방 + 자기 1:1 방.
 * 팀원이 빠져 혼자 남았어도 예전에 나눈 자기 1:1 대화(existingRooms에 있으면)는 계속 볼 수 있다.
 */
export function producerRooms(teamIds: string[], userId: string, existingRooms: string[] = []) {
  const own =
    (hasPrivateRooms(teamIds) && teamIds.includes(userId)) || existingRooms.includes(userId);
  return own ? [GROUP_ROOM, userId] : [GROUP_ROOM];
}

/**
 * 배우가 들어가는 방: 단톡방 + 제작진 각자와의 1:1 방.
 * existingRooms는 이 지원서에 메시지가 있는 방들. 팀에서 빠진 사람과 나눈 예전 대화도 계속 볼 수 있게 더한다.
 */
export function actorRooms(teamIds: string[], existingRooms: string[] = []) {
  const team = hasPrivateRooms(teamIds) ? teamIds : [];
  return [...new Set([GROUP_ROOM, ...team, ...existingRooms].filter((room) => room !== undefined))];
}

/** 고른 방이 들어갈 수 있는 방이면 그대로, 아니면 단톡방 */
export function pickRoom(rooms: string[], requested: unknown) {
  return typeof requested === 'string' && rooms.includes(requested) ? requested : GROUP_ROOM;
}
