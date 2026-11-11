import { getSession } from '@/lib/auth';
import { readUpload, signedDownloadUrl } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export async function GET(_request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const match = /^([a-f0-9-]{36})\.(jpg|png|webp|pdf)$/.exec(name);
  if (!match) return new NextResponse('Not found', { status: 404 });
  // 사진은 공개 지원 화면에도 쓰이지만, PDF 자료(이력서·증명서)는 로그인한 사용자만 연다.
  if (match[2] === 'pdf' && !(await getSession()))
    return new NextResponse('Unauthorized', { status: 401 });
  try {
    // PDF는 20MB까지라 서버(응답 4.5MB 제한)를 거치지 않고 5분짜리 저장소 주소로 보낸다.
    // 저장소가 없으면(로컬 개발) 아래처럼 서버가 직접 보낸다.
    if (match[2] === 'pdf') {
      const signed = await signedDownloadUrl(name, 300);
      if (signed)
        return NextResponse.redirect(signed, {
          status: 307,
          headers: { 'Cache-Control': 'private, no-store' },
        });
    }
    const body = await readUpload(name);
    if (!body) return new NextResponse('Not found', { status: 404 });
    return new NextResponse(body, {
      headers: {
        'Content-Type': TYPES[match[2]],
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
