import { cookies } from 'next/headers';
import { getUserById } from './accounts';
import { createSessionToken, readSessionToken, type Session } from './session-token';

const COOKIE = 'cs_session';

function secret() {
  return process.env.SESSION_SECRET || '';
}

export function hasSetup() {
  return secret().length >= 24;
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const session = token ? readSessionToken(token, secret()) : null;
  if (!session) return null;
  const user = await getUserById(session.userId);
  // 비밀번호를 바꾸면 회원의 세션 버전이 올라가, 그 전에 만든 로그인(다른 기기)은 여기서 끊긴다.
  // 관리자가 정지한 계정은 이미 로그인해 있던 기기에서도 바로 끊긴다.
  return user && !user.suspendedAt && (session.version ?? 0) === user.sessionVersion
    ? session
    : null;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session ? await getUserById(session.userId) : null;
}

export async function getProducerId() {
  const session = await getSession();
  return session?.role === 'producer' ? session.userId : null;
}

export async function getActorId() {
  const session = await getSession();
  return session?.role === 'actor' ? session.userId : null;
}

export async function startSession(session: Session) {
  const user = await getUserById(session.userId);
  const version = session.version ?? user?.sessionVersion ?? 0;
  (await cookies()).set(COOKIE, createSessionToken({ ...session, version }, secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export function homeFor(role: Session['role']) {
  return role === 'producer' ? '/studio' : '/me';
}
