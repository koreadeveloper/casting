import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID, randomBytes } from 'node:crypto';
import type { Application, Audition, ChatMessage, PublicStage, ReviewStatus, Role } from './types';
import { projectCover, splitLocation } from './project-meta';
import { resultDueDate } from './result-deadline';
import { matchesRoleFilters, sortRoleListings, type RoleFilters } from './role-search';
import { MESSAGE_PREVIEW_SQL } from './chat-files';
import { attendanceMessage, type AttendanceCheck, type AttendanceStatus } from './attendance';
import { schoolDomainRows } from './school-domains';
import { conn as rawConnection, withAdvisoryLock, type Conn, type Statement } from './sql';

// 스키마 생성은 프로세스당 한 번만, 다른 인스턴스와 겹치지 않게 실행한다.
const SCHEMA_LOCK = 7313002;
let ready: Promise<void> | undefined;
// 초기화(스키마) 도중의 쿼리는 초기화가 끝나기를 기다리면 교착되므로 곧바로 실행한다.
const initializing = new AsyncLocalStorage<true>();

async function setup() {
  try {
    await initializing.run(true, () =>
      withAdvisoryLock(SCHEMA_LOCK, () => initialize(rawConnection)),
    );
  } catch (error) {
    ready = undefined;
    throw error;
  }
}

function ensureReady() {
  ready ??= setup();
  return ready;
}

type GuardedStatement = Pick<Statement, 'get' | 'all' | 'run'>;

// 첫 쿼리 전에 스키마가 준비되도록 모든 호출이 ensureReady를 기다린다.
const guarded: Conn = {
  prepare(sql: string) {
    const statement = rawConnection.prepare(sql);
    const wrap = <K extends keyof GuardedStatement>(method: K): GuardedStatement[K] =>
      (async (...params: unknown[]) => {
        if (!initializing.getStore()) await ensureReady();
        return (statement[method] as (...args: unknown[]) => unknown)(...params);
      }) as GuardedStatement[K];
    return { get: wrap('get'), all: wrap('all'), run: wrap('run') } as Statement;
  },
  async exec(sql: string) {
    if (!initializing.getStore()) await ensureReady();
    return await rawConnection.exec(sql);
  },
};

function db(): Conn {
  return guarded;
}

