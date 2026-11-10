// 비밀번호 재설정·이메일 가입 인증의 규칙과 메일 문구. DB·Next에 기대지 않아 테스트로 지킨다.
// 토큰·인증번호 원문은 메일로만 보내고, DB에는 해시만 둔다(lib/password-reset.ts).

import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { passwordProblem } from './password.ts';

/** 재설정 링크 유효 시간 */
export const RESET_TTL_MS = 30 * 60 * 1000;
/** 재설정 링크를 연 뒤 새 비밀번호를 넣을 수 있는 시간(복구 쿠키) */
export const RECOVERY_TTL_MS = 15 * 60 * 1000;
/** 가입 인증번호 유효 시간과 틀릴 수 있는 횟수 */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
/** 같은 이메일로 다시 보내기까지 기다리는 시간(화면 버튼과 서버 모두) */
export const RESEND_COOLDOWN_SECONDS = 60;

export const RECOVERY_COOKIE = 'cs_recovery';

/** 계정이 있는지와 상관없이 항상 같은 안내(계정 존재 여부를 드러내지 않는다) */
export const RESET_SENT_MESSAGE = '메일을 보냈어요. 메일함을 확인해 주세요.';
export const RESET_EXPIRED_MESSAGE = '링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.';
export const CODE_SENT_MESSAGE = '인증번호를 보냈어요. 메일함을 확인해 주세요.';

export function newResetToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** 링크로 받은 토큰 형식이 맞는지(32바이트 base64url = 43글자) */
export function isTokenShape(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function newSignupCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** 인증번호 해시. 6자리라 경우의 수가 적어서 서버 비밀값을 섞는다. */
export function hashSignupCode(email: string, code: string, secret: string) {
  return createHmac('sha256', secret).update(`${email.toLowerCase()}:${code}`).digest('hex');
}

/** 메일에 넣는 재설정 링크. /auth/confirm이 확인한 뒤 /reset-password로 보낸다. */
export function resetLink(origin: string, token: string) {
  return `${origin.replace(/\/+$/, '')}/auth/confirm?token=${encodeURIComponent(token)}&type=recovery&next=/reset-password`;
}

/** /auth/confirm 뒤에 갈 곳. 재설정 화면만 허용한다(열린 리디렉션 방지). */
export function recoveryNext(next: unknown) {
  return next === '/reset-password' ? next : '/reset-password';
}

/** 재설정 기록이 아직 쓸 수 있는지 */
export function resetUsable(row: { expires_at: string; used_at: string | null } | null, now: Date) {
  return Boolean(row && !row.used_at && row.expires_at > now.toISOString());
}

/** 새 비밀번호와 확인 입력 검사. 문제가 없으면 빈 문자열 */
export function newPasswordProblem(password: unknown, confirm: unknown) {
  const value = typeof password === 'string' ? password : '';
  const problem = passwordProblem(value);
  if (problem) return problem;
  if (value !== confirm) return '새 비밀번호와 확인 입력이 서로 달라요.';
  return '';
}

export function resetMail(link: string) {
  return {
    subject: '[캐스팅플로우] 비밀번호 재설정 링크',
    text: [
      '안녕하세요, 캐스팅플로우입니다.',
      '',
      '비밀번호 재설정을 요청하셨어요. 아래 링크를 눌러 새 비밀번호를 정해 주세요.',
      link,
      '',
      '· 링크는 30분 동안, 한 번만 쓸 수 있어요.',
      '· 비밀번호를 바꾸면 다른 기기에서는 자동으로 로그아웃돼요.',
      '· 요청하지 않으셨다면 이 메일은 무시해 주세요. 비밀번호는 바뀌지 않아요.',
    ].join('\n'),
  };
}

export function signupCodeMail(code: string) {
  return {
    subject: `[캐스팅플로우] 이메일 인증번호 ${code}`,
    text: [
      '안녕하세요, 캐스팅플로우입니다.',
      '',
      `회원가입 인증번호: ${code}`,
      '',
      '가입 화면에 이 번호를 입력해 주세요. 10분 동안 쓸 수 있어요.',
      '요청하지 않으셨다면 이 메일은 무시해 주세요.',
    ].join('\n'),
  };
}

/** 이미 가입된 이메일로 가입 인증을 요청했을 때(가입 여부를 화면에 드러내지 않고 메일로만 알린다) */
export function alreadyRegisteredMail(origin: string) {
  const base = origin.replace(/\/+$/, '');
  return {
    subject: '[캐스팅플로우] 이미 가입된 이메일이에요',
    text: [
      '안녕하세요, 캐스팅플로우입니다.',
      '',
      '이 이메일로 회원가입을 시도하셨는데, 이미 가입된 계정이 있어요.',
      `로그인: ${base}/login`,
      `비밀번호를 잊으셨다면: ${base}/forgot-password`,
      '',
      '요청하지 않으셨다면 이 메일은 무시해 주세요.',
    ].join('\n'),
  };
}
