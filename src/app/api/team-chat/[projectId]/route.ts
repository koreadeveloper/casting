import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { isBoardMember } from '@/lib/board';
import { listTeamMessages, markRead, sendTeamMessage } from '@/lib/inbox';
import { teamThreadKey } from '@/lib/inbox-rules';
import { requiredText } from '@/lib/validation';

/** 공고(프로젝트)의 팀 내부방. 주인과 팀원만 보고 쓴다. 배우는 들어올 수 없다. */
async function member(projectId: string) {
  const userId = await getProducerId();
  return userId && (await isBoardMember(projectId, userId)) ? userId : null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const userId = await member(projectId);
  if (!userId) return NextResponse.json({ error: '팀원만 볼 수 있습니다.' }, { status: 403 });
  await markRead(userId, teamThreadKey(projectId));
  return NextResponse.json(
    { messages: await listTeamMessages(projectId), me: userId },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const userId = await member(projectId);
  if (!userId) return NextResponse.json({ error: '팀원만 보낼 수 있습니다.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const text = requiredText(body.body, 1500);
  if (!text) return NextResponse.json({ error: '메시지를 입력해 주세요.' }, { status: 400 });
  await sendTeamMessage(projectId, userId, text);
  await markRead(userId, teamThreadKey(projectId));
  return NextResponse.json({ ok: true }, { status: 201 });
}
