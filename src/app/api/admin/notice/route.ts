import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { logAdmin } from '@/lib/admin-log';
import { parseNotice, saveNotice } from '@/lib/site-notice';

// 공지 저장(켜기·끄기·내용 바꾸기). 사이트에는 30초 안에 반영된다(공지 API 캐시).
export async function PUT(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 할 수 있어요.' }, { status: 403 });
  const parsed = parseNotice(await request.json().catch(() => ({})));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await saveNotice(parsed);
  await logAdmin(
    admin,
    'notice',
    { type: 'notice', label: parsed.on ? '공지 켬' : '공지 끔' },
    parsed.text,
  );
  return NextResponse.json({ ok: true, notice: parsed });
}
