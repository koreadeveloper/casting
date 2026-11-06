// 배우와의 대화방 규칙. 지원서마다 방이 자동으로 다 만들어진다(고르는 방식 없음).
// - 단톡방(room ''): 공고의 제작진 모두(주인 + 팀원)와 배우.
// - 1:1 방(room = 제작진 사용자 id): 제작진 한 사람과 배우. 다른 제작진은 볼 수 없다.
// 주인 혼자인 공고도 1:1 방을 따로 둔다. 나중에 팀원을 초대하면 단톡방 대화는 새 팀원도 보지만,
// 1:1 방 대화는 계속 둘만 본다. 프로젝트가 없는 예전 배역은 팀이 없어(teamIds 빈 목록) 단톡방 하나뿐이다.
// DB·Next에 기대지 않아 테스트로 지킨다.

export const GROUP_ROOM = '';

/**
 * 제작진 한 사람이 들어가는 방: 단톡방 + 자기 1:1 방.
 * 팀원이 빠져 혼자 남았어도 예전에 나눈 자기 1:1 대화(existingRooms에 있으면)는 계속 볼 수 있다.
 */
export function producerRooms(teamIds: string[], userId: string, existingRooms: string[] = []) {
  const own = teamIds.includes(userId) || existingRooms.includes(userId);
  return own ? [GROUP_ROOM, userId] : [GROUP_ROOM];
}

/**
 * 배우가 들어가는 방: 단톡방 + 제작진 각자와의 1:1 방.
 * existingRooms는 이 지원서에 메시지가 있는 방들. 팀에서 빠진 사람과 나눈 예전 대화도 계속 볼 수 있게 더한다.
 */
export function actorRooms(teamIds: string[], existingRooms: string[] = []) {
  return [GROUP_ROOM, ...new Set([...teamIds, ...existingRooms].filter(Boolean))];
}

/** 고른 방이 들어갈 수 있는 방이면 그대로, 아니면 단톡방 */
export function pickRoom(rooms: string[], requested: unknown) {
  return typeof requested === 'string' && rooms.includes(requested) ? requested : GROUP_ROOM;
}