async function initialize(database: Conn) {
  // 마지막으로 추가한 칸이 있으면 구조 변경을 건너뛴다. 칸을 새로 추가할 때는 이 기준도 그 칸으로 바꾼다.
  // (아래는 모두 '없을 때만 만들기/추가'라서 다시 실행돼도 안전하다)
  const migrated = await database
    .prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name='actor_profiles' AND column_name='birth_date'`,
    )
    .get();
  if (!migrated) {
    await database.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, project_title TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT NOT NULL, shoot_date TEXT NOT NULL,
      location TEXT NOT NULL, pay TEXT NOT NULL, deadline TEXT NOT NULL,
      contact_name TEXT NOT NULL, announcement_date TEXT NOT NULL,
      requirement TEXT NOT NULL, is_closed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id),
      name TEXT NOT NULL, age INTEGER, email TEXT NOT NULL, phone TEXT NOT NULL,
      introduction TEXT NOT NULL, photo_url TEXT NOT NULL, video_url TEXT NOT NULL,
      available TEXT NOT NULL, travel TEXT NOT NULL, pay_accepted TEXT NOT NULL,
      skill TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new',
      shortlist INTEGER NOT NULL DEFAULT 0, public_stage TEXT NOT NULL DEFAULT 'received',
      receipt_token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(role_id, email)
    );
    CREATE INDEX IF NOT EXISTS applications_role_status ON applications(role_id, status, created_at);
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, role_id TEXT NOT NULL, application_id TEXT,
      name TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id),
      sender TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL,
      slots TEXT NOT NULL DEFAULT '[]', place TEXT NOT NULL DEFAULT '',
      preparation TEXT NOT NULL DEFAULT '', selected_slot TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'sent', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chat_messages_app ON chat_messages(application_id, created_at);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
      org_type TEXT NOT NULL DEFAULT '', org_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS actor_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id), gender TEXT NOT NULL DEFAULT '',
      birth_year INTEGER, height INTEGER, weight INTEGER, region TEXT NOT NULL DEFAULT '',
      intro TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
      skills TEXT NOT NULL DEFAULT '[]', photos TEXT NOT NULL DEFAULT '[]',
      video_url TEXT NOT NULL DEFAULT '', filmography TEXT NOT NULL DEFAULT '[]',
      unavailable_dates TEXT NOT NULL DEFAULT '[]', is_public INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '', shoot_start TEXT NOT NULL DEFAULT '',
      shoot_end TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorites (
      producer_id TEXT NOT NULL REFERENCES users(id), actor_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL, PRIMARY KEY (producer_id, actor_id)
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY, producer_id TEXT NOT NULL REFERENCES users(id),
      actor_id TEXT NOT NULL REFERENCES users(id), role_id TEXT NOT NULL REFERENCES roles(id),
      message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sent', created_at TEXT NOT NULL,
      UNIQUE(actor_id, role_id)
    );
    CREATE TABLE IF NOT EXISTS team_members (
      project_id TEXT NOT NULL REFERENCES projects(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      member_role TEXT NOT NULL DEFAULT 'member',
      invited_at TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS board_votes (
      application_id TEXT NOT NULL REFERENCES applications(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (application_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS board_notes (
      id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id),
      user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS board_notes_app ON board_notes(application_id, created_at);
    CREATE TABLE IF NOT EXISTS compare_results (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, role_id TEXT, bracket_json TEXT NOT NULL,
      winner_label TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audition_events (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT, title TEXT NOT NULL, actor_name TEXT NOT NULL,
      starts_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled',
      note TEXT NOT NULL DEFAULT '', application_id TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audition_events_owner ON audition_events(owner_id, starts_at);
    CREATE TABLE IF NOT EXISTS project_candidates (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
      actor_id TEXT NOT NULL REFERENCES users(id), added_by TEXT NOT NULL REFERENCES users(id),
      column_key TEXT NOT NULL DEFAULT 'review', created_at TEXT NOT NULL,
      UNIQUE(project_id, actor_id)
    );
    CREATE TABLE IF NOT EXISTS candidate_votes (
      candidate_id TEXT NOT NULL REFERENCES project_candidates(id),
      user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
      PRIMARY KEY (candidate_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS candidate_notes (
      id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES project_candidates(id),
      user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS candidate_notes_app ON candidate_notes(candidate_id, created_at);
    -- 팀 보드의 단계는 팀 전체가 함께 보는 값이라, 누가 언제 옮겼는지 남겨 둬야
    -- '이 사람을 왜 보류로 뒀는지'를 팀원끼리 확인할 수 있다.
    CREATE TABLE IF NOT EXISTS board_moves (
      id TEXT PRIMARY KEY, application_id TEXT, candidate_id TEXT,
      user_id TEXT NOT NULL REFERENCES users(id),
      column_key TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS board_moves_app ON board_moves(application_id, created_at);
    CREATE INDEX IF NOT EXISTS board_moves_cand ON board_moves(candidate_id, created_at);
    -- 로그인·가입·재설정 요청의 시도 횟수 제한. key는 '종류:IP' 또는 '종류:이메일'.
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY, window_start BIGINT NOT NULL, count INTEGER NOT NULL
    );
    -- 비밀번호 재설정 링크. 토큰 원문은 메일로만 보내고 여기에는 해시만 둔다.
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
    );
  `);
    await addColumn(database, 'applications', 'chat_open', 'INTEGER NOT NULL DEFAULT 0');
    await addColumn(database, 'applications', 'actor_id', 'TEXT');
    // 배우가 공고마다 다른 사진으로 지원할 수 있게 고른 사진 전부를 담는다.
    // photo_url은 그중 대표 사진이고, 예전 지원서와의 호환을 위해 그대로 둔다.
    await addColumn(database, 'applications', 'photo_urls', "TEXT NOT NULL DEFAULT '[]'");
    await addColumn(database, 'roles', 'owner_id', 'TEXT');
    await addColumn(database, 'roles', 'project_id', 'TEXT');
    await addColumn(database, 'actor_profiles', 'agency', "TEXT NOT NULL DEFAULT ''");
    await addColumn(database, 'actor_profiles', 'documents', "TEXT NOT NULL DEFAULT '[]'");
    await addColumn(database, 'audition_events', 'place', "TEXT NOT NULL DEFAULT ''");
    await addColumn(database, 'audition_events', 'meeting_type', "TEXT NOT NULL DEFAULT ''");
    // 프로젝트 정보 세분화: 장르·제작 구분·분량·공개처·제작진·소개·지역·일정 단계·제공 항목.
    // 기존 칸은 그대로 둔다. genre 칸은 예전부터 '단편영화' 같은 '형식' 값을 담고 있어 형식으로 계속 쓴다.
    const text = "TEXT NOT NULL DEFAULT ''";
    const list = "TEXT NOT NULL DEFAULT '[]'";
    await addColumn(database, 'projects', 'genres', list);
    await addColumn(database, 'projects', 'production_type', text);
    await addColumn(database, 'projects', 'runtime', text);
    await addColumn(database, 'projects', 'release_channels', list);
    await addColumn(database, 'projects', 'release_period', text);
    await addColumn(database, 'projects', 'company', text);
    await addColumn(database, 'projects', 'director', text);
    await addColumn(database, 'projects', 'producer_name', text);
    await addColumn(database, 'projects', 'logline', text);
    await addColumn(database, 'projects', 'region', text);
    await addColumn(database, 'projects', 'audition_start', text);
    await addColumn(database, 'projects', 'audition_end', text);
    await addColumn(database, 'projects', 'prep_start', text);
    await addColumn(database, 'projects', 'prep_end', text);
    await addColumn(database, 'projects', 'shoot_sessions', 'INTEGER NOT NULL DEFAULT 0');
    await addColumn(database, 'projects', 'perks', list);
    // 배역 구조화: 비중·성별·연령대·모집 인원·배역별 촬영일.
    // shoot_dates가 빈 예전 배역은 shoot_date 하루짜리 배역으로 읽는다(roleFromRow).
    await addColumn(database, 'roles', 'role_type', text);
    await addColumn(database, 'roles', 'gender', text);
    await addColumn(database, 'roles', 'age_min', 'INTEGER NOT NULL DEFAULT 0');
    await addColumn(database, 'roles', 'age_max', 'INTEGER NOT NULL DEFAULT 0');
    await addColumn(database, 'roles', 'headcount', 'INTEGER NOT NULL DEFAULT 1');
    await addColumn(database, 'roles', 'shoot_mode', "TEXT NOT NULL DEFAULT 'all'");
    await addColumn(database, 'roles', 'shoot_dates', list);
    // 지원 현황 '미열람 → 검토 중': 제작진이 지원서를 처음 연 시각. 비어 있으면 미열람.
    await addColumn(database, 'applications', 'viewed_at', 'TEXT');
    // 특수 장면 안내(공고 필수 항목): 종류 목록과 구체적인 설명. ['none']이면 '특수 장면 없음'.
    await addColumn(database, 'roles', 'special_scenes', list);
    await addColumn(database, 'roles', 'special_note', text);
    // 프로젝트 보관(숨김): 보관한 시각. 비어 있으면 진행 중. 지원자가 있는 프로젝트는 지우지 않고 보관한다.
    await addColumn(database, 'projects', 'archived_at', 'TEXT');
    // 예전 자동 마감 기능이 불합격을 안내한 시각(과거 기록 보존용, 새로 채우지 않음). 제작진이 직접 정하면 비운다.
    await addColumn(database, 'applications', 'result_auto_at', 'TEXT');
    // 작품 포스터: /api/uploads/ 사진 주소. 비어 있으면 형식별 기본 커버(projectCover)를 쓴다.
    await addColumn(database, 'projects', 'poster_url', text);
    // 대화 첨부 파일: 저장소 이름(UUID.확장자)·원래 이름·크기·확장자. file_key가 비어 있으면 첨부 없음.
    await addColumn(database, 'chat_messages', 'file_key', text);
    await addColumn(database, 'chat_messages', 'file_name', text);
    await addColumn(database, 'chat_messages', 'file_size', 'INTEGER NOT NULL DEFAULT 0');
    await addColumn(database, 'chat_messages', 'file_ext', text);
    await database.exec(`
    -- 촬영 참석 재확인: 출연 확정된 배우가 촬영일마다 남긴 답(yes/no). 촬영 며칠 전부터 묻는다.
    CREATE TABLE IF NOT EXISTS attendance_checks (
      application_id TEXT NOT NULL REFERENCES applications(id), shoot_date TEXT NOT NULL,
      status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', responded_at TEXT NOT NULL,
      PRIMARY KEY (application_id, shoot_date)
    );
    -- 제작진 인증 신청·결과. kind: school(학교) | business(제작사), method: email | document.
    -- status: code_sent(학교 메일 확인 코드 보냄) | approved | rejected.
    -- 서류 원본은 저장하지 않는다(기획서: 인증 서류는 확인 후 파기). 판정 결과와 이유만 남긴다.
    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL, method TEXT NOT NULL, status TEXT NOT NULL,
      org_name TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      code_hash TEXT NOT NULL DEFAULT '', attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, decided_at TEXT, expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS verifications_user ON verifications(user_id, kind, created_at);
    -- 학교 메일 인증용 '메일 도메인 → 대학교 이름' 목록. 내용은 아래에서 school-domains.ts 값으로 채운다.
    -- aliases는 줄임말(서울대, 한예종 등)을 '|'로 이은 것.
    CREATE TABLE IF NOT EXISTS school_domains (
      domain TEXT PRIMARY KEY, school_name TEXT NOT NULL, aliases TEXT NOT NULL DEFAULT ''
    );
    -- 문의하기(/contact). kind: general | bug | privacy | report. 1년이 지난 문의는 새 문의가 들어올 때 지운다.
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, email TEXT NOT NULL,
      body TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    -- 구글·카카오 로그인 연결. subject는 제공자 안에서 바뀌지 않는 사용자 번호다.
    -- 소셜로만 가입한 계정은 users.password_hash가 빈 문자열이라 비밀번호로는 로그인되지 않는다.
    CREATE TABLE IF NOT EXISTS oauth_accounts (
      provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
      email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      PRIMARY KEY (provider, subject)
    );
    CREATE INDEX IF NOT EXISTS oauth_accounts_user ON oauth_accounts(user_id);
  `);
    // 배우 생년월일 'YYYY-MM-DD' (만 나이 계산용). 비어 있으면 예전처럼 birth_year만 쓴다.
    // 이 칸이 구조 변경 기준(맨 위 migrated)이라 반드시 마지막에 추가한다.
    await addColumn(database, 'actor_profiles', 'birth_date', text);
  }
  // 목록을 고쳤을 때 다음 시작에 반영된다. 한 번에 넣고, 이미 있는 도메인은 이름·줄임말만 갱신한다.
  const quote = (text: string) => `'${text.replace(/'/g, "''")}'`;
  await database.exec(
    `INSERT INTO school_domains (domain, school_name, aliases) VALUES ${schoolDomainRows()
      .map(
        (row) =>
          `(${quote(row.domain)}, ${quote(row.schoolName)}, ${quote(row.aliases.join('|'))})`,
      )
      .join(',')}
     ON CONFLICT (domain) DO UPDATE SET school_name = EXCLUDED.school_name, aliases = EXCLUDED.aliases`,
  );
}

