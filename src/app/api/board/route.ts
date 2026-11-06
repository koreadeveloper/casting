import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { isBoardMember, isBoardOwner, listBoard, listMyBoardProjects } from '@/lib/board';
import { todayKst } from '@/lib/calendar-grid';
import { getProjectChatMode, listProjectRoles } from '@/lib/db';

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
    // 후보 배우에게 출연 제안을 보낼 때 고르는 배역(모집 중인 것만 고를 수 있다)
    roles: (await listProjectRoles(projectId)).map((role) => ({
      id: role.id,
      title: role.title,
      open: !role.isClosed && role.deadline >= todayKst(),
    })),
  });
}
