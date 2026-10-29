import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateProject } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { closeOverdueResults, createRole, listRoles } from '@/lib/db';
import { kstToday } from '@/lib/result-deadline';
import { requiredText } from '@/lib/validation';

export async function GET() {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  // 스튜디오를 열 때, 결과 기준일이 지나도록 결과가 없는 지원자에게 자동으로 결과를 안내한다.
  await closeOverdueResults({ ownerId: producerId }, kstToday());
  return NextResponse.json({ roles: await listRoles(producerId) });
}

export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const input = {
    projectTitle: requiredText(body.projectTitle, 100),
    title: requiredText(body.title, 100),
    description: requiredText(body.description, 2000),
    shootDate: requiredText(body.shootDate, 30),
    location: requiredText(body.location, 100),
    pay: requiredText(body.pay, 100),
    deadline: requiredText(body.deadline, 30),
    contactName: requiredText(body.contactName, 100),
    announcementDate: requiredText(body.announcementDate, 30),
    requirement: requiredText(body.requirement, 500),
  };
  if (
    !input.projectTitle ||
    !input.title ||
    !input.description ||
    !input.shootDate ||
    !input.location ||
    !input.pay ||
    !input.deadline ||
    !input.contactName ||
    !input.announcementDate
  ) {
    return NextResponse.json({ error: '필수 배역 정보를 입력해 주세요.' }, { status: 400 });
  }
  const project = await findOrCreateProject(producerId, input);
  return NextResponse.json(
    { role: await createRole(input, producerId, project.id) },
    { status: 201 },
  );
}