async function addColumn(connection: Conn, table: string, column: string, definition: string) {
  await connection.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
}

export { db, ensureReady };

const ROLE_TYPE_VALUES = ['lead', 'supporting', 'minor', 'extra'];
const ROLE_GENDER_VALUES = ['male', 'female', 'any'];

function roleFromRow(row: Record<string, unknown>): Role {
  const dates = stringList(row.shoot_dates);
  // 배역별 촬영일이 생기기 전의 배역은 날짜가 shoot_date 하나뿐이다.
  // '일괄 적용'으로 읽으면 다음 저장 때 작품 기간으로 바뀌어 버리므로, 그 하루를 따로 지정한 것으로 본다.
  const legacy = dates.length === 0;
  const roleType = String(row.role_type ?? '');
  const gender = String(row.gender ?? '');
  return {
    id: String(row.id),
    slug: String(row.slug),
    projectTitle: String(row.project_title),
    title: String(row.title),
    description: String(row.description),
    shootDate: String(row.shoot_date),
    shootDates: legacy ? (row.shoot_date ? [String(row.shoot_date)] : []) : dates,
    shootMode: legacy || row.shoot_mode === 'custom' ? 'custom' : 'all',
    roleType: (ROLE_TYPE_VALUES.includes(roleType) ? roleType : '') as Role['roleType'],
    gender: (ROLE_GENDER_VALUES.includes(gender) ? gender : '') as Role['gender'],
    ageMin: Number(row.age_min || 0),
    ageMax: Number(row.age_max || 0),
    headcount: Math.max(1, Number(row.headcount || 1)),
    specialScenes: stringList(row.special_scenes),
    specialNote: String(row.special_note ?? ''),
    location: String(row.location),
    pay: String(row.pay),
    deadline: String(row.deadline),
    contactName: String(row.contact_name),
    announcementDate: String(row.announcement_date),
    requirement: String(row.requirement),
    isClosed: Boolean(row.is_closed),
    createdAt: String(row.created_at),
    applicationCount: Number(row.application_count || 0),
    newCount: Number(row.new_count || 0),
    shortlistCount: Number(row.shortlist_count || 0),
    pendingCount: Number(row.pending_count || 0),
    pendingShortlistCount: Number(row.pending_shortlist_count || 0),
    resultDueDate: resultDueDate(
      String(row.announcement_date),
      String(row.project_audition_end ?? ''),
    ),
    ownerId: row.owner_id ? String(row.owner_id) : null,
    projectId: row.project_id ? String(row.project_id) : null,
    coverUrl: projectCover(String(row.cover_format ?? ''), String(row.cover_poster ?? '')),
  };
}

