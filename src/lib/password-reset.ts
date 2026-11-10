// 비밀번호 재설정 링크와 이메일 가입 인증번호의 저장·확인. 서버에서만 쓴다. 규칙은 password-reset-rules.ts.

import { getUserByEmail, getUserById } from './accounts';
import { db } from './db';
import { hashPassword } from './password';
import {
  CODE_MAX_ATTEMPTS,
  CODE_TTL_MS,
  hashSignupCode,
  hashToken,
  newResetToken,
  newSignupCode,
  RESET_TTL_MS,
  resetUsable,
} from './password-reset-rules';
import { transaction } from './sql';

type ResetRow = { token_hash: string; user_id: string; expires_at: string; used_at: string | null };

const secret = () => process.env.SESSION_SECRET || '';

/** 이메일로 회원을 찾아 재설정 토큰을 만든다. 회원이 없으면 null(화면에는 똑같이 안내한다). */
export async function createPasswordReset(email: string) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const token = newResetToken();
  const now = new Date();
  // 하루 넘게 지난 기록은 정리한다.
  await db()
    .prepare('DELETE FROM password_resets WHERE expires_at < ?')
    .run(new Date(now.getTime() - 24 * 3600 * 1000).toISOString());
  await db()
    .prepare(
      'INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)',
    )
    .run(
      hashToken(token),
      user.id,
      new Date(now.getTime() + RESET_TTL_MS).toISOString(),
      now.toISOString(),
    );
  return { token, user };
}

async function resetRow(tokenHash: string) {
  return ((await db()
    .prepare(
      'SELECT token_hash, user_id, expires_at, used_at FROM password_resets WHERE token_hash=?',
    )
    .get(tokenHash)) ?? null) as ResetRow | null;
}

/** 링크의 토큰(원문)이 아직 쓸 수 있으면 그 해시. 확인만 하고 쓰지는 않는다(메일 미리보기가 링크를 열어도 안전). */
export async function checkResetToken(token: string) {
  const tokenHash = hashToken(token);
  return resetUsable(await resetRow(tokenHash), new Date()) ? tokenHash : null;
}

/** 복구 쿠키에 든 해시가 아직 쓸 수 있는지 */
export async function resetStillUsable(tokenHash: string) {
  return resetUsable(await resetRow(tokenHash), new Date());
}

/**
 * 새 비밀번호로 바꾼다. 토큰을 쓴 것으로 표시하고(한 번만), 세션 버전을 올려 다른 기기의 로그인을 끊는다.
 * 링크로 메일 주인임을 확인했으니 email_verified도 켠다. 쓸 수 없는 토큰이면 null.
 */
export async function completePasswordReset(tokenHash: string, newPassword: string) {
  const userId = await transaction(async () => {
    const now = new Date().toISOString();
    const used = await db()
      .prepare(
        'UPDATE password_resets SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at > ?',
      )
      .run(now, tokenHash, now);
    if (used.changes !== 1) return null;
    const row = (await resetRow(tokenHash))!;
    await db()
      .prepare(
        'UPDATE users SET password_hash=?, session_version=session_version+1, email_verified=1 WHERE id=?',
      )
      .run(hashPassword(newPassword), row.user_id);
    // 같은 회원에게 남은 다른 재설정 링크도 못 쓰게 한다.
    await db()
      .prepare('UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL')
      .run(now, row.user_id);
    return row.user_id;
  });
  return userId ? await getUserById(userId) : null;
}

/** 가입 인증번호를 만들어 저장하고 원문을 돌려준다(같은 이메일의 이전 번호는 바뀐다). */
export async function createSignupCode(email: string) {
  const code = newSignupCode();
  const now = new Date();
  await db()
    .prepare(
      `INSERT INTO email_codes (email, code_hash, expires_at, attempts, created_at) VALUES (?,?,?,0,?)
       ON CONFLICT (email) DO UPDATE SET code_hash=EXCLUDED.code_hash, expires_at=EXCLUDED.expires_at,
         attempts=0, created_at=EXCLUDED.created_at`,
    )
    .run(
      email.toLowerCase(),
      hashSignupCode(email, code, secret()),
      new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      now.toISOString(),
    );
  return code;
}

/** 인증번호 확인. 맞으면 지운다(한 번만). 틀리면 횟수를 늘리고, 너무 많이 틀리면 번호를 없앤다. */
export async function consumeSignupCode(email: string, code: string) {
  const key = email.toLowerCase();
  const row = (await db()
    .prepare('SELECT code_hash, expires_at, attempts FROM email_codes WHERE email=?')
    .get(key)) as { code_hash: string; expires_at: string; attempts: number } | undefined;
  if (!row || row.expires_at <= new Date().toISOString() || row.attempts >= CODE_MAX_ATTEMPTS)
    return 'expired' as const;
  if (row.code_hash !== hashSignupCode(key, code, secret())) {
    await db().prepare('UPDATE email_codes SET attempts=attempts+1 WHERE email=?').run(key);
    return 'wrong' as const;
  }
  await db().prepare('DELETE FROM email_codes WHERE email=?').run(key);
  return 'ok' as const;
}
