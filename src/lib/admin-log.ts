// 관리자 작업 기록. 정지·삭제·인증·공고 내림 같은 관리자 작업을 남긴다(/admin/logs에서 본다).

import { randomUUID } from 'node:crypto';
import { db } from './db';

export const ADMIN_ACTIONS = {
  suspend: '정지',
  unsuspend: '정지 해제',
  unlink: '소셜 연결 해제',
  delete: '회원 삭제',
  verify: '인증 부여',
  unverify: '인증 취소',
  role: '역할 변경',
  export: '회원 목록 내려받기',
  inquiry_status: '문의 상태 변경',
  inquiry_note: '문의 메모',
  inquiry_delete: '문의 삭제',
  role_hide: '공고 내림',
  role_unhide: '공고 다시 올림',
  role_close: '공고 마감',
  role_reopen: '공고 마감 해제',
  notice: '공지 변경',
} as const;

export type AdminAction = keyof typeof ADMIN_ACTIONS;

export type AdminLog = {
  id: string;
  adminEmail: string;
  action: AdminAction | string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  detail: string;
  createdAt: string;
};

/** 기록을 남긴다. 기록이 실패해도 원래 작업은 막지 않는다(이미 끝난 작업이라서). */
export async function logAdmin(
  admin: { id: string; email: string },
  action: AdminAction,
  target: { type: 'member' | 'inquiry' | 'role' | 'notice'; id?: string; label?: string },
  detail = '',
) {
  try {
    await db()
      .prepare(
        `INSERT INTO admin_logs (id,admin_id,admin_email,action,target_type,target_id,target_label,detail,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        randomUUID(),
        admin.id,
        admin.email,
        action,
        target.type,
        target.id ?? '',
        (target.label ?? '').slice(0, 200),
        detail.slice(0, 500),
        new Date().toISOString(),
      );
  } catch (error) {
    console.error('관리자 작업 기록 실패', action, error);
  }
}

export async function listAdminLogs(filter: { targetId?: string; limit?: number } = {}) {
  const rows = (await db()
    .prepare(
      `SELECT * FROM admin_logs ${filter.targetId ? 'WHERE target_id=?' : ''}
       ORDER BY created_at DESC LIMIT ${Math.min(Math.max(filter.limit ?? 300, 1), 1000)}`,
    )
    .all(...(filter.targetId ? [filter.targetId] : []))) as Record<string, unknown>[];
  return rows.map((row): AdminLog => ({
    id: String(row.id),
    adminEmail: String(row.admin_email),
    action: String(row.action),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    targetLabel: String(row.target_label),
    detail: String(row.detail),
    createdAt: String(row.created_at),
  }));
}
