import { NextRequest, NextResponse } from 'next/server';
import {
  createProjectWithRoles,
  deleteProject,
  getProject,
  listProjects,
  setProjectArchived,
  updateProjectWithRoles,
} from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { parseProjectBody } from '@/lib/project-input';
import { deleteUploads } from '@/lib/storage';
import { requiredText } from '@/lib/validation';

export async function GET() {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  return NextResponse.json({ projects: await listProjects(producerId) });
}

/** 프로젝트 등록: 작품 정보 + 일정 + 배역 + 지원 조건을 한 번에 만든다. */
export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const parsed = parseProjectBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  // 새 프로젝트라 배역 id는 무시한다.
  const roles = parsed.roles.map(({ id: _id, isClosed: _closed, ...role }) => role);
  const created = await createProjectWithRoles(
    producerId,
    parsed.project,
    parsed.conditions,
    roles,
  );
  return NextResponse.json(created, { status: 201 });
}

/**
 * 프로젝트 수정 (소유자만). 등록과 같은 내용을 한 번에 저장한다.
 * body: 등록 내용 + id, 배역마다 기존 배역이면 id·isClosed.
 * 작품명·지역·지원 조건은 모든 배역에 일괄 반영되고, 저장된 배역은 지우지 않는다.
 *
 * 보관(숨김)·다시 꺼내기만 할 때: { id, archived: true | false }. 다른 값은 바꾸지 않는다.
 */
export async function PATCH(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = requiredText(body.id, 60);
  if (!id) return NextResponse.json({ error: '프로젝트 id가 필요합니다.' }, { status: 400 });
  const current = await getProject(id);
  if (!current)
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  if (current.ownerId !== producerId)
    return NextResponse.json({ error: '프로젝트를 수정할 권한이 없습니다.' }, { status: 403 });
  if (typeof body.archived === 'boolean' && Object.keys(body).length === 2) {
    const project = await setProjectArchived(producerId, id, body.archived);
    return project
      ? NextResponse.json({ project })
      : NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  }
  const parsed = parseProjectBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const saved = await updateProjectWithRoles(
    producerId,
    id,
    parsed.project,
    parsed.conditions,
    parsed.roles,
  );
  // 포스터를 바꾸거나 뺐으면 예전 포스터 파일은 지운다(실패해도 저장은 그대로).
  if (current.posterUrl && current.posterUrl !== parsed.project.posterUrl)
    await deleteUploads([current.posterUrl]);
  return NextResponse.json(saved);
}

/**
 * 프로젝트 완전 삭제 (소유자만). body: { id }
 * 지원서나 캐스팅 제안이 있으면 배우가 보는 기록이라 지우지 않고 409로 보관을 권한다.
 */
export async function DELETE(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = requiredText(body.id, 60);
  if (!id) return NextResponse.json({ error: '프로젝트 id가 필요합니다.' }, { status: 400 });
  const poster = (await getProject(id))?.posterUrl;
  const result = await deleteProject(producerId, id);
  if (result === 'missing')
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  if (result === 'in_use')
    return NextResponse.json(
      {
        error: '지원자나 보낸 캐스팅 제안이 있어 삭제할 수 없어요. 대신 보관해 주세요.',
        canArchive: true,
      },
      { status: 409 },
    );
  if (poster) await deleteUploads([poster]);
  return NextResponse.json({ deleted: true });
}
