import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { isBoardOwner } from '@/lib/board';
import { chatMode } from '@/lib/chat-rooms';
import { setProjectChatMode } from '@/lib/db';
import { requiredText } from '@/lib/validation';

/** 프로젝트의 배우 대화방 방식 바꾸기(단톡방/개별방). 프로젝트 주인만. body: { projectId, mode } */
export async function PUT(request: NextRequest) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const projectId = requiredText(body.projectId, 60);
  if (!projectId || !(await isBoardOwner(projectId, userId)))
    return NextResponse.json({ error: '프로젝트 주인만 바꿀 수 있습니다.' }, { status: 403 });
  const mode = chatMode(body.mode);
  await setProjectChatMode(projectId, mode);
  return NextResponse.json({ mode });
}
