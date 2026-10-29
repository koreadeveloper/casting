import { randomUUID } from 'node:crypto';
import { db, createRole, getRoleById, listProjectRoles, updateRole, type NewRole } from './db';
import { hashPassword } from './password';
import { daysBetween } from './schedule';
import { transaction } from './sql';
import { deleteUploads } from './storage';
import type { ActorProfile, Filmography, Gender } from './profile';
import type { UserRole } from './session-token';

export type ProfileDocument = { name: string; url: string };

/**
 * ActorProfile plus the columns added later to actor_profiles
 * (소속 agency, PDF 자료 documents). getProfile keeps the base ActorProfile
 * return type for backwards compatibility — use getProfileFull / listPublicProfiles
 * when the extra fields are needed.
 */
export type ActorProfileFull = ActorProfile & {
  agency: string;
  documents: ProfileDocument[];
};

export const MAX_DOCUMENTS = 5;

const PDF_UPLOAD_PATTERN = /^\/api\/uploads\/[a-f0-9-]{36}\.pdf$/;

/** Only PDFs uploaded through /api/uploads may be stored as profile documents. */
export function safeDocumentRef(value: unknown) {
  const text = typeof value === 'string' ? value.trim().slice(0, 1000) : '';
  return PDF_UPLOAD_PATTERN.test(text) ? text : '';
}

export type User = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone: string;
  orgType: string;
  orgName: string;
  createdAt: string;
};

export type Project = {
  id: string;
  ownerId: string;
  title: string;
  /** 형식(단편영화·웹드라마 등). DB 칸 이름은 예전부터 genre다. */
  genre: string;
  /** 장르(여러 개) */
  genres: string[];
  productionType: string;
  /** 분량: "20분", "8부작" 등 자유 입력 */
  runtime: string;
  releaseChannels: string[];
  /** 공개 예정 시기: "2027년 상반기" 등 자유 입력 */
  releasePeriod: string;
  company: string;
  director: string;
  producerName: string;
  /** 한 줄 소개 */
  logline: string;
  /** 촬영 지역 시·도. 상세 지역까지 합친 문자열은 location */
  region: string;
  auditionStart: string;
  auditionEnd: string;
  /** 리딩·리허설 기간 */
  prepStart: string;
  prepEnd: string;
  shootStart: string;
  shootEnd: string;
  /** 총 촬영 회차. 0이면 미정 */
  shootSessions: number;
  location: string;
  /** 시놉시스 */
  description: string;
  /** 작품 포스터(/api/uploads/ 사진). 비어 있으면 형식별 기본 커버 */
  posterUrl: string;
  /** 제공 항목(교통비·식사·숙박) */
  perks: string[];
  createdAt: string;
  /** 보관(숨김)한 시각. null이면 진행 중 */
  archivedAt: string | null;
};

export type ProjectInput = Omit<Project, 'id' | 'ownerId' | 'createdAt' | 'archivedAt'>;

/** 프로젝트 칸 기본값. 예전 경로(배역 빠르게 추가)로 만들 때 비어 있는 칸을 채운다. */
export const EMPTY_PROJECT: ProjectInput = {
  title: '',
  genre: '',
  genres: [],
  productionType: '',
  runtime: '',
  releaseChannels: [],
  releasePeriod: '',
  company: '',
  director: '',
  producerName: '',
  logline: '',
  region: '',
  auditionStart: '',
  auditionEnd: '',
  prepStart: '',
  prepEnd: '',
  shootStart: '',
  shootEnd: '',
  shootSessions: 0,
  location: '',
  description: '',
  perks: [],
  posterUrl: '',
};

/** 모든 배역에 똑같이 들어가는 지원 조건. 프로젝트 등록·수정의 '조건·담당' 단계 값이다. */
export type ProjectConditions = Pick<
  NewRole,
  'pay' | 'deadline' | 'announcementDate' | 'contactName'
>;

