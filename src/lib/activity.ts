// 알림 피드 — 실제 DB 이벤트(지원·메시지·제안 응답·공고)를 모아 최근순으로 반환.
// 별도 notifications 테이블 없이 파생 데이터로 구성해 항상 실제 상태와 일치한다.
import { db } from './db';
import { MESSAGE_PREVIEW_SQL } from './chat-files';
import { isAttendanceAskOpen, nextShootDate, shootDateLabel, shootDayLabel } from './attendance';
import { matchNotice, matchRoleForActor, type MatchProfileInput } from './match';
import {
  dDayLabel,
  daysUntilResult,
  isResultDueSoon,
  kstToday,
  resultDueDate,
} from './result-deadline';

export type ActivityItem = {
  id: string;
  icon: string;
  text: string;
  href: string;
  at: string;
};

export type ActivityFeed = {
  items: ActivityItem[];
  badge: number;
};

type Row = Record<string, unknown>;
const str = (value: unknown) => String(value ?? '');

function clip(text: string, length = 34) {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function sortCap(items: ActivityItem[], cap = 10) {
  return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, cap);
}

type CastShoot = {
  applicationId: string;
  name: string;
  receiptToken: string;
  roleId: string;
  roleTitle: string;
  shootDate: string;
  answer: { status: string; respondedAt: string } | null;
};

/**
 * 출연 확정(합격)된 지원서 중 참석 재확인 기간(촬영 D-3 ~ 당일)에 든 것과 그 답.
 * owner = 제작자 기준, actor = 배우 기준.
 */
async function castShootsInWindow(by: 'owner' | 'actor', userId: string): Promise<CastShoot[]> {
  const where = by === 'owner' ? 'r.owner_id = ?' : 'a.actor_id = ?';
  const rows = (await db()
    .prepare(
      `SELECT a.id, a.name, a.receipt_token, r.id role_id, r.title, r.shoot_dates, r.shoot_date
       FROM applications a JOIN roles r ON r.id = a.role_id
       WHERE ${where} AND a.public_stage = 'cast'`,
    )
    .all(userId)) as Row[];
  const today = kstToday();
  const due = rows
    .map((row) => {
      let dates: string[] = [];
      try {
        dates = JSON.parse(str(row.shoot_dates) || '[]') as string[];
      } catch {
        dates = [];
      }
      if (!dates.length) dates = [str(row.shoot_date)];
      return { row, shootDate: nextShootDate(dates, today) };
    })
    .filter(({ shootDate }) => isAttendanceAskOpen(shootDate, today));
  if (!due.length) return [];
  const answers = (await db()
    .prepare(
      `SELECT application_id, shoot_date, status, responded_at FROM attendance_checks
       WHERE application_id IN (${due.map(() => '?').join(',')})`,
    )
    .all(...due.map(({ row }) => str(row.id)))) as Row[];
  return due.map(({ row, shootDate }) => {
    const answer = answers.find(
      (item) => str(item.application_id) === str(row.id) && str(item.shoot_date) === shootDate,
    );
    return {
      applicationId: str(row.id),
      name: str(row.name),
      receiptToken: str(row.receipt_token),
      roleId: str(row.role_id),
      roleTitle: str(row.title),
      shootDate,
      answer: answer ? { status: str(answer.status), respondedAt: str(answer.responded_at) } : null,
    };
  });
}

