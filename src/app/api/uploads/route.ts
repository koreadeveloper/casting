import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveUpload } from '@/lib/storage';

// 서버리스 요청 크기 제한(4.5MB)보다 작게 둔다. 사진은 브라우저에서 줄여서 올린다.
const MAX_BYTES = 4 * 1024 * 1024;

function detectImage(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'png';
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'webp';
  if (String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') return 'pdf';
  return null;
}

export async function POST(request: NextRequest) {
  if (!(await getSession()))
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: '파일을 선택해 주세요.' }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: '파일은 4MB 이하만 올릴 수 있습니다.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImage(bytes);
  if (!ext)
    return NextResponse.json(
      { error: 'JPG, PNG, WEBP 사진 또는 PDF만 올릴 수 있습니다.' },
      { status: 415 },
    );
  const name = `${randomUUID()}.${ext}`;
  await saveUpload(
    name,
    bytes,
    ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  );
  return NextResponse.json({ url: `/api/uploads/${name}` }, { status: 201 });
}
