import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 32;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * 이메일·비밀번호 가입·로그인·재설정을 열지.
 * 이메일 가입 인증번호와 재설정 링크를 메일로 보내야 해서, 운영에서는 메일 발송(Resend) 설정이 있을 때만 연다.
 * 체험 사이트(DEMO_MODE)는 공개된 체험 계정으로, 개발 중에는 테스트 계정으로 들어가야 해서 연다.
 */
export function passwordLoginEnabled(env: Record<string, string | undefined> = process.env) {
  return (
    env.NODE_ENV !== 'production' ||
    env.DEMO_MODE === 'true' ||
    Boolean(env.RESEND_API_KEY && env.MAIL_FROM)
  );
}

/** 비밀번호가 있는 계정인지. 소셜 로그인으로만 가입한 계정은 저장된 값이 빈 문자열이다. */
export function hasPassword(stored: string) {
  return stored.startsWith('scrypt$');
}

/**
 * 회원 탈퇴 전 본인 확인. 비밀번호가 있으면 비밀번호를, 소셜 로그인 계정이면
 * 비밀번호가 없으니 계정 이메일을 그대로 입력받아 확인한다.
 */
export function deletionConfirmed(
  input: { password?: unknown; email?: unknown },
  account: { email: string; passwordHash: string },
) {
  if (hasPassword(account.passwordHash))
    return verifyPassword(String(input.password || ''), account.passwordHash);
  const typed = String(input.email || '')
    .trim()
    .toLowerCase();
  return typed !== '' && typed === account.email.toLowerCase();
}

export function passwordProblem(password: string) {
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (password.length > 128) return '비밀번호가 너무 깁니다.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return '비밀번호에 영문과 숫자를 모두 넣어 주세요.';
  return '';
}