/** 프로젝트 등록·수정 화면에서 넘어오는 배역 한 개. id가 있으면 기존 배역 수정, 없으면 새 배역. */
export type RoleEdit = Pick<NewRole, 'title' | 'description' | 'requirement'> &
  Required<
    Pick<
      NewRole,
      | 'roleType'
      | 'gender'
      | 'ageMin'
      | 'ageMax'
      | 'headcount'
      | 'shootMode'
      | 'shootDates'
      | 'specialScenes'
      | 'specialNote'
    >
  > & { id?: string; isClosed?: boolean };

export type Proposal = {
  id: string;
  producerId: string;
  producerName: string;
  orgName: string;
  actorId: string;
  actorName: string;
  roleId: string;
  roleSlug: string;
  roleTitle: string;
  projectTitle: string;
  message: string;
  status: 'sent' | 'accepted' | 'declined';
  createdAt: string;
};

type Row = Record<string, unknown>;

function userFromRow(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    role: row.role as UserRole,
    name: String(row.name),
    phone: String(row.phone),
    orgType: String(row.org_type),
    orgName: String(row.org_name),
    createdAt: String(row.created_at),
  };
}

function parseList<T>(value: unknown): T[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseDocuments(value: unknown): ProfileDocument[] {
  return parseList<ProfileDocument>(value)
    .map((doc) => ({
      name: typeof doc?.name === 'string' ? doc.name : '',
      url: typeof doc?.url === 'string' ? doc.url : '',
    }))
    .filter((doc) => doc.url)
    .slice(0, MAX_DOCUMENTS);
}

function profileFromRow(row: Row): ActorProfileFull {
  return {
    userId: String(row.user_id),
    name: String(row.name),
    gender: String(row.gender) as Gender,
    birthYear: row.birth_year === null ? null : Number(row.birth_year),
    height: row.height === null ? null : Number(row.height),
    weight: row.weight === null ? null : Number(row.weight),
    region: String(row.region),
    intro: String(row.intro),
    tags: parseList<string>(row.tags),
    skills: parseList<string>(row.skills),
    photos: parseList<string>(row.photos),
    videoUrl: String(row.video_url),
    filmography: parseList<Filmography>(row.filmography),
    unavailableDates: parseList<string>(row.unavailable_dates),
    isPublic: Boolean(row.is_public),
    updatedAt: String(row.updated_at),
    agency: String(row.agency ?? ''),
    documents: parseDocuments(row.documents),
  };
}

export async function getUserById(id: string) {
  const row = await db().prepare('SELECT * FROM users WHERE id=?').get(id);
  return row ? userFromRow(row as Row) : null;
}

/**
 * 공고에 함께 보여 주는 제작자 정보.
 * 확인된 사실만 담는다 — 아직 재학·사업자 인증 절차가 없으므로 '인증' 배지는 만들지 않는다.
 * 가짜 인증 표시는 "믿을 만한 공고인지 알고 싶다"는 요구를 오히려 배신한다.
 */
export type ProducerIntro = {
  name: string;
  orgType: string;
  orgName: string;
  /** 이 제작자가 올린 공고 수 (처음 올린 공고인지 알 수 있다) */
  totalRoles: number;
  openRoles: number;
  /** 가입 연월 'YYYY-MM' */
  memberSince: string;
};

export async function getProducerIntro(ownerId: string): Promise<ProducerIntro | null> {
  const user = await getUserById(ownerId);
  if (!user || user.role !== 'producer') return null;
  const row = (await db()
    .prepare(
      `SELECT COUNT(*) total, SUM(CASE WHEN is_closed=0 THEN 1 ELSE 0 END) open
       FROM roles WHERE owner_id=?`,
    )
    .get(ownerId)) as { total: number; open: number | null } | undefined;
  return {
    name: user.name,
    orgType: user.orgType,
    orgName: user.orgName,
    totalRoles: Number(row?.total || 0),
    openRoles: Number(row?.open || 0),
    memberSince: user.createdAt.slice(0, 7),
  };
}

/**
 * 공고 카드에 한 줄로 붙이는 제작자 소속 (예: "한빛대 영화과 졸업작품팀").
 * 소속명이 없으면 소속 유형을, 둘 다 없으면 빼고 돌려준다. 키는 제작자 id.
 */
export async function getProducerOrgLines(ownerIds: (string | null | undefined)[]) {
  const ids = [...new Set(ownerIds.filter((id): id is string => Boolean(id)))];
  const lines = new Map<string, string>();
  if (!ids.length) return lines;
  const rows = (await db()
    .prepare(
      `SELECT id, org_type, org_name FROM users
       WHERE role='producer' AND id IN (${ids.map(() => '?').join(',')})`,
    )
    .all(...ids)) as Row[];
  for (const row of rows) {
    const line = String(row.org_name ?? '').trim() || String(row.org_type ?? '').trim();
    if (line) lines.set(String(row.id), line);
  }
  return lines;
}

export async function getUserWithHash(email: string) {
  const row = (await db().prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase())) as
    Row | undefined;
  return row ? { user: userFromRow(row), passwordHash: String(row.password_hash) } : null;
}

