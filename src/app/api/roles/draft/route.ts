// 시놉시스·기획 메모 → 배역 공고 초안. 공고 작성 화면의 배역 단계에서 쓴다.
// 서버는 초안만 돌려주고 저장하지 않는다. 제작진이 화면에서 확인하고 고른 배역만 입력칸에 들어간다.

import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { overLimit, TOO_MANY } from '@/lib/rate-limit';
import { draftRoles, roleAiConfigured, RoleAiUnavailable } from '@/lib/role-ai';
import { MAX_SOURCE_TEXT, MIN_SOURCE_TEXT } from '@/lib/role-draft';
import { requiredText } from '@/lib/validation';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
// AI 호출에 비용이 들어서 한 제작자가 하루에 쓸 수 있는 횟수를 정해 둔다.
const DAILY_LIMIT = 20;

export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId)
    return NextResponse.json({ error: '제작자 계정으로 로그인해 주세요.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const source = typeof body.text === 'string' ? body.text.trim() : '';
  if (source.length < MIN_SOURCE_TEXT)
    return NextResponse.json(
      { error: `시놉시스나 메모를 ${MIN_SOURCE_TEXT}자 이상 넣어 주세요.` },
      { status: 400 },
    );
  if (source.length > MAX_SOURCE_TEXT)
    return NextResponse.json(
      {
        error: `글이 너무 길어요. ${MAX_SOURCE_TEXT.toLocaleString()}자 이내로 줄여서 넣어 주세요.`,
      },
      { status: 413 },
    );

  if (!roleAiConfigured())
    return NextResponse.json(
      { error: 'AI 배역 초안은 아직 준비 중이에요. 배역을 직접 입력해 주세요.' },
      { status: 503 },
    );

  if (await overLimit(`role-ai:${producerId}`, DAILY_LIMIT, 24 * 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  try {
    const roles = await draftRoles(source, {
      projectTitle: requiredText(body.projectTitle, 100),
      format: requiredText(body.format, 40),
      logline: requiredText(body.logline, 120),
    });
    return NextResponse.json(
      {
        roles,
        note: roles.length
          ? 'AI가 만든 초안이라 틀릴 수 있어요. 넣은 뒤 내용을 꼭 확인해 주세요.'
          : '글에서 배역으로 만들 인물을 찾지 못했어요. 인물 소개가 들어간 글로 다시 시도해 주세요.',
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (!(error instanceof RoleAiUnavailable)) throw error;
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
}
