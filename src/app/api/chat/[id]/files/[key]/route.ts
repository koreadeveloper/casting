import { NextRequest, NextResponse } from 'next/server';
import { chatParticipant } from '@/lib/chat-access';
import {
  CHAT_FILE_KEY,
  chatFileContentType,
  opensInline,
  type ChatFileExt,
} from '@/lib/chat-files';
import { findChatAttachment } from '@/lib/db';
import { readUpload } from '@/lib/storage';

/** 대화에 올라온 파일을 연다. 그 대화의 제작자·배우만 열 수 있다. ?download=1이면 내려받기. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; key: string }> },
) {
  const { id, key } = await context.params;
  if (!CHAT_FILE_KEY.test(key)) return new NextResponse('Not found', { status: 404 });
  if (!(await chatParticipant(request, id)))
    return new NextResponse('Unauthorized', { status: 401 });
  const attachment = await findChatAttachment(id, key);
  if (!attachment) return new NextResponse('Not found', { status: 404 });
  const body = await readUpload(key).catch(() => null);
  if (!body) return new NextResponse('Not found', { status: 404 });
  const ext = attachment.ext as ChatFileExt;
  const inline = opensInline(ext) && request.nextUrl.searchParams.get('download') !== '1';
  const fallback = `file.${ext}`;
  return new NextResponse(body, {
    headers: {
      'Content-Type': chatFileContentType(ext),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