export async function createUser(input: {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  phone: string;
  orgType?: string;
  orgName?: string;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db()
    .prepare(
      `INSERT INTO users (id,email,password_hash,role,name,phone,org_type,org_name,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      input.email.toLowerCase(),
      hashPassword(input.password),
      input.role,
      input.name,
      input.phone,
      input.orgType || '',
      input.orgName || '',
      now,
    );
  if (input.role === 'actor')
    await db().prepare('INSERT INTO actor_profiles (user_id,updated_at) VALUES (?,?)').run(id, now);
  return (await getUserById(id))!;
}

const PROFILE_SELECT = `SELECT p.*, u.name FROM actor_profiles p JOIN users u ON u.id=p.user_id`;

export async function getProfile(userId: string): Promise<ActorProfile | null> {
  const row = await db().prepare(`${PROFILE_SELECT} WHERE p.user_id=?`).get(userId);
  return row ? profileFromRow(row as Row) : null;
}

export async function getProfileFull(userId: string): Promise<ActorProfileFull | null> {
  const row = await db().prepare(`${PROFILE_SELECT} WHERE p.user_id=?`).get(userId);
  return row ? profileFromRow(row as Row) : null;
}

export async function listPublicProfiles(): Promise<ActorProfileFull[]> {
  return (
    await db().prepare(`${PROFILE_SELECT} WHERE p.is_public=1 ORDER BY p.updated_at DESC`).all()
  ).map((row) => profileFromRow(row as Row));
}

export async function updateProfile(
  userId: string,
  input: Omit<ActorProfileFull, 'userId' | 'updatedAt'>,
) {
  const documents = input.documents
    .filter((doc) => safeDocumentRef(doc.url))
    .slice(0, MAX_DOCUMENTS);
  await db()
    .prepare(
      `UPDATE actor_profiles SET gender=?,birth_year=?,height=?,weight=?,region=?,intro=?,tags=?,skills=?,
      photos=?,video_url=?,filmography=?,unavailable_dates=?,is_public=?,agency=?,documents=?,updated_at=? WHERE user_id=?`,
    )
    .run(
      input.gender,
      input.birthYear,
      input.height,
      input.weight,
      input.region,
      input.intro,
      JSON.stringify(input.tags),
      JSON.stringify(input.skills),
      JSON.stringify(input.photos),
      input.videoUrl,
      JSON.stringify(input.filmography),
      JSON.stringify(input.unavailableDates),
      Number(input.isPublic),
      input.agency.trim().slice(0, 60),
      JSON.stringify(documents),
      new Date().toISOString(),
      userId,
    );
  if (input.name) await db().prepare('UPDATE users SET name=? WHERE id=?').run(input.name, userId);
  return (await getProfileFull(userId))!;
}

export async function listFavoriteIds(producerId: string) {
  return (
    (await db().prepare('SELECT actor_id FROM favorites WHERE producer_id=?').all(producerId)) as {
      actor_id: string;
    }[]
  ).map((row) => row.actor_id);
}

export async function setFavorite(producerId: string, actorId: string, on: boolean) {
  if (on)
    await db()
      .prepare('INSERT OR IGNORE INTO favorites (producer_id,actor_id,created_at) VALUES (?,?,?)')
      .run(producerId, actorId, new Date().toISOString());
  else
    await db()
      .prepare('DELETE FROM favorites WHERE producer_id=? AND actor_id=?')
      .run(producerId, actorId);
}

/** JSON 문자열로 저장된 문자열 목록. 예전 행이나 깨진 값은 빈 목록으로 본다. */
function listOf(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function textOf(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function projectFromRow(row: Row): Project {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    title: String(row.title),
    genre: textOf(row.genre),
    genres: listOf(row.genres),
    productionType: textOf(row.production_type),
    runtime: textOf(row.runtime),
    releaseChannels: listOf(row.release_channels),
    releasePeriod: textOf(row.release_period),
    company: textOf(row.company),
    director: textOf(row.director),
    producerName: textOf(row.producer_name),
    logline: textOf(row.logline),
    region: textOf(row.region),
    auditionStart: textOf(row.audition_start),
    auditionEnd: textOf(row.audition_end),
    prepStart: textOf(row.prep_start),
    prepEnd: textOf(row.prep_end),
    shootStart: textOf(row.shoot_start),
    shootEnd: textOf(row.shoot_end),
    shootSessions: Number(row.shoot_sessions || 0),
    location: textOf(row.location),
    description: textOf(row.description),
    perks: listOf(row.perks),
    posterUrl: textOf(row.poster_url),
    createdAt: String(row.created_at),
    archivedAt: row.archived_at ? String(row.archived_at) : null,
  };
}

export async function listProjects(ownerId: string) {
  return (
    await db()
      .prepare('SELECT * FROM projects WHERE owner_id=? ORDER BY created_at DESC')
      .all(ownerId)
  ).map((row) => projectFromRow(row as Row));
}

export async function getProject(id: string) {
  const row = await db().prepare('SELECT * FROM projects WHERE id=?').get(id);
  return row ? projectFromRow(row as Row) : null;
}

// projects 칸 순서. INSERT와 UPDATE가 같은 순서를 쓴다.
const PROJECT_COLUMNS = [
  'title',
  'genre',
  'genres',
  'production_type',
  'runtime',
  'release_channels',
  'release_period',
  'company',
  'director',
  'producer_name',
  'logline',
  'region',
  'audition_start',
  'audition_end',
  'prep_start',
  'prep_end',
  'shoot_start',
  'shoot_end',
  'shoot_sessions',
  'location',
  'description',
  'perks',
  'poster_url',
];

function projectValues(input: ProjectInput) {
  return [
    input.title,
    input.genre,
    JSON.stringify(input.genres),
    input.productionType,
    input.runtime,
    JSON.stringify(input.releaseChannels),
    input.releasePeriod,
    input.company,
    input.director,
    input.producerName,
    input.logline,
    input.region,
    input.auditionStart,
    input.auditionEnd,
    input.prepStart,
    input.prepEnd,
    input.shootStart,
    input.shootEnd,
    input.shootSessions,
    input.location,
    input.description,
    JSON.stringify(input.perks),
    input.posterUrl,
  ];
}

async function insertProject(ownerId: string, input: ProjectInput): Promise<Project> {
  const id = randomUUID();
  const values = projectValues(input);
  await db()
    .prepare(
      `INSERT INTO projects (id,owner_id,${PROJECT_COLUMNS.join(',')},created_at)
      VALUES (?,?,${values.map(() => '?').join(',')},?)`,
    )
    .run(id, ownerId, ...values, new Date().toISOString());
  return (await getProject(id))!;
}

export async function findOrCreateProject(ownerId: string, role: NewRole) {
  const row = await db()
    .prepare('SELECT * FROM projects WHERE owner_id=? AND title=?')
    .get(ownerId, role.projectTitle);
  return row
    ? projectFromRow(row as Row)
    : await insertProject(ownerId, {
        ...EMPTY_PROJECT,
        title: role.projectTitle,
        shootStart: role.shootDate,
        shootEnd: role.shootDate,
        location: role.location,
      });
}

/** 배역 한 개를 저장할 값으로. 작품명·지역·지원 조건은 모든 배역에 똑같이 들어간다(일괄 적용). */
function roleInput(project: ProjectInput, conditions: ProjectConditions, role: RoleEdit): NewRole {
  return {
    projectTitle: project.title,
    title: role.title,
    description: role.description,
    requirement: role.requirement,
    shootDate: role.shootDates[0] ?? project.shootStart,
    shootDates: role.shootDates,
    shootMode: role.shootMode,
    roleType: role.roleType,
    gender: role.gender,
    ageMin: role.ageMin,
    ageMax: role.ageMax,
    headcount: role.headcount,
    specialScenes: role.specialScenes,
    specialNote: role.specialNote,
    location: project.location,
    ...conditions,
  };
}

export async function createProjectWithRoles(
  ownerId: string,
  project: ProjectInput,
  conditions: ProjectConditions,
  roles: RoleEdit[],
) {
  return transaction(async () => {
    const created = await insertProject(ownerId, project);
    const createdRoles = [];
    for (const role of roles)
      createdRoles.push(
        await createRole(roleInput(project, conditions, role), ownerId, created.id),
      );
    return { project: created, roles: createdRoles };
  });
}

/**
 * 프로젝트 수정 저장. 작품 정보·지원 조건·배역을 한 번에(트랜잭션) 바꾼다.
 * - 작품명·지역·지원 조건은 이 작품의 모든 배역에 일괄 반영한다.
 *   (예전에는 작품명을 바꿔도 배역에 복사된 작품명이 그대로여서 홈 카드가 어긋났다)
 * - id가 있는 배역은 수정, 없는 배역은 새로 만든다.
 *   저장된 배역은 지우지 않는다. 지원서·대화가 연결돼 있어서 접수 마감(isClosed)으로 대신한다.
 */
export async function updateProjectWithRoles(
  ownerId: string,
  projectId: string,
  project: ProjectInput,
  conditions: ProjectConditions,
  roles: RoleEdit[],
) {
  return transaction(async () => {
    await db()
      .prepare(
        `UPDATE projects SET ${PROJECT_COLUMNS.map((column) => `${column}=?`).join(',')}
        WHERE id=? AND owner_id=?`,
      )
      .run(...projectValues(project), projectId, ownerId);
    await db()
      .prepare(
        `UPDATE roles SET project_title=?,location=?,pay=?,deadline=?,contact_name=?,announcement_date=?
        WHERE project_id=?`,
      )
      .run(
        project.title,
        project.location,
        conditions.pay,
        conditions.deadline,
        conditions.contactName,
        conditions.announcementDate,
        projectId,
      );
    // 작품 촬영 일정을 따르는 배역은 기간이 바뀌면 날짜도 따라간다. (예전 하루짜리 배역은 제외)
    const projectDays = daysBetween(project.shootStart, project.shootEnd);
    await db()
      .prepare(
        `UPDATE roles SET shoot_dates=?, shoot_date=?
        WHERE project_id=? AND shoot_mode='all' AND shoot_dates <> '[]'`,
      )
      .run(JSON.stringify(projectDays), projectDays[0] ?? project.shootStart, projectId);

    const own = new Set((await listProjectRoles(projectId)).map((role) => role.id));
    for (const role of roles) {
      if (role.id) {
        // 다른 작품의 배역 id가 섞여 와도 건드리지 않는다.
        if (!own.has(role.id)) continue;
        await updateRole(role.id, {
          ...roleInput(project, conditions, role),
          ...(role.isClosed !== undefined ? { isClosed: role.isClosed } : {}),
        });
      } else {
        await createRole(roleInput(project, conditions, role), ownerId, projectId);
      }
    }
    return { project: (await getProject(projectId))!, roles: await listProjectRoles(projectId) };
  });
}

/** 프로젝트에 연결된 기록 수. 지울지 보관할지(projectRemovalMode) 정하고 확인 화면에 보여 준다. */
export type ProjectUsage = {
  roles: number;
  applications: number;
  proposals: number;
  /** 소유자를 뺀, 팀 보드에 초대된 팀원 수 */
  teamMembers: number;
};

export async function projectUsage(projectId: string): Promise<ProjectUsage> {
  const row = (await db()
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM roles WHERE project_id=?) roles,
        (SELECT COUNT(*) FROM applications a JOIN roles r ON r.id=a.role_id WHERE r.project_id=?) applications,
        (SELECT COUNT(*) FROM proposals pr JOIN roles r ON r.id=pr.role_id WHERE r.project_id=?) proposals,
        (SELECT COUNT(*) FROM team_members tm JOIN projects p ON p.id=tm.project_id
          WHERE tm.project_id=? AND tm.user_id<>p.owner_id) team_members`,
    )
    .get(projectId, projectId, projectId, projectId)) as Row;
  return {
    roles: Number(row.roles || 0),
    applications: Number(row.applications || 0),
    proposals: Number(row.proposals || 0),
    teamMembers: Number(row.team_members || 0),
  };
}