export async function producerFeed(ownerId: string): Promise<ActivityFeed> {
  const items: ActivityItem[] = [];

  const applications = (await db()
    .prepare(
      `SELECT a.id, a.name, a.created_at, r.title role_title
       FROM applications a JOIN roles r ON r.id = a.role_id
       WHERE r.owner_id = ? ORDER BY a.created_at DESC LIMIT 6`,
    )
    .all(ownerId)) as Row[];
  for (const row of applications) {
    items.push({
      id: `app-${str(row.id)}`,
      icon: '📥',
      text: `${str(row.name)}님이 ‘${str(row.role_title)}’에 지원했어요`,
      href: '/studio',
      at: str(row.created_at),
    });
  }

  const unread = (await db()
    .prepare(
      `SELECT m.id, ${MESSAGE_PREVIEW_SQL('m')} body, m.created_at, a.name actor_name
       FROM chat_messages m
       JOIN applications a ON a.id = m.application_id
       JOIN roles r ON r.id = a.role_id
       WHERE r.owner_id = ? AND m.sender = 'actor'
         AND m.created_at > COALESCE(
           (SELECT MAX(p.created_at) FROM chat_messages p
            WHERE p.application_id = a.id AND p.sender = 'producer'), '')
       ORDER BY m.created_at DESC LIMIT 6`,
    )
    .all(ownerId)) as Row[];
  for (const row of unread) {
    items.push({
      id: `msg-${str(row.id)}`,
      icon: '💬',
      text: `${str(row.actor_name)}님의 메시지 — “${clip(str(row.body))}”`,
      href: '/studio',
      at: str(row.created_at),
    });
  }

  const proposals = (await db()
    .prepare(
      `SELECT pr.id, pr.status, pr.created_at, u.name actor_name, r.title role_title
       FROM proposals pr
       JOIN users u ON u.id = pr.actor_id
       JOIN roles r ON r.id = pr.role_id
       WHERE pr.producer_id = ? AND pr.status != 'sent'
       ORDER BY pr.created_at DESC LIMIT 4`,
    )
    .all(ownerId)) as Row[];
  for (const row of proposals) {
    const accepted = row.status === 'accepted';
    items.push({
      id: `prop-${str(row.id)}`,
      icon: accepted ? '🤝' : '✉️',
      text: `${str(row.actor_name)}님이 ‘${str(row.role_title)}’ 제안을 ${accepted ? '수락' : '거절'}했어요`,
      href: '/studio',
      at: str(row.created_at),
    });
  }

  const auditions = (await db()
    .prepare(
      `SELECT id, actor_name, starts_at FROM audition_events
       WHERE owner_id = ? AND status = 'confirmed' AND starts_at >= ?
       ORDER BY starts_at ASC LIMIT 3`,
    )
    .all(ownerId, new Date().toISOString())) as Row[];
  for (const row of auditions) {
    const when = new Date(str(row.starts_at));
    items.push({
      id: `aud-${str(row.id)}`,
      icon: '📅',
      text: `${str(row.actor_name)}님 오디션 ${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')} 확정`,
      href: '/studio/calendar',
      at: str(row.starts_at),
    });
  }

  // 결과 자동 안내 미리 알림: 결과 기준일이 며칠 안으로 다가왔는데 결과 전 지원자가 남은 배역.
  // 할 일이라 배지 수에도 넣는다. (보관한 프로젝트는 접수가 마감돼 있어도 결과는 남아 있으니 함께 알린다)
  const today = kstToday();
  const pendingRoles = (await db()
    .prepare(
      `SELECT r.id, r.title, r.announcement_date, p.audition_end,
         SUM(CASE WHEN a.public_stage = 'received' THEN 1 ELSE 0 END) pending
       FROM roles r
       JOIN applications a ON a.role_id = r.id
       LEFT JOIN projects p ON p.id = r.project_id
       WHERE r.owner_id = ?
       GROUP BY r.id, p.id
       HAVING SUM(CASE WHEN a.public_stage = 'received' THEN 1 ELSE 0 END) > 0`,
    )
    .all(ownerId)) as Row[];
  let warnings = 0;
  for (const row of pendingRoles) {
    const due = resultDueDate(str(row.announcement_date), str(row.audition_end));
    const days = daysUntilResult(due, today);
    if (days === null || !isResultDueSoon(due, today)) continue;
    warnings += 1;
    items.push({
      id: `due-${str(row.id)}`,
      icon: '⚡',
      text: `‘${str(row.title)}’ 결과 안내 ${dDayLabel(days)} — 결과 전 ${Number(row.pending)}명은 기준일 다음 날 자동으로 불합격 안내돼요`,
      href: `/studio?tab=applicants&role=${encodeURIComponent(str(row.id))}`,
      // 해야 할 일이라 목록 맨 위에 둔다.
      at: new Date().toISOString(),
    });
  }

  // 자동으로 결과를 안내한 기록(최근 7일): 제작진이 무슨 일이 있었는지 알 수 있게.
  const autoClosed = (await db()
    .prepare(
      `SELECT e.role_id, r.title, COUNT(*) n, MAX(e.created_at) at
       FROM events e JOIN roles r ON r.id = e.role_id
       WHERE r.owner_id = ? AND e.name = 'public_result_auto' AND e.created_at >= ?
       GROUP BY e.role_id, r.title`,
    )
    .all(ownerId, new Date(Date.now() - 7 * 86400 * 1000).toISOString())) as Row[];
  for (const row of autoClosed) {
    items.push({
      id: `auto-${str(row.role_id)}-${str(row.at)}`,
      icon: '📮',
      text: `‘${str(row.title)}’ 결과 기준일이 지나 ${Number(row.n)}명에게 자동으로 불합격을 안내했어요`,
      href: `/studio?tab=applicants&role=${encodeURIComponent(str(row.role_id))}`,
      at: str(row.at),
    });
  }

  // 촬영 참석 재확인: 출연 확정 배우의 답. '어렵다'는 바로 대처해야 하니 배지에 넣는다.
  for (const shoot of await castShootsInWindow('owner', ownerId)) {
    const when = `${shootDateLabel(shoot.shootDate)} 촬영`;
    const href = `/studio?tab=applicants&role=${encodeURIComponent(shoot.roleId)}`;
    if (shoot.answer?.status === 'no') warnings += 1;
    items.push({
      id: `attend-${shoot.applicationId}-${shoot.shootDate}`,
      icon: !shoot.answer ? '⏳' : shoot.answer.status === 'yes' ? '✅' : '⚠️',
      text: !shoot.answer
        ? `${shoot.name}님 ${when} 참석 확인 대기 중 (${shootDayLabel(shoot.shootDate, today)})`
        : shoot.answer.status === 'yes'
          ? `${shoot.name}님이 ${when} 참석을 확인했어요`
          : `${shoot.name}님이 ${when} 참석이 어렵다고 했어요 — 대화에서 사유를 확인해 주세요`,
      href,
      at: shoot.answer?.respondedAt || new Date().toISOString(),
    });
  }

  return { items: sortCap(items), badge: unread.length + warnings };
}

