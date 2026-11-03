// 메일 발송. RESEND_API_KEY가 있으면 Resend로 보내고, 없으면(로컬 개발) 서버 로그에 남긴다.

type Mail = { to: string; subject: string; text: string };

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/** 메일을 실제로 보낼 수 있는지. 로컬 개발에서는 서버 로그로 대신하므로 열어 둔다. */
export function mailAvailable() {
  return mailConfigured() || process.env.NODE_ENV !== 'production';
}

export async function sendMail(mail: Mail) {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('메일 발송이 설정되지 않았습니다.');
    console.info(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
  });
  if (!response.ok) throw new Error(`메일 발송 실패 (${response.status})`);
}