/**
 * 프로젝트 완전 삭제. 지원서·캐스팅 제안이 하나도 없는 프로젝트만 지운다(projectRemovalMode).
 * 확인과 삭제 사이에 지원이 들어오는 경우를 막으려고 트랜잭션 안에서 다시 센다.
 * - 지우는 것: 팀 보드 후보(투표·메모·이동 기록 포함), 팀원 초대, 배역 기록(events), 배역, 프로젝트
 * - 남기는 것: 일정(audition_events)과 비교 결과(compare_results)는 연결만 끊는다. 제작자가 직접 만든 기록이다.
 * 외래키에 CASCADE가 없어 deleteAccount처럼 자식 테이블부터 지운다.
 */
export async function deleteProject(
  ownerId: string,
  projectId: string,
): Promise<'deleted' | 'missing' | 'in_use'> {
  return transaction(async () => {
    const project = await getProject(projectId);
    if (!project || project.ownerId !== ownerId) return 'missing';
    const usage = await projectUsage(projectId);
    if (usage.applications > 0 || usage.proposals > 0) return 'in_use';
    const run = (sql: string) => db().prepare(sql).run(projectId);
    const roleIds = 'SELECT id FROM roles WHERE project_id=?';
    const candIds = 'SELECT id FROM project_candidates WHERE project_id=?';
    await run(`DELETE FROM candidate_votes WHERE candidate_id IN (${candIds})`);
    await run(`DELETE FROM candidate_notes WHERE candidate_id IN (${candIds})`);
    await run(`DELETE FROM board_moves WHERE candidate_id IN (${candIds})`);
    await run('DELETE FROM project_candidates WHERE project_id=?');
    await run('DELETE FROM team_members WHERE project_id=?');
    await run('UPDATE audition_events SET project_id=NULL WHERE project_id=?');
    await run(`UPDATE compare_results SET role_id=NULL WHERE role_id IN (${roleIds})`);
    await run(`DELETE FROM events WHERE role_id IN (${roleIds})`);
    await run('DELETE FROM roles WHERE project_id=?');
    await run('DELETE FROM projects WHERE id=?');
    return 'deleted';
  });
}

