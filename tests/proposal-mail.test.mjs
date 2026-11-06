import assert from 'node:assert/strict';
import test from 'node:test';
import { proposalMail } from '../src/lib/proposal-mail.ts';

test('출연 제안 메일에 작품·배역·메시지·확인 주소가 들어간다', () => {
  const mail = proposalMail(
    {
      actorName: '김배우',
      producerName: '이감독',
      orgName: '세종영화',
      projectTitle: '등골',
      roleTitle: '주연',
      message: '함께해 주세요',
    },
    'https://example.com',
  );
  assert.match(mail.subject, /등골 '주연' 출연 제안/);
  assert.match(mail.text, /세종영화 이감독에서 출연 제안/);
  assert.match(mail.text, /함께해 주세요/);
  assert.match(mail.text, /https:\/\/example\.com\/me/);
});
