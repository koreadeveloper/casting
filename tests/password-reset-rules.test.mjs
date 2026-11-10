import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashSignupCode,
  hashToken,
  isTokenShape,
  newPasswordProblem,
  newResetToken,
  newSignupCode,
  recoveryNext,
  resetLink,
  resetUsable,
} from '../src/lib/password-reset-rules.ts';

test('재설정 토큰: 32바이트 무작위, DB에는 해시만', () => {
  const token = newResetToken();
  assert.equal(isTokenShape(token), true);
  assert.notEqual(newResetToken(), token);
  assert.match(hashToken(token), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(token), token);
  assert.equal(isTokenShape('short'), false);
  assert.equal(isTokenShape(`${token}"><script>`), false);
});

test('재설정 링크는 /auth/confirm을 거쳐 /reset-password로만 간다', () => {
  const link = resetLink('https://example.com/', 'abc');
  assert.equal(
    link,
    'https://example.com/auth/confirm?token=abc&type=recovery&next=/reset-password',
  );
  assert.equal(recoveryNext('/reset-password'), '/reset-password');
  assert.equal(recoveryNext('https://evil.com'), '/reset-password');
  assert.equal(recoveryNext('/studio'), '/reset-password');
});

test('만료됐거나 이미 쓴 링크는 쓸 수 없다', () => {
  const now = new Date('2026-11-10T00:00:00.000Z');
  assert.equal(resetUsable({ expires_at: '2026-11-10T00:10:00.000Z', used_at: null }, now), true);
  assert.equal(resetUsable({ expires_at: '2026-11-09T23:59:00.000Z', used_at: null }, now), false);
  assert.equal(
    resetUsable(
      { expires_at: '2026-11-10T00:10:00.000Z', used_at: '2026-11-10T00:01:00.000Z' },
      now,
    ),
    false,
  );
  assert.equal(resetUsable(null, now), false);
});

test('새 비밀번호: 8자 이상·영문과 숫자·확인 입력 일치', () => {
  assert.ok(newPasswordProblem('short1', 'short1'));
  assert.ok(newPasswordProblem('letters123', 'letters124'));
  assert.equal(newPasswordProblem('letters123', 'letters123'), '');
  assert.ok(newPasswordProblem(undefined, undefined));
});

test('가입 인증번호: 6자리, 해시는 이메일·비밀값에 따라 달라진다', () => {
  assert.match(newSignupCode(), /^\d{6}$/);
  const a = hashSignupCode('A@x.com', '123456', 's'.repeat(32));
  assert.equal(a, hashSignupCode('a@x.com', '123456', 's'.repeat(32)));
  assert.notEqual(a, hashSignupCode('b@x.com', '123456', 's'.repeat(32)));
  assert.notEqual(a, hashSignupCode('a@x.com', '123456', 't'.repeat(32)));
});
