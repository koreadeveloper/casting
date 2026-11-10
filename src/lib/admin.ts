// 관리자 회원 관리(/admin/members)의 서버 쪽 조회·변경. 화면과 API 모두 getAdmin()으로 먼저 권한을 확인한다.

import { notFound, redirect } from 'next/navigation';
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

/**
 * 관리자 화면의 공통 문지기. 로그인하지 않았으면 로그인으로 보내고(돌아올 주소를 붙여),
 * 관리자가 아니면 화면이 없는 것처럼 404를 낸다.
 */
export async function requireAdmin(path: string): Promise<User> {
  if (!(await getCurrentUser())) redirect(`/login?next=${encodeURIComponent(path)}`);
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}

/** 지금 역할로 만든 자료 수. 자료가 있으면 역할을 바꾸지 않는다(바꾸면 그 자료를 볼 화면이 없어져서). */
export async function roleDataCounts(userId: string, role: 'producer' | 'actor') {
  const count = async (sql: string) =>
    Number(((await db().prepare(sql).get(userId)) as { n?: number } | undefined)?.n ?? 0);
  if (role === 'producer')
    return {
      프로젝트: await count('SELECT count(*)::int AS n FROM projects WHERE owner_id=?'),
      공고: await count('SELECT count(*)::int AS n FROM roles WHERE owner_id=?'),
      '보낸 제안': await count('SELECT count(*)::int AS n FROM proposals WHERE producer_id=?'),
      '팀 참여': await count('SELECT count(*)::int AS n FROM team_members WHERE user_id=?'),
    };
  return {
    지원서: await count('SELECT count(*)::int AS n FROM applications WHERE actor_id=?'),
    '받은 제안': await count('SELECT count(*)::int AS n FROM proposals WHERE actor_id=?'),
  };
}

/**
 * 역할 바꾸기(배우 ↔ 제작진). 지금 역할로 만든 자료가 있으면 바꾸지 않고 그 목록을 돌려준다.
 * 바꾸면 세션 버전을 올려 다시 로그인하게 한다(세션에 역할이 들어 있어서).
 */
