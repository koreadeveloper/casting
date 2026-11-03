import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { isBoardMember, isBoardOwner, listBoard, listMyBoardProjects } from '@/lib/board';
import { getProjectChatMode } from '@/lib/db';

export async function GET(request: NextRequest) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const projectId = request.nextUrl.searchParams.get('projectId')?.trim() || '';
  if (!projectId) return NextResponse.json({ projects: await listMyBoardProjects(userId) });
  const board = await listBoard(projectId);
  if (!board) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  if (!(await isBoardMember(projectId, userId)))
    return NextResponse.json({ error: '팀 보드 접근 권한이 없습니다.' }, { status: 403 });
  return NextResponse.json({
    project: {
      ...board.project,
      role: (await isBoardOwner(projectId, userId)) ? ('owner' as const) : ('member' as const),
      chatMode: await getProjectChatMode(projectId),
    },
    members: board.members,
    columns: board.columns,
  });
}
