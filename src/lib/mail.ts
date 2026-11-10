// 메일 발송. Resend 또는 Gmail(SMTP) 중 설정된 쪽으로 보낸다(lib/mail-config.ts).
// 아무것도 없으면(로컬 개발) 서버 로그에 남긴다.

import nodemailer from 'nodemailer';
import { mailTransport } from './mail-config';

type Mail = { to: string; subject: string; text: string };

export function mailConfigured() {
  return mailTransport() !== null;
}

/** 메일을 실제로 보낼 수 있는지. 로컬 개발에서는 서버 로그로 대신하므로 열어 둔다. */
export function mailAvailable() {
  return mailConfigured() || process.env.NODE_ENV !== 'production';
}

export async function sendMail(mail: Mail) {
  const transport = mailTransport();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') throw new Error('메일 발송이 설정되지 않았습니다.');
    console.info(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return;
  }
  if (transport.kind === 'smtp') {
    const smtp = nodemailer.createTransport({
      host: transport.host,
      port: transport.port,
      secure: transport.port === 465,
      auth: { user: transport.user, pass: transport.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await smtp.sendMail({
      from: transport.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: transport.from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
  });
  if (!response.ok) throw new Error(`메일 발송 실패 (${response.status})`);
}
