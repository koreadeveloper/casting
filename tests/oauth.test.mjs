import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorizeUrl,
  decideLink,
  normalizeProfile,
  openPayload,
  pkcePair,
  providerEnabled,
  safeNext,
  sealPayload,
} from '../src/lib/oauth.ts';
import { createHash } from 'node:crypto';

const SECRET = 'x'.repeat(32);

test('서명한 값은 되읽히고, 만료·변조·다른 키는 거절한다', () => {
  const token = sealPayload({ state: 'abc' }, SECRET, 1000, 10_000);
  assert.equal(openPayload(token, SECRET, 10_500).state, 'abc');
  assert.equal(openPayload(token, SECRET, 12_000), null);
  assert.equal(openPayload(token, 'y'.repeat(32), 10_500), null);
  const [body, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ state: 'evil', exp: 99_999_999 })).toString(
    'base64url',
  );
  assert.equal(openPayload(`${forged}.${sig}`, SECRET, 10_500), null);
  assert.equal(openPayload(`${body}.${sig}.x`, SECRET, 10_500), null);
  assert.equal(openPayload(undefined, SECRET), null);
  assert.equal(openPayload(token, 'short'), null);
});

test('PKCE challenge는 verifier의 SHA-256이다', () => {
  const { verifier, challenge } = pkcePair();
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
});

test('인가 주소에 state·PKCE·콜백 주소가 들어간다', () => {
  const url = new URL(
    authorizeUrl('google', {
      clientId: 'id',
      redirectUri: 'https://a.test/api/auth/google/callback',
      state: 'st',
      challenge: 'ch',
    }),
  );
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('state'), 'st');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://a.test/api/auth/google/callback');
  const kakao = new URL(
    authorizeUrl('kakao', {
      clientId: 'id',
      redirectUri: 'https://a.test/cb',
      state: 's',
      challenge: 'c',
    }),
  );
  assert.equal(kakao.origin, 'https://kauth.kakao.com');
});

test('구글: 이메일 확인 여부를 그대로 따른다', () => {
  const ok = normalizeProfile('google', {
    sub: '1',
    email: 'A@B.com',
    email_verified: true,
    name: '가나',
  });
  assert.deepEqual(ok, {
    provider: 'google',
    subject: '1',
    email: 'a@b.com',
    emailVerified: true,
    name: '가나',
  });
  assert.equal(
    normalizeProfile('google', { sub: '1', email: 'a@b.com', email_verified: false }).emailVerified,
    false,
  );
  assert.equal(normalizeProfile('google', { email: 'a@b.com' }), null);
});

test('카카오: 이메일이 없거나 확인 안 된 경우를 구분한다', () => {
  const none = normalizeProfile('kakao', {
    id: 123,
    kakao_account: { profile: { nickname: '길동' } },
  });
  assert.deepEqual(none, {
    provider: 'kakao',
    subject: '123',
    email: '',
    emailVerified: false,
    name: '길동',
  });
  const verified = normalizeProfile('kakao', {
    id: 5,
    kakao_account: {
      email: 'k@b.com',
      is_email_valid: true,
      is_email_verified: true,
      profile: { nickname: 'k' },
    },
  });
  assert.equal(verified.emailVerified, true);
  const unverified = normalizeProfile('kakao', {
    id: 5,
    kakao_account: { email: 'k@b.com', is_email_valid: true, is_email_verified: false },
  });
  assert.equal(unverified.emailVerified, false);
});

test('로그인 결정: 연결된 계정 > 이메일 중복(자동 합치기 없음) > 신규 가입', () => {
  assert.deepEqual(decideLink({ linkedUserId: 'u1', emailOwnerId: 'u2' }), {
    kind: 'login',
    userId: 'u1',
  });
  assert.deepEqual(decideLink({ linkedUserId: null, emailOwnerId: 'u2' }), { kind: 'email-taken' });
  assert.deepEqual(decideLink({ linkedUserId: null, emailOwnerId: null }), { kind: 'signup' });
});

test('돌아갈 경로는 같은 사이트 안으로만 제한한다', () => {
  assert.equal(safeNext('/studio'), '/studio');
  assert.equal(safeNext('//evil.com'), '');
  assert.equal(safeNext('https://evil.com'), '');
  assert.equal(safeNext('/api/auth'), '');
  assert.equal(safeNext(undefined), '');
});

test('키가 둘 다 있을 때만 제공자를 켠다', () => {
  assert.equal(
    providerEnabled('google', { GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b' }),
    true,
  );
  assert.equal(providerEnabled('google', { GOOGLE_CLIENT_ID: 'a' }), false);
  assert.equal(providerEnabled('kakao', {}), false);
});
