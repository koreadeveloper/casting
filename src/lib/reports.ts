// 신고 접수(/report)와 관리자 신고 처리함(/admin/reports)의 서버 쪽 조회·변경.
// 신고 대상이 실제로 있는지, 신고하는 사람이 그 대상을 신고할 수 있는지는 여기서 확인한다.
// 관리자 권한 확인은 부르는 쪽(getAdmin)에서 한다.

import { randomUUID } from 'node:crypto';
import { getUserById } from './accounts';
import { getSession } from './auth';
import { isBoardMember } from './board';
import { db, getApplication, getChatContext, getRole, getRoleById } from './db';
import {
  REPORT_KEEP_DAYS,
  REPORT_NOTE_MAX,
  isReportStatus,
  isReportTarget,
  type ReportInput,
  type ReportReason,
  type ReportStatus,
  type ReportTarget,
  type ReporterSide,
} from './report-rules';

/** 신고 화면이 보여 주고, 접수할 때 그대로 저장하는 대상 정보(화면에서 보낸 값은 믿지 않고 서버에서 다시 만든다) */
export type ResolvedTarget = {
  type: ReportTarget;
  /** 저장용 대상 id: 공고는 배역 id, 배우는 회원 id, 대화는 지원서 id */
  id: string;
  /** 신고하는 사람에게 보여 줄 이름 */
  label: string;
  /** 관리자가 열어 볼 화면 주소 */
  link: string;
  /** 신고당한 회원 id(없으면 '') */
  subjectUserId: string;
  side: ReporterSide;
  reporterId: string;
  /** 계정·지원서에서 가져온 답장 이메일. 비어 있으면 화면에서 입력받는다. */
  reporterEmail: string;
};

/** 체험용 계정 메일은 답장을 받을 수 없어 비운다(문의하기와 같은 규칙) */
const realEmail = (email: string) => (email.endsWith('@demo.casting') ? '' : email);

/**
 * 신고 대상을 찾고, 지금 사람이 신고할 수 있는지 확인한다. 안 되면 null.
 * - 공고: 누구나(로그인하지 않아도). 관리자가 내린 공고는 이미 처리된 것이라 받지 않는다.
 * - 배우: 로그인한 제작진만(배우 프로필은 제작진에게만 보인다).
 * - 대화: 그 지원서 대화에 들어갈 수 있는 사람만. 배우는 지원 현황 토큰, 제작진은 공고 주인·팀원.
 */
export async function resolveReportTarget(
  type: unknown,
  id: unknown,
  receipt: unknown = '',
): Promise<ResolvedTarget | null> {
  if (!isReportTarget(type) || typeof id !== 'string' || !/^[\w-]{1,80}$/.test(id)) return null;
  const session = await getSession();
  const me = session ? await getUserById(session.userId) : null;
  const account = {
    side: (me ? me.role : 'guest') as ReporterSide,
    reporterId: me?.id ?? '',
    reporterEmail: realEmail(me?.email ?? ''),
  };

  if (type === 'role') {
    const role = await getRole(id);
    if (!role || role.adminHidden) return null;
    return {
      type,
      id: role.id,
      label: `${role.projectTitle} · ${role.title}`,
      link: `/apply/${role.slug}`,
      subjectUserId: role.ownerId ?? '',
      ...account,
    };
  }

  if (type === 'actor') {
    if (!me || me.role !== 'producer') return null;
    const actor = await getUserById(id);
    if (!actor || actor.role !== 'actor' || actor.id === me.id) return null;
    return {
      type,
      id: actor.id,
      label: actor.name || '(이름 없음)',
      link: `/actors/${actor.id}`,
      subjectUserId: actor.id,
      ...account,
    };
  }

  // 대화: 배우는 토큰으로, 제작진은 공고 주인·팀원인지로 확인한다(lib/chat-access.ts와 같은 규칙).
  const application = await getApplication(id);
  const context = application ? await getChatContext(application.id) : null;
  const role = application ? await getRoleById(application.roleId) : null;
  if (!application || !context || !role) return null;
  const roleLabel = `${role.projectTitle} · ${role.title}`;
  const token = typeof receipt === 'string' ? receipt : '';
  if (token) {
    if (!(token.length >= 40 && token === application.receiptToken)) return null;
    return {
      type,
      id: application.id,
      label: `${roleLabel} 제작진${role.contactName ? ` (${role.contactName})` : ''}`,
      link: `/apply/${role.slug}`,
      subjectUserId: context.ownerId,
      side: 'actor',
      reporterId: application.actorId ?? '',
      reporterEmail: realEmail(application.email),
    };
  }
  if (!me || me.role !== 'producer') return null;
  const allowed = context.projectId
    ? await isBoardMember(context.projectId, me.id)
    : context.ownerId === me.id;
  if (!allowed) return null;
  return {
    type,
    id: application.id,
    label: `지원자 ${application.name} · ${roleLabel}`,
    link: application.actorId ? `/actors/${application.actorId}` : '',
    subjectUserId: application.actorId ?? '',
    ...account,
  };
}

