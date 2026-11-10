// 관리자 인증 확인함(/admin/verifications)의 조회·변경. 권한 확인은 부르는 쪽(getAdmin)에서 한다.
// 제작사 인증은 국세청 기록만 맞으면 바로 승인되므로(계정 이름과는 맞춰 보지 않음),
// 남의 사업자로 받은 인증이 없는지 관리자가 사후에 한 건씩 확인한다.

import { db } from './db';

export type AdminVerification = {
  id: string;
  userId: string;
  memberName: string;
  memberEmail: string;
  /** 가입할 때 적은 소속 유형 */
  orgType: string;
  /** 인증된 상호 */
  orgName: string;
  /** 사업자등록번호 앞 5자리(가림) */
  detail: string;
  method: 'nts' | 'document';
  createdAt: string;
  reviewedAt: string | null;
};

const str = (value: unknown) => String(value ?? '');

// 관리자가 직접 준 인증(method='admin')은 이미 관리자가 본 것이라 뺀다.
const BASE = `FROM verifications v JOIN users u ON u.id=v.user_id
  WHERE v.kind='business' AND v.status='approved' AND v.method IN ('nts','document')`;

/** 지금 유효한 제작사 인증. 확인 전인 것을 먼저, 그다음 최근 순. */
const SELECT = `SELECT v.*, u.name AS member_name, u.email AS member_email,
  u.org_type AS member_org_type ${BASE}`;

export async function listBusinessVerifications(): Promise<AdminVerification[]> {
  const rows = (await db()
    .prepare(`${SELECT} ORDER BY (v.reviewed_at IS NULL) DESC, v.created_at DESC LIMIT 300`)
    .all()) as Record<string, unknown>[];
  return rows.map(fromRow);
}

function fromRow(row: Record<string, unknown>): AdminVerification {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    memberName: str(row.member_name),
    memberEmail: str(row.member_email),
    orgType: str(row.member_org_type),
    orgName: str(row.org_name),
    detail: str(row.detail),
    method: row.method === 'document' ? 'document' : 'nts',
    createdAt: str(row.created_at),
    reviewedAt: row.reviewed_at ? str(row.reviewed_at) : null,
  };
}

/** 아직 확인하지 않은 제작사 인증 수(관리자 메뉴·대시보드의 숫자) */
export async function countUnreviewedBusiness() {
  const row = (await db()
    .prepare(`SELECT count(*)::int AS n ${BASE} AND v.reviewed_at IS NULL`)
    .get()) as { n?: number } | undefined;
  return Number(row?.n ?? 0);
}

/** 지금 유효한 제작사 인증 한 건(이미 취소됐거나 관리자가 준 인증이면 null) */
export async function getBusinessVerification(id: string) {
  const row = await db().prepare(`${SELECT} AND v.id=?`).get(id);
  return row ? fromRow(row as Record<string, unknown>) : null;
}

/** 문제없음으로 확인 */
export async function markVerificationReviewed(id: string) {
  await db()
    .prepare(`UPDATE verifications SET reviewed_at=? WHERE id=? AND status='approved'`)
    .run(new Date().toISOString(), id);
}

/** 이 인증 한 건을 거둔다(기록은 남기고 반려로 바꾼다). */
export async function revokeVerificationById(id: string, reason: string) {
  const now = new Date().toISOString();
  await db()
    .prepare(
      `UPDATE verifications SET status='rejected', reason=?, decided_at=?, reviewed_at=?
       WHERE id=? AND status='approved'`,
    )
    .run(reason, now, now, id);
}