/**
 * 프로젝트 보관(숨김)·다시 꺼내기. 지원자가 있는 프로젝트는 지우지 않고 보관한다.
 * - 보관: 모든 배역 접수를 마감하고, 제작자 목록·팀 보드에서 숨긴다. 배우의 지원 현황·대화는 그대로다.
 * - 다시 꺼내기: 목록에 다시 보인다. 배역은 마감 상태로 두고, 수정 화면에서 다시 열 수 있다.
 */
export async function setProjectArchived(ownerId: string, projectId: string, archived: boolean) {
  return transaction(async () => {
    const result = await db()
      .prepare('UPDATE projects SET archived_at=? WHERE id=? AND owner_id=?')
      .run(archived ? new Date().toISOString() : null, projectId, ownerId);
    if (result.changes === 0) return null;
    if (archived)
      await db().prepare('UPDATE roles SET is_closed=1 WHERE project_id=?').run(projectId);
    return (await getProject(projectId))!;
  });
}

const PROPOSAL_SELECT = `SELECT pr.*, pu.name producer_name, pu.org_name, au.name actor_name,
  r.slug role_slug, r.title role_title, r.project_title
  FROM proposals pr
  JOIN users pu ON pu.id=pr.producer_id
  JOIN users au ON au.id=pr.actor_id
  JOIN roles r ON r.id=pr.role_id`;

