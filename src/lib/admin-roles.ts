// 관리자 공고 관리(/admin/roles): 모든 공고를 보고, 문제 있는 공고를 내리거나 마감한다.

import { db } from './db';
import { isHiddenListing } from './test-listing';

export type AdminRole = {
  id: string;
  slug: string;
  title: string;
  projectTitle: string;
  ownerId: string | null;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  deadline: string;
  closed: boolean;
  /** 관리자가 내린 시각 */
  hiddenAt: string | null;
  /** 테스트 제목·파일럿 전 공고라 배우 쪽 목록에서 원래 숨겨진 공고 */
  testListing: boolean;
  archived: boolean;
  applicants: number;
  specialScenes: string[];
};

const str = (value: unknown) => String(value ?? '');

export async function listAllRoles(): Promise<AdminRole[]> {
  const rows = (await db()
    .prepare(
      `SELECT r.id, r.slug, r.title, r.created_at, r.deadline, r.is_closed, r.admin_hidden_at,
              r.special_scenes, r.owner_id,
              COALESCE(p.title, r.project_title) AS project_title, p.archived_at,
              u.name AS owner_name, u.email AS owner_email,
              (SELECT count(*)::int FROM applications a WHERE a.role_id=r.id) AS applicants
       FROM roles r LEFT JOIN projects p ON p.id=r.project_id LEFT JOIN users u ON u.id=r.owner_id
       ORDER BY r.created_at DESC`,
    )
    .all()) as Record<string, unknown>[];
  return rows.map((row) => {
    let scenes: string[] = [];
    try {
      const parsed = JSON.parse(str(row.special_scenes) || '[]');
      if (Array.isArray(parsed)) scenes = parsed.map(String);
    } catch {
      scenes = [];
    }
    return {
      id: str(row.id),
      slug: str(row.slug),
      title: str(row.title),
      projectTitle: str(row.project_title),
      ownerId: row.owner_id ? str(row.owner_id) : null,
      ownerName: str(row.owner_name),
      ownerEmail: str(row.owner_email),
      createdAt: str(row.created_at),
      deadline: str(row.deadline),
      closed: Number(row.is_closed) === 1,
      hiddenAt: row.admin_hidden_at ? str(row.admin_hidden_at) : null,
      testListing: isHiddenListing(str(row.project_title), str(row.created_at)),
      archived: Boolean(row.archived_at),
      applicants: Number(row.applicants ?? 0),
      specialScenes: scenes,
    };
  });
}

export async function getAdminRole(id: string) {
  return (await listAllRoles()).find((role) => role.id === id) ?? null;
}

export async function setRoleHidden(id: string, hidden: boolean) {
  await db()
    .prepare('UPDATE roles SET admin_hidden_at=? WHERE id=?')
    .run(hidden ? new Date().toISOString() : null, id);
}

export async function setRoleClosed(id: string, closed: boolean) {
  await db()
    .prepare('UPDATE roles SET is_closed=? WHERE id=?')
    .run(closed ? 1 : 0, id);
}
