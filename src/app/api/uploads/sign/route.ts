import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { overLimit, TOO_MANY } from '@/lib/rate-limit';
import { cleanupTemporaryUploads, createSignedUpload, directUploadAvailable } from '@/lib/storage';
import { PROFILE_PDF_MAX_BYTES, profilePdfTooLarge } from '@/lib/upload-limits';

/**
 * 프로필 PDF를 브라우저가 저장소로 바로 올릴 주소를 준다(20MB까지, 서버의 4.5MB 제한을 피한다).
 * purpose: document(자료실, 'UUID.pdf'로 남는다) | draft(자동 채우기, 'tmp/UUID.pdf'로 올려 읽은 뒤 지운다)
 * 저장소가 설정돼 있지 않으면 direct: false를 돌려주고, 화면은 예전처럼 서버로 올린다(4MB).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!directUploadAvailable()) return NextResponse.json({ direct: false });
  const body = await request.json().catch(() => ({}));
  const purpose =
    body.purpose === 'draft' ? 'draft' : body.purpose === 'document' ? 'document' : '';
  if (!purpose) return NextResponse.json({ error: '올리는 곳이 맞지 않아요.' }, { status: 400 });
  if (purpose === 'draft' && session.role !== 'actor')
    return NextResponse.json({ error: '배우 계정으로 로그인해 주세요.' }, { status: 401 });
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0)
    return NextResponse.json({ error: '파일을 선택해 주세요.' }, { status: 400 });
  if (size > PROFILE_PDF_MAX_BYTES)
    return NextResponse.json({ error: profilePdfTooLarge(size) }, { status: 413 });
  if (await overLimit(`upload-sign:${session.userId}`, 30, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const name = `${randomUUID()}.pdf`;
  const path = purpose === 'draft' ? `tmp/${name}` : name;
  if (purpose === 'draft') await cleanupTemporaryUploads();
  const uploadUrl = await createSignedUpload(path);
  return NextResponse.json(
    { direct: true, name, uploadUrl },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