function proposalFromRow(row: Row): Proposal {
  return {
    id: String(row.id),
    producerId: String(row.producer_id),
    producerName: String(row.producer_name),
    orgName: String(row.org_name),
    actorId: String(row.actor_id),
    actorName: String(row.actor_name),
    roleId: String(row.role_id),
    roleSlug: String(row.role_slug),
    roleTitle: String(row.role_title),
    projectTitle: String(row.project_title),
    message: String(row.message),
    status: row.status as Proposal['status'],
    createdAt: String(row.created_at),
  };
}

export async function createProposal(
  producerId: string,
  actorId: string,
  roleId: string,
  message: string,
) {
  const role = await getRoleById(roleId);
  if (!role || role.ownerId !== producerId) return { error: '배역을 찾을 수 없습니다.' } as const;
  const actor = await getUserById(actorId);
  if (!actor || actor.role !== 'actor') return { error: '배우를 찾을 수 없습니다.' } as const;
  const existing = await db()
    .prepare('SELECT id FROM proposals WHERE actor_id=? AND role_id=?')
    .get(actorId, roleId);
  if (existing) return { error: '이미 이 배역으로 제안을 보냈습니다.' } as const;
  const id = randomUUID();
  await db()
    .prepare(
      'INSERT INTO proposals (id,producer_id,actor_id,role_id,message,created_at) VALUES (?,?,?,?,?,?)',
    )
    .run(id, producerId, actorId, roleId, message, new Date().toISOString());
  return { proposal: (await getProposal(id))! } as const;
}

