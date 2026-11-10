// 관리자 회원 관리(/admin/members)의 서버 쪽 조회·변경. 화면과 API 모두 getAdmin()으로 먼저 권한을 확인한다.

import { db } from './db';
import { getCurrentUser } from './auth';
import { getUserById, type User } from './accounts';
import { hasPassword } from './password';
import { getProducerBadges } from './verifications';
import { isAdminAccount, loginMethods, type LoginMethod } from './admin-rules';

/** 지금 로그인한 관리자. 관리자가 아니면 null. */
export async function getAdmin(): Promise<User | null> {
  const user = await getCurrentUser();
  return user && isAdminAccount(user) ? user : null;
}

export type SocialLink = { provider: string; email: string; createdAt: string };

export type Member = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'producer' | 'actor';
  orgType: string;
  orgName: string;
  createdAt: string;
  emailVerified: boolean;
  suspendedAt: string | null;
  hasPassword: boolean;
  methods: LoginMethod[];
  socials: SocialLink[];
  /** 제작진 인증(학교·제작사) 중 지금 유효한 것 */
  badges: { kind: 'school' | 'business'; label: string }[];
  demo: boolean;
  admin: boolean;
};

const str = (value: unknown) => String(value ?? '');

export async function listMembers(): Promise<Member[]> {
  // 비밀번호 해시는 화면으로 보내지 않는다. 있는지만 본다.
  const users = (await db()
    .prepare(
      `SELECT id, email, name, phone, role, org_type, org_name, created_at, email_verified,
              suspended_at, password_hash FROM users ORDER BY created_at DESC`,
    )
    .all()) as Record<string, unknown>[];
  const links = (await db()
    .prepare('SELECT user_id, provider, email, created_at FROM oauth_accounts ORDER BY created_at')
    .all()) as Record<string, unknown>[];
  const socialsByUser = new Map<string, SocialLink[]>();
  for (const link of links) {
    const list = socialsByUser.get(str(link.user_id)) ?? [];
    list.push({
      provider: str(link.provider),
      email: str(link.email),
      createdAt: str(link.created_at),
    });
    socialsByUser.set(str(link.user_id), list);
  }
  const badges = await getProducerBadges(
    users.filter((row) => row.role === 'producer').map((row) => str(row.id)),
  );
  return users.map((row) => {
    const id = str(row.id);
    const socials = socialsByUser.get(id) ?? [];
    const password = hasPassword(str(row.password_hash));
    const badge = badges.get(id);
    const email = str(row.email);
    const emailVerified = Number(row.email_verified ?? 0) === 1;
    const suspendedAt = row.suspended_at ? str(row.suspended_at) : null;
    return {
      id,
      email,
      name: str(row.name),
      phone: str(row.phone),
      role: row.role === 'producer' ? 'producer' : 'actor',
      orgType: str(row.org_type),
      orgName: str(row.org_name),
      createdAt: str(row.created_at),
      emailVerified,
      suspendedAt,
      hasPassword: password,
      methods: loginMethods(
        password,
        socials.map((social) => social.provider),
      ),
      socials,
      badges: [
        ...(badge?.school
          ? [{ kind: 'school' as const, label: `학교 · ${badge.school.name}` }]
          : []),
        ...(badge?.business
          ? [{ kind: 'business' as const, label: `제작사 · ${badge.business.name}` }]
          : []),
      ],
      demo: email.endsWith('@demo.casting'),
      admin: isAdminAccount({ email, emailVerified, suspendedAt }),
    };
  });
}

/** 정지하거나 풀기. 정지하면 세션 버전도 올려서, 풀어 준 뒤에도 예전 로그인은 되살아나지 않는다. */
export async function setSuspended(userId: string, suspended: boolean) {
  if (suspended)
    await db()
      .prepare('UPDATE users SET suspended_at=?, session_version=session_version+1 WHERE id=?')
      .run(new Date().toISOString(), userId);
  else await db().prepare('UPDATE users SET suspended_at=NULL WHERE id=?').run(userId);
  return await getUserById(userId);
}

/** 소셜 계정 연결 하나를 끊는다. 끊은 연결 수를 돌려준다. */
export async function unlinkSocial(userId: string, provider: string) {
  const result = await db()
    .prepare('DELETE FROM oauth_accounts WHERE user_id=? AND provider=?')
    .run(userId, provider);
  return result.changes;
}
