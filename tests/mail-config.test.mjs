import assert from 'node:assert/strict';
import test from 'node:test';
import { hasMailTransport, mailTransport } from '../src/lib/mail-config.ts';

test('메일 설정이 없으면 보낼 수 없다', () => {
  assert.equal(mailTransport({}), null);
  assert.equal(hasMailTransport({ GMAIL_USER: 'team@gmail.com' }), false);
});

test('도메인 없이 Gmail 앱 비밀번호로 보낸다(공백은 빼고, 보내는 사람은 그 계정)', () => {
  const t = mailTransport({
    GMAIL_USER: 'team@gmail.com',
    GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
  });
  assert.deepEqual(t, {
    kind: 'smtp',
    host: 'smtp.gmail.com',
    port: 465,
    user: 'team@gmail.com',
    pass: 'abcdefghijklmnop',
    from: '캐스팅플로우 <team@gmail.com>',
  });
});

test('Resend가 설정되어 있으면 Resend를 먼저 쓴다', () => {
  const t = mailTransport({
    RESEND_API_KEY: 'k',
    MAIL_FROM: '캐스팅플로우 <noreply@x.kr>',
    GMAIL_USER: 'team@gmail.com',
    GMAIL_APP_PASSWORD: 'p',
  });
  assert.equal(t?.kind, 'resend');
});
