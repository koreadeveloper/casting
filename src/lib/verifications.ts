// 제작진 인증 기록 읽기·쓰기. 판정 규칙은 verification-rules.ts, 서류 읽기는 verification-ai.ts.

import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import {
  SCHOOL_VALID_DAYS,
  addDays,
  type ProducerBadges,
  type Verdict,
  type VerificationKind,
} from './verification-rules';

type Row = Record<string, unknown>;
const str = (value: unknown) => String(value ?? '');

/** 학교 메일 확인 코드 유효 시간·입력 횟수 */
export const EMAIL_CODE_MINUTES = 10;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export type VerificationRecord = {
  id: string;
  kind: VerificationKind;
  method: 'email' | 'document';
  status: 'code_sent' | 'approved' | 'rejected';
  orgName: string;
  detail: string;
  reasons: string[];
  createdAt: string;
  expiresAt: string | null;
};

function recordFromRow(row: Row): VerificationRecord {
  return {
    id: str(row.id),
    kind: row.kind === 'business' ? 'business' : 'school',
    method: row.method === 'email' ? 'email' : 'document',
    status: row.status as VerificationRecord['status'],
    orgName: str(row.org_name),
    detail: str(row.detail),
    reasons: str(row.reason) ? str(row.reason).split('\n') : [],
    createdAt: str(row.created_at),
    expiresAt: row.expires_at ? str(row.expires_at) : null,
  };
}

function stillValid(record: { expiresAt: string | null }, now = new Date().toISOString()) {
  return !record.expiresAt || record.expiresAt > now;
}

/** 제작자들의 현재 유효한 인증 배지. 학교·제작사 각각 가장 최근 승인 한 건씩. */
export async function getProducerBadges(ownerIds: (string | null | undefined)[]) {
  const ids = [...new Set(ownerIds.filter((id): id is string => Boolean(id)))];
  const badges = new Map<string, ProducerBadges>();
  if (!ids.length) return badges;
  const rows = (await db()
    .prepare(
      `SELECT * FROM verifications WHERE status='approved'
       AND user_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC`,
    )
    .all(...ids)) as Row[];
  for (const row of rows) {
    const record = recordFromRow(row);
    if (!stillValid(record)) continue;
    const userId = str(row.user_id);
    const current = badges.get(userId) ?? {};
    if (record.kind === 'school' && !current.school)
      current.school = {
        // 서류 인증은 학과까지(detail), 메일 인증의 detail은 도메인이라 학교 이름만 보인다.
        name:
          record.method === 'document'
            ? [record.orgName, record.detail].filter(Boolean).join(' ')
            : record.orgName,
        until: record.expiresAt ?? '',
      };
    if (record.kind === 'business' && !current.business)
      current.business = { name: record.orgName };
    badges.set(userId, current);
  }
  return badges;
}

/** 내 인증 현황: 종류별 가장 최근 기록과 유효한 승인 */
export async function getMyVerifications(userId: string) {
  const rows = (
    (await db()
      .prepare('SELECT * FROM verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30')
      .all(userId)) as Row[]
  ).map(recordFromRow);
  const pick = (kind: VerificationKind) => ({
    approved: rows.find((row) => row.kind === kind && row.status === 'approved' && stillValid(row)),
    latest: rows.find((row) => row.kind === kind && row.status !== 'code_sent'),
  });
  return { school: pick('school'), business: pick('business') };
}

/** 서류 판정 결과를 남긴다. 원본 서류는 저장하지 않는다. */
export async function saveDocumentVerdict(
  userId: string,
  kind: VerificationKind,
  verdict: Verdict,
) {
  const now = new Date();
  await db()
    .prepare(
      `INSERT INTO verifications (id,user_id,kind,method,status,org_name,detail,reason,created_at,decided_at,expires_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      randomUUID(),
      userId,
      kind,
      'document',
      verdict.approved ? 'approved' : 'rejected',
      verdict.orgName.slice(0, 100),
      verdict.detail.slice(0, 100),
      verdict.reasons.join('\n').slice(0, 1000),
      now.toISOString(),
      now.toISOString(),
      verdict.approved && kind === 'school' ? addDays(now, SCHOOL_VALID_DAYS).toISOString() : null,
    );
}

function hashCode(id: string, code: string) {
  return createHash('sha256')
    .update(`${id}:${code}:${process.env.SESSION_SECRET || ''}`)
    .digest('hex');
}

/** 학교 메일 확인 코드를 만든다. 코드 원문은 메일로만 보내고 여기에는 해시만 둔다. */
export async function createSchoolEmailCode(
  userId: string,
  schoolName: string,
  email: string,
  domain: string,
) {
  const id = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db()
    .prepare(
      `INSERT INTO verifications (id,user_id,kind,method,status,org_name,detail,email,code_hash,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      userId,
      'school',
      'email',
      'code_sent',
      schoolName.slice(0, 100),
      domain,
      email,
      hashCode(id, code),
      new Date().toISOString(),
    );
  return { id, code };
}

export type CodeCheck =
  { ok: true; schoolName: string; domain: string } | { ok: false; error: string };

/** 코드를 맞춰 본다. 맞으면 승인 전 단계(학교 이름 확인)로 넘어간다. */
export async function checkSchoolEmailCode(
  userId: string,
  id: string,
  code: string,
): Promise<CodeCheck> {
  const row = (await db()
    .prepare("SELECT * FROM verifications WHERE id=? AND user_id=? AND status='code_sent'")
    .get(id, userId)) as Row | undefined;
  if (!row) return { ok: false, error: '확인 요청을 찾을 수 없어요. 코드를 다시 받아 주세요.' };
  const age = Date.now() - Date.parse(str(row.created_at));
  if (age > EMAIL_CODE_MINUTES * 60000)
    return { ok: false, error: '코드 유효 시간이 지났어요. 코드를 다시 받아 주세요.' };
  if (Number(row.attempts) >= EMAIL_CODE_MAX_ATTEMPTS)
    return { ok: false, error: '입력 횟수를 넘었어요. 코드를 다시 받아 주세요.' };
  await db().prepare('UPDATE verifications SET attempts=attempts+1 WHERE id=?').run(id);
  const expected = Buffer.from(str(row.code_hash), 'hex');
  const actual = Buffer.from(hashCode(id, code.trim()), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return { ok: false, error: '코드가 맞지 않아요.' };
  return { ok: true, schoolName: str(row.org_name), domain: str(row.detail) };
}

/** 학교 메일 인증 결과를 확정한다. 확인 코드 해시는 지운다. */
export async function finishSchoolEmail(
  id: string,
  approved: boolean,
  orgName: string,
  reason: string,
) {
  const now = new Date();
  await db()
    .prepare(
      `UPDATE verifications SET status=?, org_name=?, reason=?, code_hash='', decided_at=?, expires_at=?
       WHERE id=?`,
    )
    .run(
      approved ? 'approved' : 'rejected',
      orgName.slice(0, 100),
      reason.slice(0, 1000),
      now.toISOString(),
      approved ? addDays(now, SCHOOL_VALID_DAYS).toISOString() : null,
      id,
    );
}
