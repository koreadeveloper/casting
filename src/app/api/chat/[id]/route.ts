import { NextRequest, NextResponse } from 'next/server';
import { canSeeRoom, chatParticipant, participantRoom } from '@/lib/chat-access';
import {
  getChatMessage,
  listChatMessages,
  respondToOffer,
  sendChatMessage,
  userNames,
} from '@/lib/db';
import { markRead } from '@/lib/inbox';
import { actorReaderKey, threadKey } from '@/lib/inbox-rules';
import { requiredText } from '@/lib/validation';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const participant = await chatParticipant(request, id);
  if (!participant) return NextResponse.json({ error: '대화를 볼 수 없습니다.' }, { status: 403 });
  const room = participantRoom(participant, request.nextUrl.searchParams.get('room') ?? '');
  // 방을 열어 본 시각을 남겨 채팅 목록의 안 읽은 수를 줄인다.
  await markRead(
    participant.kind === 'producer' ? participant.userId : actorReaderKey(id),
    threadKey(id, room),
  );
  // 들어갈 수 있는 방 목록(단톡방 + 1:1 방들). 1:1 방 이름은 그 제작진의 이름.
  const names = await userNames(participant.rooms);
  const rooms = participant.rooms.map((item) => ({
    room: item,
    name: item ? names.get(item) || '제작진' : '단톡방',
  }));
  return NextResponse.json(
    {
      messages: await listChatMessages(id, room),
      room,
      rooms,
      me: participant.kind === 'producer' ? participant.userId : '',
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const participant = await chatParticipant(request, id, requiredText(body.receipt, 100));
  if (!participant)
    return NextResponse.json({ error: '대화를 보낼 수 없습니다.' }, { status: 403 });
  const sender = participant.kind;
  const kind = body.kind === 'offer' ? 'offer' : 'text';
  if (kind === 'offer' && sender !== 'producer')
    return NextResponse.json({ error: '제작자만 일정을 제안할 수 있습니다.' }, { status: 403 });
  const text = requiredText(body.body, 1500);
  const slots = Array.isArray(body.slots)
    ? ([
        ...new Set(
          body.slots.filter(
            (slot: unknown) =>
              typeof slot === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot),
          ),
        ),
      ].slice(0, 3) as string[])
    : [];
  const place = requiredText(body.place, 200);
  const preparation = requiredText(body.preparation, 500);
  if (kind === 'text' && !text)
    return NextResponse.json({ error: '메시지를 입력해 주세요.' }, { status: 400 });
  if (kind === 'offer' && (slots.length < 2 || !place))
    return NextResponse.json({ error: '시간과 장소를 입력해 주세요.' }, { status: 400 });
  const message = await sendChatMessage(id, {
    sender,
    kind,
    body: text,
    slots,
    place,
    preparation,
    senderId: participant.kind === 'producer' ? participant.userId : '',
    room: participantRoom(participant, body.room),
  });
  return message
    ? NextResponse.json({ message }, { status: 201 })
    : NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const participant = await chatParticipant(request, id, requiredText(body.receipt, 100));
  if (!participant)
    return NextResponse.json({ error: '대화를 변경할 수 없습니다.' }, { status: 403 });
  const sender = participant.kind;
  const message = await getChatMessage(requiredText(body.messageId, 100));
  if (!message || message.applicationId !== id || !canSeeRoom(participant, message.room))
    return NextResponse.json({ error: '제안을 찾을 수 없습니다.' }, { status: 404 });
  const action = body.action;
  if (
    (action === 'select' || action === 'decline' || action === 'request_change') &&
    sender !== 'actor'
  )
    return NextResponse.json({ error: '배우만 응답할 수 있습니다.' }, { status: 403 });
  if (action === 'confirm' && sender !== 'producer')
    return NextResponse.json({ error: '제작자만 확정할 수 있습니다.' }, { status: 403 });
  if (!['select', 'decline', 'request_change', 'confirm'].includes(action))
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 });
  const updated = await respondToOffer(message.id, action, requiredText(body.selectedSlot, 30));
  return updated
    ? NextResponse.json({ message: updated })
    : NextResponse.json({ error: '현재 상태에서는 처리할 수 없습니다.' }, { status: 409 });
}