export async function changeRole(userId: string, role: 'producer' | 'actor') {
  const user = await getUserById(userId);
  if (!user) return { ok: false as const, blockers: [] as string[] };
  if (user.role === role) return { ok: true as const };
  const counts = await roleDataCounts(userId, user.role);
  const blockers = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label} ${n}건`);
  if (blockers.length) return { ok: false as const, blockers };
  await db()
    .prepare('UPDATE users SET role=?, session_version=session_version+1 WHERE id=?')
    .run(role, userId);
  if (role === 'actor')
    await db()
      .prepare(
        'INSERT INTO actor_profiles (user_id,updated_at) VALUES (?,?) ON CONFLICT (user_id) DO NOTHING',
      )
      .run(userId, new Date().toISOString());
  return { ok: true as const };
}

export type MemberDetail = {
  member: Member;
  profile: {
    isPublic: boolean;
    photos: string[];
    intro: string;
    region: string;
    birthYear: number | null;
    height: number | null;
    tags: string[];
    skills: string[];
    filmography: { year: string; title: string; role: string }[];
  } | null;
  projects: {
    id: string;
    title: string;
    archived: boolean;
    createdAt: string;
    roles: {
      id: string;
      slug: string;
      title: string;
      closed: boolean;
      hidden: boolean;
      applicants: number;
    }[];
  }[];
  applications: {
    id: string;
    projectTitle: string;
    roleTitle: string;
    stage: string;
    status: string;
    createdAt: string;
  }[];
  proposals: {
    id: string;
    direction: 'sent' | 'received';
    other: string;
    roleTitle: string;
    status: string;
    createdAt: string;
  }[];
  verifications: {
    kind: string;
    method: string;
    status: string;
    orgName: string;
    detail: string;
    reason: string;
    createdAt: string;
    expiresAt: string | null;
  }[];
};

const list = <T>(value: unknown): T[] => {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** 회원 상세(/admin/members/[id])에 보여 줄 것 전부 */
export async function memberDetail(userId: string): Promise<MemberDetail | null> {
  const member = (await listMembers()).find((m) => m.id === userId);
  if (!member) return null;
  const all = (sql: string, ...params: unknown[]) =>
    db()
      .prepare(sql)
      .all(...params) as Promise<Record<string, unknown>[]>;

  const profileRow = (await all('SELECT * FROM actor_profiles WHERE user_id=?', userId))[0];
  const projectRows = await all(
    'SELECT id, title, archived_at, created_at FROM projects WHERE owner_id=? ORDER BY created_at DESC',
    userId,
  );
  const roleRows = await all(
    `SELECT r.id, r.slug, r.title, r.project_id, r.is_closed, r.admin_hidden_at,
            (SELECT count(*)::int FROM applications a WHERE a.role_id=r.id) AS applicants
     FROM roles r WHERE r.owner_id=? ORDER BY r.created_at DESC`,
    userId,
  );
  const appRows = await all(
    `SELECT a.id, a.public_stage, a.status, a.created_at, r.title AS role_title,
            COALESCE(p.title, r.project_title) AS project_title
     FROM applications a JOIN roles r ON r.id=a.role_id LEFT JOIN projects p ON p.id=r.project_id
     WHERE a.actor_id=? ORDER BY a.created_at DESC`,
    userId,
  );
  const proposalRows = await all(
    `SELECT pr.id, pr.status, pr.created_at, pr.producer_id, r.title AS role_title,
            pu.name AS producer_name, au.name AS actor_name
     FROM proposals pr JOIN roles r ON r.id=pr.role_id
     JOIN users pu ON pu.id=pr.producer_id JOIN users au ON au.id=pr.actor_id
     WHERE pr.producer_id=? OR pr.actor_id=? ORDER BY pr.created_at DESC`,
    userId,
    userId,
  );
  const verificationRows = await all(
    'SELECT * FROM verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20',
    userId,
  );
  const s = (value: unknown) => String(value ?? '');
  return {
    member,
    profile: profileRow
      ? {
          isPublic: Boolean(profileRow.is_public),
          photos: list<string>(profileRow.photos),
          intro: s(profileRow.intro),
          region: s(profileRow.region),
          birthYear: profileRow.birth_year == null ? null : Number(profileRow.birth_year),
          height: profileRow.height == null ? null : Number(profileRow.height),
          tags: list<string>(profileRow.tags),
          skills: list<string>(profileRow.skills),
          filmography: list<{ year: string; title: string; role: string }>(profileRow.filmography),
        }
      : null,
    projects: projectRows.map((p) => ({
      id: s(p.id),
      title: s(p.title),
      archived: Boolean(p.archived_at),
      createdAt: s(p.created_at),
      roles: roleRows
        .filter((r) => r.project_id === p.id)
        .map((r) => ({
          id: s(r.id),
          slug: s(r.slug),
          title: s(r.title),
          closed: Number(r.is_closed) === 1,
          hidden: Boolean(r.admin_hidden_at),
          applicants: Number(r.applicants ?? 0),
        })),
    })),
    applications: appRows.map((a) => ({
      id: s(a.id),
      projectTitle: s(a.project_title),
      roleTitle: s(a.role_title),
      stage: s(a.public_stage),
      status: s(a.status),
      createdAt: s(a.created_at),
    })),
    proposals: proposalRows.map((p) => {
      const sent = p.producer_id === userId;
      return {
        id: s(p.id),
        direction: sent ? ('sent' as const) : ('received' as const),
        other: s(sent ? p.actor_name : p.producer_name),
        roleTitle: s(p.role_title),
        status: s(p.status),
        createdAt: s(p.created_at),
      };
    }),
    verifications: verificationRows.map((v) => ({
      kind: s(v.kind),
      method: s(v.method),
      status: s(v.status),
      orgName: s(v.org_name),
      detail: s(v.detail),
      reason: s(v.reason),
      createdAt: s(v.created_at),
      expiresAt: v.expires_at ? s(v.expires_at) : null,
    })),
  };
}
