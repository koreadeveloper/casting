// 메일을 어떤 방법으로 보낼지. DB·Next에 기대지 않아 테스트로 지킨다.
// - Resend: RESEND_API_KEY + MAIL_FROM (발신 도메인 인증이 필요하다)
// - Gmail: GMAIL_USER + GMAIL_APP_PASSWORD (도메인 없이, 팀 Gmail 계정의 '앱 비밀번호'로 SMTP 발송)
// 둘 다 있으면 Resend를 쓴다(도메인을 사면 환경변수만 넣으면 옮겨 간다).

type Env = Record<string, string | undefined>;

export type MailTransport =
  | { kind: 'resend'; from: string }
  | { kind: 'smtp'; host: string; port: number; user: string; pass: string; from: string }
  | null;

export function mailTransport(env: Env = process.env): MailTransport {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return { kind: 'resend', from: env.MAIL_FROM };
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    const user = env.GMAIL_USER.trim();
    const port = Number(env.SMTP_PORT || 465);
    return {
      kind: 'smtp',
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port,
      user,
      // 구글이 보여 주는 앱 비밀번호는 4자리씩 띄어 쓰여 있어 공백을 뺀다.
      pass: env.GMAIL_APP_PASSWORD.replace(/\s+/g, ''),
      // Gmail은 로그인한 계정 주소로만 보낼 수 있어서 보내는 사람 주소는 그 계정으로 고정한다.
      from: `${env.MAIL_FROM_NAME || '캐스팅플로우'} <${user}>`,
    };
  }
  return null;
}

/** 메일을 실제로 보낼 수 있는지 */
export function hasMailTransport(env: Env = process.env) {
  return mailTransport(env) !== null;
}
