import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { chatParticipant } from '@/lib/chat-access';
import {
  CHAT_FILE_MAX_BYTES,
  chatFileContentType,
  cleanFileName,
  detectChatFile,
} from '@/lib/chat-files';
import { sendChatMessage } from '@/lib/db';
import { saveUpload } from '@/lib/storage';
import { requiredText } from '@/lib/validation';

/** 파일 한 개를 (글과 함께) 대화에 보낸다. 본문은 multipart: file, body, receipt */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: '파일을 다시 선택해 주세요.' }, { status: 400 });
  const sender = await chatParticipant(request, id, requiredText(form.get('receipt'), 100));
  if (!sender) return NextResponse.json({ error: '대화를 보낼 수 없습니다.' }, { status: 403 });
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: '파일을 선택해 주세요.' }, { status: 400 });
  if (file.size > CHAT_FILE_MAX_BYTES)
    return NextResponse.json({ error: '파일은 4MB 이하만 보낼 수 있습니다.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectChatFile(bytes, file.name);
  if (!ext)
    return NextResponse.json(
      { error: '사진(JPG·PNG·WEBP), PDF, 한글·워드·엑셀·파워포인트 파일만 보낼 수 있습니다.' },
      { status: 415 },
    );
  const key = `${randomUUID()}.${ext}`;
  await saveUpload(key, bytes, chatFileContentType(ext));
  const message = await sendChatMessage(id, {
    sender,
    kind: 'text',
    body: requiredText(form.get('body'), 1500),
    slots: [],
    place: '',
    preparation: '',
    attachment: { key, name: cleanFileName(file.name, ext), size: file.size, ext },
  });
  return message
    ? NextResponse.json({ message }, { status: 201 })
    : NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
}
