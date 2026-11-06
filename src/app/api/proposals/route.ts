import { NextRequest, NextResponse } from 'next/server';
import { createProposal, getUserById } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { mailConfigured, sendMail } from '@/lib/mail';
import { proposalMail } from '@/lib/proposal-mail';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const message = requiredText(body.message, 1000);
  if (!message)
    return NextResponse.json({ error: '제안 메시지를 입력해 주세요.' }, { status: 400 });
  const result = await createProposal(
    producerId,
    requiredText(body.actorId, 60),
    requiredText(body.roleId, 60),
    message,
  );
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });

  // 배우에게 알림 메일. 메일이 안 가도 제안은 이미 저장됐으므로 실패로 돌려주지 않는다.
  let notified = false;
  const actor = await getUserById(result.proposal.actorId);
  if (actor?.email && !actor.email.endsWith('@demo.casting') && mailConfigured()) {
    try {
      await sendMail({ to: actor.email, ...proposalMail(result.proposal, request.nextUrl.origin) });
      notified = true;
    } catch (error) {
      console.error('제안 알림 메일 실패', error);
    }
  }
  return NextResponse.json({ proposal: result.proposal, notified }, { status: 201 });
}
