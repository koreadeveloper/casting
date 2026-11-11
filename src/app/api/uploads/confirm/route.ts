import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deleteStoredPaths, readStoredHead, storedFileInfo } from '@/lib/storage';
import { isStoredPdfName, PROFILE_PDF_MAX_BYTES, profilePdfTooLarge } from '@/lib/upload-limits';

/**
 * 자료실 PDF를 저장소에 바로 올린 뒤 부른다. 정말 PDF인지, 20MB 이하인지 확인하고 주소를 돌려준다.
 * 맞지 않으면 올라간 파일을 지운다.
 */
export async function POST(request: NextRequest) {
  if (!(await getSession()))
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '');
  if (!isStoredPdfName(name))
    return NextResponse.json({ error: '파일 이름이 맞지 않아요.' }, { status: 400 });
  const info = await storedFileInfo(name);
  if (!info)
    return NextResponse.json(
      { error: '올라간 파일을 찾지 못했어요. 다시 올려 주세요.' },
      { status: 404 },
    );
  if (info.size > PROFILE_PDF_MAX_BYTES) {
    await deleteStoredPaths([name]);
    return NextResponse.json({ error: profilePdfTooLarge(info.size) }, { status: 413 });
  }
  const bytes = await readStoredHead(name, 5);
  if (!bytes || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
    await deleteStoredPaths([name]);
    return NextResponse.json({ error: 'PDF 파일만 올릴 수 있어요.' }, { status: 415 });
  }
  return NextResponse.json({ url: `/api/uploads/${name}` });
}
