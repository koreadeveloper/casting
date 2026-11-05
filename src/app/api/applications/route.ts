import { NextRequest, NextResponse } from 'next/server';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';
import { getProposal, setProposalStatus } from '@/lib/accounts';
import { getActorId, getProducerId } from '@/lib/auth';
import { CHILD_APPLY_MESSAGE, isChildRole, isUnderApplyAge } from '@/lib/child-policy';
import {
  createApplication,
  findActorApplicationToken,
  getRole,
  listApplications,
  listRecentApplications,
  recordEvent,
  roleOwnedBy,
} from '@/lib/db';
import {
  MAX_APPLICATION_PHOTOS,
  APPLICATION_INTRO_MAX,
  requiredText,
  safeImageRef,
  safeUrl,
  validEmail,
} from '@/lib/validation';

export async function GET(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const roleId = request.nextUrl.searchParams.get('roleId') || '';
  if (!roleId)
    return NextResponse.json({ applications: await listRecentApplications(producerId, 12) });
  if (!(await roleOwnedBy(roleId, producerId)))
    return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ applications: await listApplications(roleId) });
}

export async function POST(request: NextRequest) {
  // 공개 지원 링크는 로그인 없이 쓸 수 있어 IP 단위로 제한한다.
  if (await overLimit(`apply-ip:${clientIp(request.headers)}`, 20, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const role = await getRole(requiredText(body.roleSlug, 100));
  if (!role) return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
  if (role.isClosed || (role.deadline && role.deadline < new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ error: '지원이 마감된 배역입니다.' }, { status: 409 });
  }
  const name = requiredText(body.name, 80);
  const email = requiredText(body.email, 254).toLowerCase();
  const phone = requiredText(body.phone, 50);
  if (
    typeof body.introduction === 'string' &&
    body.introduction.trim().length > APPLICATION_INTRO_MAX
  )
    return NextResponse.json(
      { error: `소개는 ${APPLICATION_INTRO_MAX}자까지 쓸 수 있어요. 조금 줄여 주세요.` },
      { status: 400 },
    );
  const introduction = requiredText(body.introduction, APPLICATION_INTRO_MAX);
  // 배우가 고른 사진들. 첫 장이 이 공고의 대표 사진이 된다.
  // 사진 선택 UI가 없는 경로(비로그인 지원)는 photoUrl 하나만 보낸다.
  const sentPhotos: unknown[] = Array.isArray(body.photoUrls) ? body.photoUrls : [body.photoUrl];
  const photoUrls = [...new Set(sentPhotos.map(safeImageRef).filter(Boolean))].slice(
    0,
    MAX_APPLICATION_PHOTOS,
  );
  const photoUrl = photoUrls[0] || '';
  const videoUrl = safeUrl(body.videoUrl);
  const available = requiredText(body.available, 20);
  const travel = requiredText(body.travel, 20);
  const payAccepted = requiredText(body.payAccepted, 20);
  const skill = requiredText(body.skill, 300);
  const age = body.age === '' || body.age == null ? null : Number(body.age);
  if (
    !name ||
    !validEmail(email) ||
    !phone ||
    !introduction ||
    // 영상 링크는 선택. 다만 무언가 적었는데 링크 모양이 아니면 알려 준다.
    (requiredText(body.videoUrl, 1000) !== '' && !videoUrl) ||
    !['yes', 'no', 'unsure'].includes(available) ||
    !['yes', 'no', 'unsure'].includes(travel) ||
    !['yes', 'no', 'unsure'].includes(payAccepted) ||
    (age !== null && (!Number.isInteger(age) || age < 1 || age > 120))
  ) {
    return NextResponse.json(
      {
        error:
          '필수 항목을 확인해 주세요. 영상 링크를 넣었다면 https://로 시작하는 주소인지 확인해 주세요.',
      },
      { status: 400 },
    );
  }
  // 파일럿에서는 만 14세 미만 지원서를 받지 않는다(법정대리인 동의 절차가 없어서). lib/child-policy.ts
  if (isUnderApplyAge(age) || isChildRole(role.ageMin, role.ageMax))
    return NextResponse.json({ error: CHILD_APPLY_MESSAGE, child: true }, { status: 400 });
  const actorId = await getActorId();
  // 제작진 제공 동의는 모두에게, 수집·이용 동의는 가입 때 동의하지 않은 비회원에게 받는다.
  if (body.agreeProvide !== true || (!actorId && body.agreePrivacy !== true))
    return NextResponse.json({ error: '필수 동의 항목을 확인해 주세요.' }, { status: 400 });
  // 같은 배우가 같은 배역에 두 번 지원하지 못하게 한다(이메일을 바꿔도). 기존 접수 링크를 돌려준다.
  if (actorId) {
    const existing = await findActorApplicationToken(actorId, role.id);
    if (existing)
      return NextResponse.json(
        {
          error: '이미 이 배역에 지원했어요. 기존 지원 현황으로 이동합니다.',
          receiptToken: existing,
        },
        { status: 409 },
      );
  }
  try {
    const application = await createApplication(
      role.id,
      {
        name,
        age,
        email,
        phone,
        introduction,
        photoUrl,
        photoUrls,
        videoUrl,
        available,
        travel,
        payAccepted,
        skill,
      },
      actorId,
    );
    const proposalId = requiredText(body.proposalId, 60);
    if (actorId && proposalId) {
      const proposal = await getProposal(proposalId);
      if (proposal && proposal.actorId === actorId && proposal.roleId === role.id)
        await setProposalStatus(proposalId, actorId, 'accepted');
    }
    return NextResponse.json({ receiptToken: application.receiptToken }, { status: 201 });
  } catch (error) {
    // 같은 배역에 같은 이메일로 다시 낸 경우(UNIQUE(role_id, email)). 23505는 Postgres의 중복 오류 번호.
    if ((error as { code?: string })?.code === '23505')
      return NextResponse.json(
        { error: '이 이메일로 이미 지원했습니다. 기존 접수 링크를 확인해 주세요.' },
        { status: 409 },
      );
    throw error;
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const role = await getRole(requiredText(body.roleSlug, 100));
  if (!role) return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
  await recordEvent(role.id, null, 'application_started');
  return NextResponse.json({ ok: true });
}