export async function actorFeed(
  actorId: string,
  profile: (MatchProfileInput & { name?: string }) | null,
): Promise<ActivityFeed> {
  const items: ActivityItem[] = [];
  let badge = 0;

  const proposals = (await db()
    .prepare(
      `SELECT pr.id, pr.created_at, r.title role_title, r.project_title
       FROM proposals pr JOIN roles r ON r.id = pr.role_id
       WHERE pr.actor_id = ? AND pr.status = 'sent' ORDER BY pr.created_at DESC LIMIT 4`,
    )
    .all(actorId)) as Row[];
  badge += proposals.length;
  for (const row of proposals) {
    items.push({
      id: `prop-${str(row.id)}`,
      icon: '✨',
      text: `새 캐스팅 제안 — ‘${str(row.project_title)} ${str(row.role_title)}’`,
      href: '/me',
      at: str(row.created_at),
    });
  }

  const messages = (await db()
    .prepare(
      `SELECT m.id, ${MESSAGE_PREVIEW_SQL('m')} body, m.created_at, a.receipt_token, r.title role_title
       FROM chat_messages m
       JOIN applications a ON a.id = m.application_id
       JOIN roles r ON r.id = a.role_id
       WHERE a.actor_id = ? AND m.sender = 'producer'
       ORDER BY m.created_at DESC LIMIT 4`,
    )
    .all(actorId)) as Row[];
  const recentWindow = Date.now() - 72 * 3600 * 1000;
  for (const row of messages) {
    if (new Date(str(row.created_at)).getTime() > recentWindow) badge += 1;
    items.push({
      id: `msg-${str(row.id)}`,
      icon: '💬',
      text: `‘${str(row.role_title)}’ 제작팀 — “${clip(str(row.body))}”`,
      href: `/status/${str(row.receipt_token)}`,
      at: str(row.created_at),
    });
  }

  const updates = (await db()
    .prepare(
      `SELECT a.id, a.receipt_token, a.updated_at, a.viewed_at, a.public_stage, a.result_auto_at,
         r.title role_title
       FROM applications a JOIN roles r ON r.id = a.role_id
       WHERE a.actor_id = ? AND (a.public_stage != 'received' OR a.viewed_at IS NOT NULL)
       ORDER BY a.updated_at DESC LIMIT 3`,
    )
    .all(actorId)) as Row[];
  for (const row of updates) {
    // 결과 전이지만 제작진이 지원서를 열어 봤으면 '검토 중' 알림을 보낸다(미열람 → 검토 중).
    const viewedOnly = row.public_stage === 'received';
    const passed = row.public_stage !== 'not_selected';
    const autoClosed = !passed && Boolean(row.result_auto_at);
    items.push({
      id: `upd-${str(row.id)}`,
      icon: viewedOnly ? '👀' : passed ? '🎉' : '📢',
      text: viewedOnly
        ? `‘${str(row.role_title)}’ 지원서를 제작진이 확인했어요`
        : autoClosed
          ? `‘${str(row.role_title)}’ 결과 안내일이 지나 지원이 마감됐어요`
          : `‘${str(row.role_title)}’ 지원 결과가 업데이트됐어요`,
      href: `/status/${str(row.receipt_token)}`,
      at: str(viewedOnly ? row.viewed_at : row.updated_at),
    });
  }

  // 촬영 참석 재확인 요청: 아직 답하지 않은 촬영은 할 일이라 배지에 넣고 맨 위에 둔다.
  const today = kstToday();
  for (const shoot of await castShootsInWindow('actor', actorId)) {
    if (shoot.answer) continue;
    badge += 1;
    items.push({
      id: `attend-${shoot.applicationId}-${shoot.shootDate}`,
      icon: '🎬',
      text: `‘${shoot.roleTitle}’ 촬영 ${shootDayLabel(shoot.shootDate, today)} (${shootDateLabel(shoot.shootDate)}) — 참석 여부를 알려 주세요`,
      href: `/status/${shoot.receiptToken}`,
      at: new Date().toISOString(),
    });
  }

  if (profile) {
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    const roles = (await db()
      .prepare(
        `SELECT slug, title, description, requirement, location, shoot_date, project_title, created_at
         FROM roles WHERE is_closed = 0 AND created_at >= ? ORDER BY created_at DESC`,
      )
      .all(since)) as Row[];
    const matched = roles
      .map((row) => {
        const role = {
          title: str(row.title),
          description: str(row.description),
          requirement: str(row.requirement),
          location: str(row.location),
          shootDate: str(row.shoot_date),
        };
        return { row, role, fit: matchRoleForActor(profile, role) };
      })
      .filter((entry) => entry.fit.score >= 25)
      .sort((a, b) => b.fit.score - a.fit.score)
      .slice(0, 3);
    for (const { row, role, fit } of matched) {
      items.push({
        id: `role-${str(row.slug)}`,
        icon: '🎯',
        text: `${matchNotice(profile.name ?? '', profile, role, fit.reasons)} — ‘${str(row.project_title)} ${role.title}’`,
        href: `/apply/${str(row.slug)}`,
        at: str(row.created_at),
      });
    }
  }

  return { items: sortCap(items), badge };
}
