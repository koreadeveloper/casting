// 프로필 PDF·사진(또는 붙여넣은 글자) → 프로필 초안.
// PDF·사진은 AI가 읽고(profile-ai.ts), AI를 쓸 수 없을 때 글자가 들어 있는 PDF는 규칙으로 읽는다.
// 서버는 초안만 돌려주고 저장은 하지 않는다. 배우가 화면에서 확인하고 고른 항목만 프로필에 들어간다.

import { NextRequest, NextResponse } from 'next/server';
import { getActorId } from '@/lib/auth';
import { CHAT_FILE_MAX_BYTES, detectChatFile } from '@/lib/chat-files';
import { extractPdfText } from '@/lib/pdf-text';
import { draftFromText, draftSize } from '@/lib/profile-draft';
import { profileAiConfigured, ProfileAiUnavailable, readProfileFile } from '@/lib/profile-ai';
import { overLimit, TOO_MANY } from '@/lib/rate-limit';

// 서버리스 요청 크기 제한(4.5MB)보다 작게 둔다.
const MAX_BYTES = CHAT_FILE_MAX_BYTES;
const MAX_TEXT = 200_000;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

const QUALITY_NOTE = {
  good: '글꼴을 여러 개 쓴 PDF에서는 일부 글자가 다르게 읽힐 수 있어요. 채우기 전에 값을 확인해 주세요.',
  thin: 'PDF에서 읽은 글자가 적어서 일부만 채웠어요. 비어 있는 항목은 직접 넣어 주세요.',
  none: 'PDF에서 글자를 찾지 못했어요. 사진으로 스캔한 PDF는 글자를 읽을 수 없어요. 아래에 내용을 붙여넣으면 초안을 만들어 드려요.',
} as const;

export async function POST(request: NextRequest) {
  const actorId = await getActorId();
  if (!actorId)
    return NextResponse.json({ error: '배우 계정으로 로그인해 주세요.' }, { status: 401 });

  const type = request.headers.get('content-type') || '';

  // 글자를 직접 붙여넣는 길. PDF를 못 읽는 경우에도 늘 동작한다.
  if (type.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT) : '';
    if (text.trim().length < 10)
      return NextResponse.json({ error: '읽을 내용이 너무 짧습니다.' }, { status: 400 });
    const draft = draftFromText(text);
    return NextResponse.json(
      { draft, filled: draftSize(draft), quality: 'good', note: '', method: 'rule' },
      { headers: NO_STORE },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: 'PDF 또는 사진 파일을 선택해 주세요.' }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: '파일은 4MB 이하만 올릴 수 있습니다.' }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectChatFile(bytes, file.name);
  if (ext !== 'pdf' && ext !== 'jpg' && ext !== 'png' && ext !== 'webp')
    return NextResponse.json(
      { error: 'PDF 또는 사진(JPG·PNG·WEBP)만 읽을 수 있습니다.' },
      { status: 415 },
    );

  // 글자가 들어 있는 PDF는 AI 없이도 읽을 수 있어서, AI를 못 쓰면 규칙으로 읽는다.
  const ruleBased = () => {
    const { text, quality } = extractPdfText(Buffer.from(bytes));
    const draft = quality === 'none' ? {} : draftFromText(text);
    return NextResponse.json(
      {
        draft,
        filled: draftSize(draft),
        quality,
        note: QUALITY_NOTE[quality],
        method: 'rule',
        // 배우가 "이게 내 PDF에서 읽은 글자야?"를 직접 볼 수 있게 앞부분을 돌려준다.
        preview: text.slice(0, 2000),
      },
      { headers: NO_STORE },
    );
  };

  if (!profileAiConfigured()) {
    if (ext === 'pdf') return ruleBased();
    return NextResponse.json(
      {
        error:
          '사진 읽기는 아직 준비 중이에요. 글자가 들어 있는 PDF를 올리거나 내용을 붙여넣어 주세요.',
      },
      { status: 503 },
    );
  }

  // AI 읽기에 비용이 들어서 한 사람이 하루에 여러 번 못 올리게 한다.
  if (await overLimit(`profile-ai:${actorId}`, 10, 24 * 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  try {
    const draft = await readProfileFile(bytes, ext);
    return NextResponse.json(
      {
        draft,
        filled: draftSize(draft),
        quality: 'good',
        note:
          draftSize(draft) === 0
            ? '서류에서 읽을 수 있는 항목을 찾지 못했어요. 글자가 또렷한 파일로 다시 올려 주세요.'
            : 'AI가 읽은 내용은 틀릴 수 있어요. 채우기 전에 값을 확인해 주세요.',
        method: 'ai',
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (!(error instanceof ProfileAiUnavailable)) throw error;
    // AI가 잠시 안 될 때 PDF는 규칙으로라도 읽어 준다.
    if (ext === 'pdf') return ruleBased();
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
}