export async function getProposal(id: string) {
  const row = await db().prepare(`${PROPOSAL_SELECT} WHERE pr.id=?`).get(id);
  return row ? proposalFromRow(row as Row) : null;
}

export async function listActorProposals(actorId: string) {
  return (
    await db()
      .prepare(`${PROPOSAL_SELECT} WHERE pr.actor_id=? ORDER BY pr.created_at DESC`)
      .all(actorId)
  ).map((row) => proposalFromRow(row as Row));
}

export async function listProducerProposals(producerId: string, actorId: string) {
  return (
    await db()
      .prepare(`${PROPOSAL_SELECT} WHERE pr.producer_id=? AND pr.actor_id=?`)
      .all(producerId, actorId)
  ).map((row) => proposalFromRow(row as Row));
}

export async function setProposalStatus(
  id: string,
  actorId: string,
  status: 'accepted' | 'declined',
) {
  const result = await db()
    .prepare("UPDATE proposals SET status=? WHERE id=? AND actor_id=? AND status='sent'")
    .run(status, id, actorId);
  return result.changes > 0;
}

/**
 * 회원 탈퇴: 계정과 그 계정에 묶인 개인정보를 모두 지운다.
 * - 배우: 프로필, 낸 지원서(대화·투표·메모 포함), 받은 제안, 후보 등록
 * - 제작자: 프로젝트·배역과 거기에 들어온 지원서 전체, 팀 보드 기록, 일정, 비교 결과
 * 외래키에 CASCADE가 없어 자식 테이블부터 순서대로 지운다.
 */
