import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { INQUIRY_KEEP_DAYS, INQUIRY_KINDS, parseInquiry } from '@/lib/inquiry';
import { LEGAL } from '@/lib/legal';
import { mailConfigured, sendMail } from '@/lib/mail';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';

/**
 * 문의 접수. 가입하지 않아도 보낼 수 있다.
 * 먼저 DB에 저장하고(메일이 실패해도 문의가 사라지지 않게), 메일이 설정돼 있으면 팀 문의 메일로도 보낸다.
 */
export async function POST(request: NextRequest) {
  if (await overLimit(`inquiry-ip:${clientIp(request.headers)}`, 5, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const parsed = parseInquiry(await request.json().catch(() => ({})));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const now = new Date();
  const expired = new Date(now.getTime() - INQUIRY_KEEP_DAYS * 24 * 3600 * 1000).toISOString();
  await db().prepare('DELETE FROM inquiries WHERE created_at < ?').run(expired);
  await db()
    .prepare('INSERT INTO inquiries (id, kind, email, body, link, created_at) VALUES (?,?,?,?,?,?)')
    .run(randomUUID(), parsed.kind, parsed.email, parsed.body, parsed.link, now.toISOString());

  if (mailConfigured() && LEGAL.contact.includes('@')) {
    const link = parsed.link.startsWith('/')
      ? `${process.env.APP_URL || request.nextUrl.origin}${parsed.link}`
      : parsed.link;
    try {
      await sendMail({
        to: LEGAL.contact,
        subject: `[캐스팅플로우 문의] ${INQUIRY_KINDS[parsed.kind]}`,
        text: `보낸 사람: ${parsed.email}\n종류: ${INQUIRY_KINDS[parsed.kind]}\n${link ? `관련 링크: ${link}\n` : ''}\n${parsed.body}`,
      });
    } catch (error) {
      // 문의는 이미 저장됐으므로 보낸 사람에게는 접수 완료로 알린다.
      console.error('문의 알림 메일 발송 실패', error);
    }
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