/** 같은 사람이 같은 대상을 하루에 두 번 이상 신고하지 않게 한다 */
export async function reportedRecently(target: ResolvedTarget, email: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const row = await db()
    .prepare(
      `SELECT 1 FROM reports WHERE target_type=? AND target_id=? AND created_at >= ?
       AND (lower(reporter_email)=lower(?) OR (reporter_id <> '' AND reporter_id=?))`,
    )
    .get(target.type, target.id, since, email, target.reporterId);
  return Boolean(row);
}

export async function createReport(target: ResolvedTarget, input: ReportInput) {
  const now = new Date();
  const expired = new Date(now.getTime() - REPORT_KEEP_DAYS * 24 * 3600 * 1000).toISOString();
  await db().prepare('DELETE FROM reports WHERE created_at < ?').run(expired);
  const id = randomUUID();
  await db()
    .prepare(
      `INSERT INTO reports (id,target_type,target_id,target_label,target_link,subject_user_id,reason,body,
       reporter_side,reporter_id,reporter_email,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      target.type,
      target.id,
      target.label.slice(0, 200),
      target.link,
      target.subjectUserId,
      input.reason,
      input.body,
      target.side,
      target.reporterId,
      input.email,
      now.toISOString(),
    );
  return id;
}

export type AdminReport = {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  targetLabel: string;
  targetLink: string;
  reason: ReportReason | string;
  body: string;
  reporterSide: ReporterSide;
  reporterEmail: string;
  createdAt: string;
  status: ReportStatus;
  note: string;
  handledAt: string | null;
  /** 신고당한 회원(아직 있으면) */
  subject: { id: string; name: string; role: 'producer' | 'actor'; suspended: boolean } | null;
  /** 신고한 회원(로그인해서 신고했고 아직 있으면) */
  reporter: { id: string; name: string } | null;
};

const str = (value: unknown) => String(value ?? '');

export async function listReports(): Promise<AdminReport[]> {
  const rows = (await db()
    .prepare(
      `SELECT r.*, s.id AS s_id, s.name AS s_name, s.role AS s_role, s.suspended_at AS s_suspended,
              p.id AS p_id, p.name AS p_name
       FROM reports r
       LEFT JOIN users s ON r.subject_user_id <> '' AND s.id = r.subject_user_id
       LEFT JOIN users p ON r.reporter_id <> '' AND p.id = r.reporter_id
       ORDER BY r.created_at DESC`,
    )
    .all()) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: str(row.id),
    targetType: isReportTarget(row.target_type) ? row.target_type : 'role',
    targetId: str(row.target_id),
    targetLabel: str(row.target_label),
    targetLink: str(row.target_link),
    reason: str(row.reason),
    body: str(row.body),
    reporterSide: (['guest', 'actor', 'producer'].includes(str(row.reporter_side))
      ? str(row.reporter_side)
      : 'guest') as ReporterSide,
    reporterEmail: str(row.reporter_email),
    createdAt: str(row.created_at),
    status: isReportStatus(row.status) ? row.status : 'new',
    note: str(row.admin_note),
    handledAt: row.handled_at ? str(row.handled_at) : null,
    subject: row.s_id
      ? {
          id: str(row.s_id),
          name: str(row.s_name),
          role: row.s_role === 'producer' ? 'producer' : 'actor',
          suspended: Boolean(row.s_suspended),
        }
      : null,
    reporter: row.p_id ? { id: str(row.p_id), name: str(row.p_name) } : null,
  }));
}

/** 아직 손대지 않은 신고 수(관리자 메뉴의 숫자) */
export async function countNewReports() {
  const row = await db().prepare(`SELECT count(*)::int AS n FROM reports WHERE status='new'`).get();
  return Number(row?.n ?? 0);
}

export async function getReport(id: string) {
  return (await listReports()).find((report) => report.id === id) ?? null;
}

/** 상태·메모를 바꾼다. 처리 끝(조치함·문제 없음)으로 바꾸면 처리 시각을 남기고, 다시 열면 비운다. */
export async function updateReport(id: string, input: { status?: ReportStatus; note?: string }) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.status) {
    const closed = input.status === 'actioned' || input.status === 'dismissed';
    sets.push('status=?', 'handled_at=?');
    params.push(input.status, closed ? new Date().toISOString() : null);
  }
  if (input.note !== undefined) {
    sets.push('admin_note=?');
    params.push(input.note.slice(0, REPORT_NOTE_MAX));
  }
  if (!sets.length) return 0;
  const result = await db()
    .prepare(`UPDATE reports SET ${sets.join(', ')} WHERE id=?`)
    .run(...params, id);
  return result.changes;
}

export async function deleteReport(id: string) {
  return (await db().prepare('DELETE FROM reports WHERE id=?').run(id)).changes;
}
