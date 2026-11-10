import { createHmac, timingSafeEqual } from 'node:crypto';

export type UserRole = 'producer' | 'actor';
export type Session = {
  userId: string;
  role: UserRole;
  /**
   * 세션 버전. 비밀번호를 바꾸면 회원의 버전이 올라가 예전 버전으로 만든 로그인(다른 기기)이 모두 끊긴다.
   * 버전이 생기기 전에 만든 토큰은 0으로 본다.
   */
  version?: number;
};

const WEEK = 1000 * 60 * 60 * 24 * 7;

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function createSessionToken(session: Session, secret: string, now = Date.now()) {
  const payload = `${session.userId}.${session.role}.${session.version ?? 0}.${now + WEEK}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string, secret: string, now = Date.now()): Session | null {
  const parts = token.split('.');
  if ((parts.length !== 4 && parts.length !== 5) || secret.length < 24) return null;
  // 예전 형식: 아이디.역할.만료.서명 / 지금 형식: 아이디.역할.버전.만료.서명
  const [userId, role] = parts;
  const version = parts.length === 5 ? parts[2] : '0';
  const expires = parts.at(-2)!;
  const signature = parts.at(-1)!;
  if (role !== 'producer' && role !== 'actor') return null;
  if (!/^[\w-]{8,64}$/.test(userId) || !/^\d{1,9}$/.test(version) || Number(expires) < now)
    return null;
  const expected = Buffer.from(sign(parts.slice(0, -1).join('.'), secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { userId, role, version: Number(version) };
}
