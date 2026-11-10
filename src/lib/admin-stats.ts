// 관리자 대시보드(/admin) 숫자. 모두 지금 DB에서 바로 센다.

import { db, listOpenRoles } from './db';
import { countNewInquiries } from './admin-inquiries';

export const SIGNUP_DAYS = 14;

/** 한국 날짜(YYYY-MM-DD). 가입일을 '하루'로 묶을 때 쓴다. */
export function kstDay(iso: string | Date) {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 오늘을 포함한 최근 n일(한국 날짜, 오래된 순) */
export function recentDays(n: number, now = new Date()) {
  return Array.from({ length: n }, (_, i) =>
    kstDay(new Date(now.getTime() - (n - 1 - i) * 24 * 3600 * 1000)),
  );
}

const num = async (sql: string, ...params: unknown[]) =>
  Number(
    (
      (await db()
        .prepare(sql)
        .get(...params)) as { n?: number } | undefined
    )?.n ?? 0,
  );

export async function dashboardStats(now = new Date()) {
  const days = recentDays(SIGNUP_DAYS, now);
  const since = new Date(now.getTime() - SIGNUP_DAYS * 24 * 3600 * 1000).toISOString();
  const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const recent = (await db()
    .prepare(
      `SELECT u.created_at, u.role, EXISTS (SELECT 1 FROM oauth_accounts o WHERE o.user_id=u.id) AS social
       FROM users u WHERE u.created_at >= ?`,
    )
    .all(since)) as { created_at: string; role: string; social: boolean }[];
  const byDay = new Map(days.map((day) => [day, { actor: 0, producer: 0 }]));
  for (const row of recent) {
    const slot = byDay.get(kstDay(row.created_at));
    if (slot) slot[row.role === 'producer' ? 'producer' : 'actor']++;
  }
  const latest = (await db()
    .prepare(`SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 6`)
    .all()) as { id: string; name: string; email: string; role: string; created_at: string }[];

  return {
    members: {
      total: await num('SELECT count(*)::int AS n FROM users'),
      actors: await num(`SELECT count(*)::int AS n FROM users WHERE role='actor'`),
      producers: await num(`SELECT count(*)::int AS n FROM users WHERE role='producer'`),
      suspended: await num('SELECT count(*)::int AS n FROM users WHERE suspended_at IS NOT NULL'),
      google: await num('SELECT count(DISTINCT user_id)::int AS n FROM oauth_accounts'),
      lastWeek: await num('SELECT count(*)::int AS n FROM users WHERE created_at >= ?', week),
      verifiedProducers: await num(
        `SELECT count(DISTINCT user_id)::int AS n FROM verifications
         WHERE status='approved' AND (expires_at IS NULL OR expires_at > ?)`,
        now.toISOString(),
      ),
      publicProfiles: await num(
        `SELECT count(*)::int AS n FROM actor_profiles p JOIN users u ON u.id=p.user_id
         WHERE p.is_public=1 AND u.role='actor'`,
      ),
    },
    listings: {
      projects: await num('SELECT count(*)::int AS n FROM projects WHERE archived_at IS NULL'),
      // 배우 쪽 목록에 실제로 보이는 공고 수(테스트·파일럿 전·보관·내린 공고·기한 지난 공고 제외)
      openRoles: (await listOpenRoles(now.toISOString().slice(0, 10))).length,
      allRoles: await num('SELECT count(*)::int AS n FROM roles'),
      hiddenRoles: await num(
        'SELECT count(*)::int AS n FROM roles WHERE admin_hidden_at IS NOT NULL',
      ),
      applications: await num('SELECT count(*)::int AS n FROM applications'),
      applicationsWeek: await num(
        'SELECT count(*)::int AS n FROM applications WHERE created_at >= ?',
        week,
      ),
    },
    newInquiries: await countNewInquiries(),
    signups: days.map((day) => ({ day, ...byDay.get(day)! })),
    latest: latest.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role === 'producer' ? ('producer' as const) : ('actor' as const),
      createdAt: row.created_at,
    })),
  };
}
