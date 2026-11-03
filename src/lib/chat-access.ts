import type { NextRequest } from 'next/server';
import { getProducerId } from './auth';
import { isBoardMember } from './board';
import { actorRooms, pickActorRoom, producerRoom, type ChatMode } from './chat-rooms';
import { getApplication, getChatContext, listChatRooms } from './db';

/** 대화에 들어온 사람. 제작진은 자기가 들어갈 방이 정해져 있고, 배우는 자기 지원서의 모든 방에 들어갈 수 있다. */
export type ChatParticipant =
  | { kind: 'actor'; mode: ChatMode; rooms: string[] }
  | { kind: 'producer'; mode: ChatMode; userId: string; room: string };

/**
 * 이 지원서의 대화에 누가 들어왔는지 정한다.
 * - 배우: 로그인 없이 지원 현황 주소의 토큰으로 들어온다. 제작진이 대화를 연 뒤에만.
 * - 제작진: 프로젝트 주인이나 팀원(팀 보드에 초대된 사람). 예전 배역(프로젝트 없음)은 배역 주인만.
 *   개별방 방식이면 팀원은 자기 방에만, 주인은 기본 방에만 들어간다(서로의 방은 볼 수 없다).
 * 사진·링크처럼 머리글을 붙일 수 없는 요청을 위해 토큰은 주소의 ?t= 로도 받는다.
 */
export async function chatParticipant(
  request: NextRequest,
  applicationId: string,
  receipt?: string,
): Promise<ChatParticipant | null> {
  const context = await getChatContext(applicationId);
  if (!context) return null;
  const token =
    receipt ||
    request.headers.get('x-receipt-token') ||
    request.nextUrl.searchParams.get('t') ||
    '';
  if (token) {
    const application = await getApplication(applicationId);
    if (!(application?.chatOpen && token.length >= 40 && token === application.receiptToken))
      return null;
    const existing = (await listChatRooms(applicationId)).map((item) => item.room);
    return { kind: 'actor', mode: context.mode, rooms: actorRooms(context.mode, existing) };
  }
  const userId = await getProducerId();
  if (!userId) return null;
  const allowed = context.projectId
    ? await isBoardMember(context.projectId, userId)
    : context.ownerId === userId;
  if (!allowed) return null;
  return {
    kind: 'producer',
    mode: context.mode,
    userId,
    room: producerRoom(context.mode, context.ownerId, userId),
  };
}

/** 이번 요청이 쓸 방. 제작진은 정해진 자기 방, 배우는 고른 방(들어갈 수 없는 방이면 기본 방). */
export function participantRoom(participant: ChatParticipant, requested: unknown) {
  if (participant.kind === 'producer') return participant.room;
  return pickActorRoom(participant.mode, participant.rooms.filter(Boolean), requested);
}

/** 이 사람이 그 방의 파일·메시지를 볼 수 있는지 */
export function canSeeRoom(participant: ChatParticipant, room: string) {
  return participant.kind === 'producer'
    ? participant.room === room
    : participant.rooms.includes(room);
}
