import type { NextRequest } from 'next/server';
import { getProducerId } from './auth';
import { isBoardMember } from './board';
import { actorRooms, pickRoom, producerRooms } from './chat-rooms';
import { getApplication, getChatContext, listChatRooms } from './db';

/**
 * 대화에 들어온 사람과 들어갈 수 있는 방들.
 * 제작진: 단톡방 + 자기 1:1 방. 배우: 단톡방 + 제작진 각자와의 1:1 방. (규칙은 chat-rooms.ts)
 */
export type ChatParticipant =
  | { kind: 'actor'; rooms: string[]; teamIds: string[] }
  | { kind: 'producer'; userId: string; rooms: string[]; teamIds: string[] };

/**
 * 이 지원서의 대화에 누가 들어왔는지 정한다.
 * - 배우: 로그인 없이 지원 현황 주소의 토큰으로 들어온다. 먼저 문의를 시작할 수도 있다.
 * - 제작진: 프로젝트 주인이나 팀원(팀 보드에 초대된 사람). 예전 배역(프로젝트 없음)은 배역 주인만.
 *   다른 제작진의 1:1 방은 주인도 볼 수 없다.
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
    // 접수 링크(토큰)를 가진 배우는 제작진이 먼저 말을 걸지 않아도 문의를 시작할 수 있다.
    if (!(application && token.length >= 40 && token === application.receiptToken)) return null;
    const existing = (await listChatRooms(applicationId)).map((item) => item.room);
    return {
      kind: 'actor',
      rooms: actorRooms(context.teamIds, existing),
      teamIds: context.teamIds,
    };
  }
  const userId = await getProducerId();
  if (!userId) return null;
  const existing = (await listChatRooms(applicationId)).map((item) => item.room);
  const allowed = context.projectId
    ? await isBoardMember(context.projectId, userId)
    : context.ownerId === userId;
  if (!allowed) return null;
  return {
    kind: 'producer',
    userId,
    rooms: producerRooms(context.teamIds, userId, existing),
    teamIds: context.teamIds,
  };
}

/** 이번 요청이 쓸 방: 고른 방이 들어갈 수 있는 방이면 그 방, 아니면 단톡방 */
export function participantRoom(participant: ChatParticipant, requested: unknown) {
  return pickRoom(participant.rooms, requested);
}

/** 이 사람이 그 방의 파일·메시지를 볼 수 있는지 */
export function canSeeRoom(participant: ChatParticipant, room: string) {
  return participant.rooms.includes(room);
}
