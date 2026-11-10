// 관리자 문의 처리함(/admin/inquiries)의 조회·변경. 권한 확인은 부르는 쪽(getAdmin)에서 한다.

import { db } from './db';
import {
  INQUIRY_NOTE_MAX,
  isInquiryKind,
  isInquiryStatus,
  type InquiryKind,
  type InquiryStatus,
} from './inquiry';

export type AdminInquiry = {
  id: string;
  kind: InquiryKind;
  email: string;
  body: string;
  link: string;
  createdAt: string;
  status: InquiryStatus;
  note: string;
  handledAt: string | null;
  /** 보낸 이메일로 가입한 회원(있으면) */
  member: { id: string; name: string; role: 'producer' | 'actor' } | null;
};

const str = (value: unknown) => String(value ?? '');

export async function listInquiries(): Promise<AdminInquiry[]> {
  const rows = (await db()
    .prepare(
      `SELECT i.*, u.id AS member_id, u.name AS member_name, u.role AS member_role
       FROM inquiries i LEFT JOIN users u ON lower(u.email) = lower(i.email)
       ORDER BY i.created_at DESC`,
    )
    .all()) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: str(row.id),
    kind: isInquiryKind(row.kind) ? row.kind : 'general',
    email: str(row.email),
    body: str(row.body),
    link: str(row.link),
    createdAt: str(row.created_at),
    status: isInquiryStatus(row.status) ? row.status : 'new',
    note: str(row.admin_note),
    handledAt: row.handled_at ? str(row.handled_at) : null,
    member: row.member_id
      ? {
          id: str(row.member_id),
          name: str(row.member_name),
          role: row.member_role === 'producer' ? 'producer' : 'actor',
        }
      : null,
  }));
}

/** 아직 손대지 않은 문의 수(관리자 메뉴의 숫자) */
export async function countNewInquiries() {
  const row = await db()
    .prepare(`SELECT count(*)::int AS n FROM inquiries WHERE status='new'`)
    .get();
  return Number(row?.n ?? 0);
}

export async function getInquiry(id: string) {
  return (await listInquiries()).find((inquiry) => inquiry.id === id) ?? null;
}

/** 상태·메모를 바꾼다. 완료로 바꾸면 처리 시각을 남기고, 다시 열면 비운다. */
export async function updateInquiry(id: string, input: { status?: InquiryStatus; note?: string }) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.status) {
    sets.push('status=?', 'handled_at=?');
    params.push(input.status, input.status === 'done' ? new Date().toISOString() : null);
  }
  if (input.note !== undefined) {
    sets.push('admin_note=?');
    params.push(input.note.slice(0, INQUIRY_NOTE_MAX));
  }
  if (!sets.length) return 0;
  const result = await db()
    .prepare(`UPDATE inquiries SET ${sets.join(', ')} WHERE id=?`)
    .run(...params, id);
  return result.changes;
}

export async function deleteInquiry(id: string) {
  return (await db().prepare('DELETE FROM inquiries WHERE id=?').run(id)).changes;
}
