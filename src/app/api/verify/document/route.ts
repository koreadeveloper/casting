import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { CHAT_FILE_MAX_BYTES, detectChatFile } from '@/lib/chat-files';
import { overLimit, TOO_MANY } from '@/lib/rate-limit';
import { kstToday } from '@/lib/result-deadline';
import { readVerificationDocument, VerificationUnavailable } from '@/lib/verification-ai';
import { judgeDocument } from '@/lib/verification-rules';
import { saveDocumentVerdict } from '@/lib/verifications';

/**
 * 재학증명서(학교 인증) 또는 사업자등록증(제작사 인증)을 올리면 AI가 읽고 규칙으로 바로 판정한다.
 * 서류는 저장하지 않는다(이 요청 안에서 읽고 버린다).
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'producer')
    return NextResponse.json({ error: '제작자로 로그인해 주세요.' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const kind = form?.get('kind') === 'business' ? 'business' : 'school';
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: '서류 파일을 선택해 주세요.' }, { status: 400 });
  if (file.size > CHAT_FILE_MAX_BYTES)
    return NextResponse.json({ error: '파일은 4MB 이하만 올릴 수 있어요.' }, { status: 413 });
  // AI 확인에 비용이 들어서 한 사람이 하루에 여러 번 못 올리게 한다.
  if (await overLimit(`verify-doc:${user.id}`, 6, 24 * 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectChatFile(bytes, file.name);
  if (ext !== 'jpg' && ext !== 'png' && ext !== 'webp' && ext !== 'pdf')
    return NextResponse.json(
      { error: '사진(JPG·PNG·WEBP) 또는 PDF로 올려 주세요.' },
      { status: 415 },
    );
  try {
    const facts = await readVerificationDocument(kind, bytes, ext);
    const verdict = judgeDocument(
      kind,
      facts,
      { name: user.name, orgName: user.orgName },
      kstToday(),
    );
    await saveDocumentVerdict(user.id, kind, verdict);
    return NextResponse.json({ verdict });
  } catch (error) {
    if (error instanceof VerificationUnavailable)
      return NextResponse.json({ error: error.message }, { status: 503 });
    throw error;
  }
}