/** JSON 문자열로 저장된 문자열 목록. 예전 행이나 깨진 값은 빈 목록으로 본다. */
function stringList(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function appFromRow(row: Record<string, unknown>): Application {
  const photoUrl = String(row.photo_url);
  const photoUrls = stringList(row.photo_urls);
  return {
    id: String(row.id),
    roleId: String(row.role_id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    name: String(row.name),
    age: row.age === null ? null : Number(row.age),
    email: String(row.email),
    phone: String(row.phone),
    introduction: String(row.introduction),
    photoUrl,
    // 사진을 여러 장 고르기 전에 들어온 지원서는 대표 사진 하나만 가지고 있다.
    photoUrls: photoUrls.length > 0 ? photoUrls : photoUrl ? [photoUrl] : [],
    videoUrl: String(row.video_url),
    available: String(row.available),
    travel: String(row.travel),
    payAccepted: String(row.pay_accepted),
    skill: String(row.skill),
    note: String(row.note),
    status: row.status as ReviewStatus,
    shortlist: Boolean(row.shortlist),
    chatOpen: Boolean(row.chat_open),
    publicStage: row.public_stage as PublicStage,
    viewedAt: row.viewed_at ? String(row.viewed_at) : null,
    resultAutoAt: row.result_auto_at ? String(row.result_auto_at) : null,
    receiptToken: String(row.receipt_token),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.role_title !== undefined ? { roleTitle: String(row.role_title) } : {}),
    ...(row.project_title !== undefined ? { projectTitle: String(row.project_title) } : {}),
    ...(row.last_body !== undefined && row.last_body !== null
      ? {
          lastMessage: String(row.last_body),
          lastMessageAt: String(row.last_at),
          lastMessageSender: row.last_sender as ChatMessage['sender'],
        }
      : {}),
    ...(row.unread !== undefined ? { unreadCount: Number(row.unread) } : {}),
    offerStatus:
      row.offer_status === undefined || row.offer_status === null
        ? null
        : (row.offer_status as ChatMessage['status']),
    ...(row.confirmed_slot !== undefined && row.confirmed_slot !== null
      ? { confirmedSlot: String(row.confirmed_slot) }
      : {}),
  };
}

const CHAT_SUMMARY = `
  (SELECT ${MESSAGE_PREVIEW_SQL('m')} FROM chat_messages m WHERE m.application_id=applications.id ORDER BY m.created_at DESC LIMIT 1) last_body,
  (SELECT m.created_at FROM chat_messages m WHERE m.application_id=applications.id ORDER BY m.created_at DESC LIMIT 1) last_at,
  (SELECT m.sender FROM chat_messages m WHERE m.application_id=applications.id ORDER BY m.created_at DESC LIMIT 1) last_sender,
  (SELECT COUNT(*) FROM chat_messages m WHERE m.application_id=applications.id AND m.sender='actor'
    AND m.created_at > COALESCE((SELECT MAX(p.created_at) FROM chat_messages p WHERE p.application_id=applications.id AND p.sender='producer'),'')) unread,
  (SELECT m.status FROM chat_messages m WHERE m.application_id=applications.id AND m.kind='offer' ORDER BY m.created_at DESC LIMIT 1) offer_status,
  (SELECT m.selected_slot FROM chat_messages m WHERE m.application_id=applications.id AND m.kind='offer' AND m.status='confirmed' ORDER BY m.created_at DESC LIMIT 1) confirmed_slot`;

// 작품 이미지(roleFromRow의 coverUrl)를 만들 형식·포스터. 배우 검색(searchOpenRoles)의 project_format과 이름이 겹치지 않게 cover_를 붙인다.
const ROLE_COVER = `(SELECT p.genre FROM projects p WHERE p.id=roles.project_id) cover_format,
      (SELECT p.poster_url FROM projects p WHERE p.id=roles.project_id) cover_poster`;

// 결과 전 지원자 수(pending)와 작품의 오디션 종료일은 결과 자동 안내 기준일·미리 알림에 쓴다.
const ROLE_STATS = `SELECT roles.*, COUNT(applications.id) application_count,
      SUM(CASE WHEN applications.status='new' THEN 1 ELSE 0 END) new_count,
      COALESCE(SUM(applications.shortlist),0) shortlist_count,
      SUM(CASE WHEN applications.public_stage='received' THEN 1 ELSE 0 END) pending_count,
      SUM(CASE WHEN applications.public_stage='received' THEN applications.shortlist ELSE 0 END) pending_shortlist_count,
      (SELECT p.audition_end FROM projects p WHERE p.id=roles.project_id) project_audition_end,
      ${ROLE_COVER}
      FROM roles
    LEFT JOIN applications ON applications.role_id=roles.id`;

/** 보관한 프로젝트의 배역. 제작자 목록·배우 모집 목록에서 뺀다. */
const IN_ARCHIVED_PROJECT = `EXISTS (SELECT 1 FROM projects ap WHERE ap.id=roles.project_id AND ap.archived_at IS NOT NULL)`;

/** 제작자의 배역 목록(보관한 프로젝트 제외). 스튜디오 홈·추천·비교·제안 화면이 쓴다. */
export async function listRoles(ownerId: string) {
  return (
    await db()
      .prepare(
        `${ROLE_STATS} WHERE roles.owner_id=? AND NOT ${IN_ARCHIVED_PROJECT}
        GROUP BY roles.id ORDER BY roles.created_at DESC`,
      )
      .all(ownerId)
  ).map((row) => roleFromRow(row as Record<string, unknown>));
}

/** 한 작품의 배역들(만든 순서대로). 프로젝트 수정 화면에서 배역을 함께 고칠 때 쓴다. */
export async function listProjectRoles(projectId: string) {
  return (
    await db()
      .prepare(
        `${ROLE_STATS} WHERE roles.project_id=? GROUP BY roles.id ORDER BY roles.created_at ASC`,
      )
      .all(projectId)
  ).map((row) => roleFromRow(row as Record<string, unknown>));
}

const OPEN_ROLES = `${ROLE_STATS} WHERE roles.is_closed=0 AND roles.deadline>=? AND NOT ${IN_ARCHIVED_PROJECT}
  GROUP BY roles.id`;

export async function listOpenRoles(today: string) {
  return (await db().prepare(`${OPEN_ROLES} ORDER BY roles.created_at DESC`).all(today)).map(
    (row) => roleFromRow(row as Record<string, unknown>),
  );
}

/** 배우 검색에 쓰는 모집 중 배역: 배역 정보 + 작품의 형식·장르·촬영 지역(시·도). */
export type OpenRoleListing = Role & {
  projectFormat: string;
  projectGenres: string[];
  projectRegion: string;
};

/**
 * 배우의 배역 검색. 모집 중 배역을 작품 정보와 함께 읽고 검색 조건(role-search.ts)으로 거른다.
 * all은 거르기 전 전체 목록이다(추천 공고·'전체 N개' 표시용).
 * unavailableDates는 '내 출연 불가일 피하기'를 켰을 때 뺄 날짜(로그인한 배우의 프로필).
 */
export async function searchOpenRoles(
  today: string,
  filters: RoleFilters,
  unavailableDates: string[] = [],
) {
  const rows = await db()
    .prepare(
      `SELECT s.*, p.genre project_format, p.genres project_genres, p.region project_region
      FROM (${OPEN_ROLES}) s LEFT JOIN projects p ON p.id=s.project_id
      ORDER BY s.created_at DESC`,
    )
    .all(today);
  const all: OpenRoleListing[] = rows.map((row) => {
    const role = roleFromRow(row);
    return {
      ...role,
      projectFormat: String(row.project_format ?? ''),
      projectGenres: stringList(row.project_genres),
      // 시·도 칸이 생기기 전 프로젝트는 촬영 지역 글자에서 시·도를 추정한다.
      projectRegion: splitLocation(role.location, String(row.project_region ?? '')).region,
    };
  });
  return {
    all,
    roles: sortRoleListings(
      all.filter((listing) => matchesRoleFilters(listing, filters, unavailableDates)),
      filters.sort,
    ),
  };
}

export async function getRole(slug: string) {
  const row = await db().prepare(`${ROLE_STATS} WHERE roles.slug=? GROUP BY roles.id`).get(slug);
  return row ? roleFromRow(row as Record<string, unknown>) : null;
}

export async function getRoleById(id: string) {
  const row = await db()
    .prepare(
      `SELECT roles.*, (SELECT p.audition_end FROM projects p WHERE p.id=roles.project_id) project_audition_end,
      ${ROLE_COVER}
      FROM roles WHERE id=?`,
    )
    .get(id);
  return row ? roleFromRow(row as Record<string, unknown>) : null;
}

/** 배역을 구조화하는 칸. 넘기지 않으면 기본값이 들어간다(예전 '배역 빠르게 추가' API 등). */
export type RoleDetails = Pick<
  Role,
  | 'shootDates'
  | 'shootMode'
  | 'roleType'
  | 'gender'
  | 'ageMin'
  | 'ageMax'
  | 'headcount'
  | 'specialScenes'
  | 'specialNote'
>;

export type NewRole = Pick<
  Role,
  | 'projectTitle'
  | 'title'
  | 'description'
  | 'shootDate'
  | 'location'
  | 'pay'
  | 'deadline'
  | 'contactName'
  | 'announcementDate'
  | 'requirement'
> &
  Partial<RoleDetails>;

export async function createRole(input: NewRole, ownerId: string | null, projectId: string | null) {
  const id = randomUUID();
  const slug = randomBytes(8).toString('hex');
  const now = new Date().toISOString();
  // 날짜 목록 없이 하루만 넘기면 그 하루를 따로 지정한 배역으로 저장한다.
  const shootDates = input.shootDates?.length
    ? input.shootDates
    : input.shootDate
      ? [input.shootDate]
      : [];
  await db()
    .prepare(
      `INSERT INTO roles (id,slug,owner_id,project_id,project_title,title,description,shoot_date,location,pay,deadline,contact_name,announcement_date,requirement,created_at,
        role_type,gender,age_min,age_max,headcount,shoot_mode,shoot_dates,special_scenes,special_note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      slug,
      ownerId,
      projectId,
      input.projectTitle,
      input.title,
      input.description,
      shootDates[0] ?? input.shootDate,
      input.location,
      input.pay,
      input.deadline,
      input.contactName,
      input.announcementDate,
      input.requirement,
      now,
      input.roleType ?? '',
      input.gender ?? '',
      input.ageMin ?? 0,
      input.ageMax ?? 0,
      input.headcount ?? 1,
      input.shootMode ?? 'custom',
      JSON.stringify(shootDates),
      JSON.stringify(input.specialScenes ?? []),
      input.specialNote ?? '',
    );
  await recordEvent(id, null, 'role_published');
  return (await getRole(slug))!;
}

export async function updateRole(id: string, input: Partial<Role>) {
  const current = await getRoleById(id);
  if (!current) return null;
  // 예전 API처럼 shootDate 하루만 바꾸면 그 하루를 따로 지정한 것으로 본다.
  const onlyOneDay = input.shootDate !== undefined && input.shootDates === undefined;
  const shootDates = input.shootDates ?? (onlyOneDay ? [input.shootDate!] : current.shootDates);
  const shootMode = input.shootMode ?? (onlyOneDay ? 'custom' : current.shootMode);
  await db()
    .prepare(
      `UPDATE roles SET project_title=?,title=?,description=?,shoot_date=?,location=?,pay=?,deadline=?,contact_name=?,announcement_date=?,requirement=?,is_closed=?,
        role_type=?,gender=?,age_min=?,age_max=?,headcount=?,shoot_mode=?,shoot_dates=?,special_scenes=?,special_note=?
        WHERE id=?`,
    )
    .run(
      input.projectTitle ?? current.projectTitle,
      input.title ?? current.title,
      input.description ?? current.description,
      shootDates[0] ?? current.shootDate,
      input.location ?? current.location,
      input.pay ?? current.pay,
      input.deadline ?? current.deadline,
      input.contactName ?? current.contactName,
      input.announcementDate ?? current.announcementDate,
      input.requirement ?? current.requirement,
      Number(input.isClosed ?? current.isClosed),
      input.roleType ?? current.roleType,
      input.gender ?? current.gender,
      input.ageMin ?? current.ageMin,
      input.ageMax ?? current.ageMax,
      input.headcount ?? current.headcount,
      shootMode,
      JSON.stringify(shootDates),
      JSON.stringify(input.specialScenes ?? current.specialScenes),
      input.specialNote ?? current.specialNote,
      id,
    );
  return await getRole(current.slug);
}

export async function listApplications(roleId: string) {
  return (
    await db()
      .prepare(
        `SELECT applications.*, ${CHAT_SUMMARY} FROM applications WHERE role_id=? ORDER BY created_at DESC`,
      )
      .all(roleId)
  ).map((row) => appFromRow(row as Record<string, unknown>));
}

export async function listRecentApplications(ownerId: string, limit = 8) {
  return (
    await db()
      .prepare(
        `SELECT applications.*, roles.title role_title, roles.project_title, ${CHAT_SUMMARY}
      FROM applications JOIN roles ON roles.id=applications.role_id
      WHERE roles.owner_id=?
      ORDER BY applications.created_at DESC LIMIT ?`,
      )
      .all(ownerId, limit)
  ).map((row) => appFromRow(row as Record<string, unknown>));
}

export async function listActorApplications(actorId: string) {
  return (
    await db()
      .prepare(
        `SELECT applications.*, roles.title role_title, roles.project_title, roles.announcement_date,
        (SELECT p.audition_end FROM projects p WHERE p.id=roles.project_id) project_audition_end
      FROM applications JOIN roles ON roles.id=applications.role_id
      WHERE applications.actor_id=? ORDER BY applications.created_at DESC`,
      )
      .all(actorId)
  ).map((row) => {
    const item = row as Record<string, unknown>;
    // 결과 기준일을 함께 넘겨 배우 목록에서도 '결과 안내 지연'을 보여 줄 수 있게 한다.
    return {
      ...appFromRow(item),
      resultDueDate: resultDueDate(
        String(item.announcement_date ?? ''),
        String(item.project_audition_end ?? ''),
      ),
    };
  });
}

/**
 * 로그인하지 않고 낸 지원서를 계정에 붙인다.
 *
 * 로그아웃 상태로 지원하면 actor_id 없이 이메일만 남아서, 나중에 같은 이메일로 로그인해도
 * '내 지원 현황'에 나오지 않고 접수 링크도 이 브라우저에서만 찾을 수 있었다.
 *
 * 방금 이 이메일로 비밀번호 인증을 통과한 사람만 호출한다 (로그인·가입 직후).
 * 이미 주인이 있는 지원서(actor_id가 찬 것)는 건드리지 않는다.
 */
export async function claimApplications(actorId: string, email: string) {
  const result = await db()
    .prepare('UPDATE applications SET actor_id=? WHERE actor_id IS NULL AND email=?')
    .run(actorId, email.toLowerCase());
  return Number(result.changes);
}

export async function roleOwnedBy(roleId: string, ownerId: string) {
  return Boolean(
    await db().prepare('SELECT 1 FROM roles WHERE id=? AND owner_id=?').get(roleId, ownerId),
  );
}

export async function applicationOwnedBy(applicationId: string, ownerId: string) {
  return Boolean(
    await db()
      .prepare(
        'SELECT 1 FROM applications a JOIN roles r ON r.id=a.role_id WHERE a.id=? AND r.owner_id=?',
      )
      .get(applicationId, ownerId),
  );
}

export async function listUpcomingAuditions(ownerId: string, now: string): Promise<Audition[]> {
  return (
    await db()
      .prepare(
        `SELECT m.selected_slot slot, m.place, a.id application_id, a.name, a.photo_url,
      r.id role_id, r.title role_title, r.project_title
      FROM chat_messages m
      JOIN applications a ON a.id=m.application_id
      JOIN roles r ON r.id=a.role_id
      WHERE r.owner_id=? AND m.kind='offer' AND m.status='confirmed' AND m.selected_slot >= ?
      ORDER BY m.selected_slot ASC`,
      )
      .all(ownerId, now)
  ).map((row) => ({
    applicationId: String((row as Record<string, unknown>).application_id),
    roleId: String((row as Record<string, unknown>).role_id),
    name: String((row as Record<string, unknown>).name),
    photoUrl: String((row as Record<string, unknown>).photo_url),
    roleTitle: String((row as Record<string, unknown>).role_title),
    projectTitle: String((row as Record<string, unknown>).project_title),
    slot: String((row as Record<string, unknown>).slot),
    place: String((row as Record<string, unknown>).place),
  }));
}

export async function getApplication(id: string) {
  const row = await db().prepare('SELECT * FROM applications WHERE id=?').get(id);
  return row ? appFromRow(row as Record<string, unknown>) : null;
}

export async function getApplicationByReceipt(token: string) {
  const row = await db().prepare('SELECT * FROM applications WHERE receipt_token=?').get(token);
  return row ? appFromRow(row as Record<string, unknown>) : null;
}

export type NewApplication = Pick<
  Application,
  | 'name'
  | 'age'
  | 'email'
  | 'phone'
  | 'introduction'
  | 'photoUrl'
  | 'photoUrls'
  | 'videoUrl'
  | 'available'
  | 'travel'
  | 'payAccepted'
  | 'skill'
>;

export async function createApplication(
  roleId: string,
  input: NewApplication,
  actorId: string | null = null,
) {
  const id = randomUUID();
  const receipt = randomBytes(24).toString('hex');
  const now = new Date().toISOString();
  await db()
    .prepare(
      `INSERT INTO applications (id,role_id,actor_id,name,age,email,phone,introduction,photo_url,photo_urls,video_url,available,travel,pay_accepted,skill,receipt_token,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      roleId,
      actorId,
      input.name,
      input.age,
      input.email.toLowerCase(),
      input.phone,
      input.introduction,
      input.photoUrl,
      JSON.stringify(input.photoUrls),
      input.videoUrl,
      input.available,
      input.travel,
      input.payAccepted,
      input.skill,
      receipt,
      now,
      now,
    );
  await recordEvent(roleId, id, 'application_submitted');
  return (await getApplication(id))!;
}

export async function reviewApplication(
  id: string,
  input: { status?: ReviewStatus; note?: string; shortlist?: boolean; publicStage?: PublicStage },
) {
  const current = await getApplication(id);
  if (!current) return null;
  const now = new Date().toISOString();
  // 분류·메모·결과를 바꿨다면 지원서를 본 것이므로 열람 시각도 함께 남긴다(처음 한 번만).
  // 제작진이 결과를 직접 정하면 더 이상 '자동 안내'가 아니다.
  await db()
    .prepare(
      `UPDATE applications SET status=?,note=?,shortlist=?,public_stage=?,result_auto_at=?,updated_at=?,
        viewed_at=COALESCE(viewed_at,?) WHERE id=?`,
    )
    .run(
      input.status ?? current.status,
      input.note ?? current.note,
      Number(input.shortlist ?? current.shortlist),
      input.publicStage ?? current.publicStage,
      input.publicStage ? null : current.resultAutoAt,
      now,
      now,
      id,
    );
  if (input.status && input.status !== current.status)
    await recordEvent(current.roleId, id, 'review_status_changed');
  if (input.shortlist !== undefined && input.shortlist !== current.shortlist)
    await recordEvent(current.roleId, id, 'shortlist_changed');
  if (input.publicStage && input.publicStage !== current.publicStage)
    await recordEvent(current.roleId, id, 'public_result_confirmed');
  return (await getApplication(id))!;
}

/**
 * 제작진이 지원서를 처음 열었을 때 열람 시각을 남긴다. 배우에게는 '미열람 → 검토 중'으로 보인다.
 * 이미 열람한 지원서는 그대로 둔다. 바뀌었으면 true.
 */
export async function markApplicationViewed(id: string) {
  const result = await db()
    .prepare('UPDATE applications SET viewed_at=? WHERE id=? AND viewed_at IS NULL')
    .run(new Date().toISOString(), id);
  return result.changes > 0;
}

// 결과 기준일이 지나도 결과를 자동으로 정하거나 공개하지 않는다(예전 자동 불합격 처리는 없앴다).
// 배우 화면의 '결과 안내 지연' 표시는 result-deadline.ts의 isResultDelayed,
// 제작진의 결과 입력 요청은 activity.ts의 결과 알림이 맡는다. 결과는 updateApplication으로만 바뀐다.

export async function recordEvent(roleId: string, applicationId: string | null, name: string) {
  await db()
    .prepare('INSERT INTO events (id,role_id,application_id,name,created_at) VALUES (?,?,?,?,?)')
    .run(randomUUID(), roleId, applicationId, name, new Date().toISOString());
}

function messageFromRow(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    applicationId: String(row.application_id),
    sender: row.sender as ChatMessage['sender'],
    kind: row.kind as ChatMessage['kind'],
    body: String(row.body),
    slots: JSON.parse(String(row.slots)) as string[],
    place: String(row.place),
    preparation: String(row.preparation),
    selectedSlot: String(row.selected_slot),
    status: row.status as ChatMessage['status'],
    createdAt: String(row.created_at),
    attachment: row.file_key
      ? {
          key: String(row.file_key),
          name: String(row.file_name),
          size: Number(row.file_size) || 0,
          ext: String(row.file_ext),
        }
      : null,
  };
}

/** 이 지원서의 대화에 실제로 올라온 파일인지 확인하고 정보를 돌려준다. */
export async function findChatAttachment(applicationId: string, key: string) {
  const row = await db()
    .prepare('SELECT * FROM chat_messages WHERE application_id=? AND file_key=? LIMIT 1')
    .get(applicationId, key);
  return row ? messageFromRow(row as Record<string, unknown>).attachment : null;
}

export async function getLatestOffer(applicationId: string) {
  const row = await db()
    .prepare(
      "SELECT * FROM chat_messages WHERE application_id=? AND kind='offer' ORDER BY created_at DESC LIMIT 1",
    )
    .get(applicationId);
  return row ? messageFromRow(row as Record<string, unknown>) : null;
}

export async function listChatMessages(applicationId: string) {
  return (
    await db()
      .prepare('SELECT * FROM chat_messages WHERE application_id=? ORDER BY created_at ASC')
      .all(applicationId)
  ).map((row) => messageFromRow(row as Record<string, unknown>));
}

export async function getChatMessage(id: string) {
  const row = await db().prepare('SELECT * FROM chat_messages WHERE id=?').get(id);
  return row ? messageFromRow(row as Record<string, unknown>) : null;
}

export async function sendChatMessage(
  applicationId: string,
  input: Pick<ChatMessage, 'sender' | 'kind' | 'body' | 'slots' | 'place' | 'preparation'> & {
    attachment?: ChatMessage['attachment'];
  },
) {
  const application = await getApplication(applicationId);
  if (!application) return null;
  const id = randomUUID();
  const file = input.attachment;
  await db()
    .prepare(
      `INSERT INTO chat_messages (id,application_id,sender,kind,body,slots,place,preparation,created_at,
      file_key,file_name,file_size,file_ext)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      applicationId,
      input.sender,
      input.kind,
      input.body,
      JSON.stringify(input.slots),
      input.place,
      input.preparation,
      new Date().toISOString(),
      file?.key ?? '',
      file?.name ?? '',
      file?.size ?? 0,
      file?.ext ?? '',
    );
  if (input.sender === 'producer')
    await db().prepare('UPDATE applications SET chat_open=1 WHERE id=?').run(applicationId);
  await recordEvent(
    application.roleId,
    applicationId,
    input.kind === 'offer' ? 'audition_offer_sent' : 'chat_message_sent',
  );
  return (await getChatMessage(id))!;
}

export async function respondToOffer(
  messageId: string,
  action: 'select' | 'decline' | 'request_change' | 'confirm',
  selectedSlot = '',
) {
  const message = await getChatMessage(messageId);
  if (!message || message.kind !== 'offer') return null;
  if (action === 'select' && message.status === 'sent' && message.slots.includes(selectedSlot)) {
    await db()
      .prepare("UPDATE chat_messages SET status='selected',selected_slot=? WHERE id=?")
      .run(selectedSlot, messageId);
  } else if (action === 'decline' && message.status === 'sent') {
    await db().prepare("UPDATE chat_messages SET status='declined' WHERE id=?").run(messageId);
  } else if (action === 'request_change' && message.status === 'sent') {
    await db()
      .prepare("UPDATE chat_messages SET status='change_requested' WHERE id=?")
      .run(messageId);
  } else if (action === 'confirm' && message.status === 'selected') {
    await db().prepare("UPDATE chat_messages SET status='confirmed' WHERE id=?").run(messageId);
  } else return null;
  const application = (await getApplication(message.applicationId))!;
  await recordEvent(application.roleId, application.id, `audition_offer_${action}`);
  return (await getChatMessage(messageId))!;
}

function attendanceFromRow(row: Record<string, unknown>): AttendanceCheck {
  return {
    applicationId: String(row.application_id),
    shootDate: String(row.shoot_date),
    status: row.status === 'no' ? 'no' : 'yes',
    note: String(row.note ?? ''),
    respondedAt: String(row.responded_at),
  };
}

/** 이 지원서(출연 확정)의 촬영일별 참석 답 */
export async function listAttendance(applicationId: string) {
  return (
    await db()
      .prepare('SELECT * FROM attendance_checks WHERE application_id=? ORDER BY shoot_date')
      .all(applicationId)
  ).map((row) => attendanceFromRow(row as Record<string, unknown>));
}

/** 배우가 촬영 참석 여부를 답한다. 같은 날짜에 다시 답하면 바꾼다. 대화에도 남겨 제작진이 바로 본다. */
export async function recordAttendance(
  application: Application,
  shootDate: string,
  status: AttendanceStatus,
  note: string,
) {
  const now = new Date().toISOString();
  await db()
    .prepare(
      `INSERT INTO attendance_checks (application_id,shoot_date,status,note,responded_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT (application_id, shoot_date)
       DO UPDATE SET status=excluded.status, note=excluded.note, responded_at=excluded.responded_at`,
    )
    .run(application.id, shootDate, status, note, now);
  await sendChatMessage(application.id, {
    sender: 'actor',
    kind: 'text',
    body: attendanceMessage(shootDate, status, note),
    slots: [],
    place: '',
    preparation: '',
  });
  await recordEvent(application.roleId, application.id, `attendance_${status}`);
  return attendanceFromRow({
    application_id: application.id,
    shoot_date: shootDate,
    status,
    note,
    responded_at: now,
  });
}