export async function deleteAccount(userId: string) {
  const files: string[] = [];
  await transaction(async () => {
    const run = (sql: string, count: number) =>
      db()
        .prepare(sql)
        .run(...Array(count).fill(userId));
    const roleIds = 'SELECT id FROM roles WHERE owner_id=?'; // 1
    const projectIds = 'SELECT id FROM projects WHERE owner_id=?'; // 1
    const appIds = `SELECT id FROM applications WHERE actor_id=? OR role_id IN (${roleIds})`; // 2
    const candIds = `SELECT id FROM project_candidates
      WHERE actor_id=? OR added_by=? OR project_id IN (${projectIds})`; // 3

    const profile = (await db()
      .prepare('SELECT photos, documents FROM actor_profiles WHERE user_id=?')
      .get(userId)) as { photos: string; documents: string } | undefined;
    if (profile) {
      files.push(...(JSON.parse(profile.photos || '[]') as string[]));
      files.push(
        ...(JSON.parse(profile.documents || '[]') as { url: string }[]).map((doc) => doc.url),
      );
    }
    const posters = (await db()
      .prepare("SELECT poster_url FROM projects WHERE owner_id=? AND poster_url<>''")
      .all(userId)) as { poster_url: string }[];
    files.push(...posters.map((row) => row.poster_url));
    const apps = (await db()
      .prepare(`SELECT photo_url, photo_urls FROM applications WHERE id IN (${appIds})`)
      .all(userId, userId)) as { photo_url: string; photo_urls: string }[];
    for (const app of apps)
      files.push(app.photo_url, ...(JSON.parse(app.photo_urls || '[]') as string[]));
    // 대화에 주고받은 첨부 파일도 같은 저장소(uploads/)에 있다.
    const chatFiles = (await db()
      .prepare(
        `SELECT file_key FROM chat_messages WHERE application_id IN (${appIds}) AND file_key<>''`,
      )
      .all(userId, userId)) as { file_key: string }[];
    files.push(...chatFiles.map((row) => `/api/uploads/${row.file_key}`));

    await run(`DELETE FROM candidate_votes WHERE user_id=? OR candidate_id IN (${candIds})`, 4);
    await run(`DELETE FROM candidate_notes WHERE user_id=? OR candidate_id IN (${candIds})`, 4);
    await run(
      `DELETE FROM board_moves WHERE user_id=? OR candidate_id IN (${candIds}) OR application_id IN (${appIds})`,
      6,
    );
    await run(`DELETE FROM project_candidates WHERE id IN (${candIds})`, 3);
    await run(`DELETE FROM board_votes WHERE user_id=? OR application_id IN (${appIds})`, 3);
    await run(`DELETE FROM board_notes WHERE user_id=? OR application_id IN (${appIds})`, 3);
    await run(`DELETE FROM chat_messages WHERE application_id IN (${appIds})`, 2);
    await run(`DELETE FROM audition_events WHERE owner_id=? OR application_id IN (${appIds})`, 3);
    await run(
      `DELETE FROM events WHERE role_id IN (${roleIds}) OR application_id IN (${appIds})`,
      3,
    );
    await run(`DELETE FROM applications WHERE id IN (${appIds})`, 2);
    await run(
      `DELETE FROM proposals WHERE producer_id=? OR actor_id=? OR role_id IN (${roleIds})`,
      3,
    );
    await run('DELETE FROM favorites WHERE producer_id=? OR actor_id=?', 2);
    await run('DELETE FROM compare_results WHERE owner_id=?', 1);
    await run(`DELETE FROM team_members WHERE user_id=? OR project_id IN (${projectIds})`, 2);
    await run('DELETE FROM roles WHERE owner_id=?', 1);
    await run('DELETE FROM projects WHERE owner_id=?', 1);
    await run('DELETE FROM password_resets WHERE user_id=?', 1);
    await run('DELETE FROM actor_profiles WHERE user_id=?', 1);
    await run('DELETE FROM users WHERE id=?', 1);
  });
  await deleteUploads(files.filter(Boolean));
}
