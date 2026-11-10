// 화면 그리기만 한다(데이터는 page.tsx가 읽어서 넘긴다). 확인용으로 따로 그려 볼 수 있게 나눠 둔다.
import Link from 'next/link';
import type { MemberDetail } from '@/lib/admin';
import { ADMIN_ACTIONS, type AdminLog } from '@/lib/admin-log';
import { METHOD_LABEL } from '@/lib/admin-rules';
import { formatDateTime, formatDay } from '../../format';
import MemberActions from './member-actions';

const ROLE_LABEL = { producer: '제작진', actor: '배우' } as const;
const STAGE_LABEL: Record<string, string> = {
  received: '접수',
  audition: '오디션',
  not_selected: '불합격',
  cast: '출연 확정',
};
const PROPOSAL_LABEL: Record<string, string> = {
  sent: '보냄',
  accepted: '수락',
  declined: '거절',
};
const VERIFY_STATUS: Record<string, string> = {
  approved: '승인',
  rejected: '반려·취소',
  code_sent: '확인 코드 보냄',
};
const VERIFY_METHOD: Record<string, string> = {
  email: '학교 메일',
  document: '서류',
  nts: '사업자 번호',
  admin: '관리자 직접',
};

export default function MemberView({
  detail,
  logs,
  adminId,
}: {
  detail: MemberDetail;
  logs: AdminLog[];
  adminId: string;
}) {
  const { member, profile, projects, applications, proposals, verifications } = detail;
  return (
    <>
      <section className="admin-body">
        <Link href="/admin/members" className="text-button admin-back">
          ← 회원 목록
        </Link>
        <div className="admin-card admin-member-head">
          <div className="admin-main">
            <div className="admin-name">
              <h1 className="admin-member-name">{member.name || '(이름 없음)'}</h1>
              <span className="status-chip">{ROLE_LABEL[member.role]}</span>
              {member.admin && <span className="status-chip chip-new">관리자</span>}
              {member.suspendedAt && (
                <span className="status-chip admin-chip-off">
                  정지 {formatDay(member.suspendedAt)}
                </span>
              )}
            </div>
            <div className="admin-email">{member.email}</div>
            <div className="admin-methods">
              {member.methods.map((method) => (
                <span key={method} className={`admin-method m-${method}`}>
                  {METHOD_LABEL[method]}
                </span>
              ))}
              {member.badges.map((badge) => (
                <span key={badge.kind} className={`admin-method m-badge-${badge.kind}`}>
                  {badge.label}
                </span>
              ))}
            </div>
            <div className="admin-meta">
              <span>가입 {formatDateTime(member.createdAt)}</span>
              <span>{member.emailVerified ? '메일 확인됨' : '메일 미확인'}</span>
              {member.orgName && <span>{member.orgName}</span>}
              {member.phone && <span>{member.phone}</span>}
              <span className="admin-id">ID {member.id}</span>
            </div>
          </div>
          <MemberActions
            id={member.id}
            name={member.name || member.email}
            role={member.role}
            suspended={Boolean(member.suspendedAt)}
            locked={member.id === adminId || member.admin}
          />
        </div>
        <p className="small-note">인증 주기·소셜 연결 해제·삭제는 회원 목록에서 할 수 있어요.</p>

        {profile && member.role === 'actor' && (
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>배우 프로필</h2>
              <span className="small-note">
                {profile.isPublic ? '공개' : '비공개'} ·{' '}
                <Link href={`/actors/${member.id}`}>프로필 화면 보기</Link>
              </span>
            </div>
            {profile.photos.length > 0 && (
              <div className="admin-photos">
                {profile.photos.slice(0, 6).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" />
                ))}
              </div>
            )}
            <div className="admin-meta">
              {profile.birthYear && <span>{profile.birthYear}년생</span>}
              {profile.height && <span>{profile.height}cm</span>}
              {profile.region && <span>{profile.region}</span>}
              {[...profile.tags, ...profile.skills].map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
            {profile.intro && <p className="admin-inquiry-body">{profile.intro}</p>}
            {profile.filmography.length > 0 && (
              <ul className="admin-mini-list">
                {profile.filmography.map((film, index) => (
                  <li key={index}>
                    <span>
                      <strong>{film.year}</strong> {film.title}
                    </span>
                    <span className="small-note">{film.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {member.role === 'producer' && (
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>프로젝트·공고 {projects.length}</h2>
            </div>
            {projects.length === 0 ? (
              <p className="small-note">아직 만든 프로젝트가 없어요.</p>
            ) : (
              <ul className="admin-mini-list">
                {projects.map((project) => (
                  <li key={project.id} className="admin-project">
                    <span>
                      <strong>{project.title}</strong>
                      {project.archived && <span className="status-chip">보관</span>}
                      <span className="small-note"> {formatDay(project.createdAt)}</span>
                    </span>
                    <span className="admin-project-roles">
                      {project.roles.map((role) => (
                        <a
                          key={role.id}
                          href={`/apply/${role.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {role.title} · 지원 {role.applicants}
                          {role.closed ? ' · 마감' : ''}
                          {role.hidden ? ' · 내림' : ''}
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {applications.length > 0 && (
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>낸 지원서 {applications.length}</h2>
            </div>
            <ul className="admin-mini-list">
              {applications.map((app) => (
                <li key={app.id}>
                  <span>
                    <strong>{app.projectTitle}</strong> · {app.roleTitle}
                  </span>
                  <span className="small-note">
                    {STAGE_LABEL[app.stage] ?? app.stage} · {formatDay(app.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {proposals.length > 0 && (
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>캐스팅 제안 {proposals.length}</h2>
            </div>
            <ul className="admin-mini-list">
              {proposals.map((p) => (
                <li key={p.id}>
                  <span>
                    {p.direction === 'sent' ? '보낸 제안 →' : '받은 제안 ←'}{' '}
                    <strong>{p.other}</strong> · {p.roleTitle}
                  </span>
                  <span className="small-note">
                    {PROPOSAL_LABEL[p.status] ?? p.status} · {formatDay(p.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {verifications.length > 0 && (
          <div className="admin-card">
            <div className="admin-card-head">
              <h2>제작진 인증 기록</h2>
            </div>
            <ul className="admin-mini-list">
              {verifications.map((v, index) => (
                <li key={index}>
                  <span>
                    <strong>{v.kind === 'school' ? '학교' : '제작사'}</strong> ·{' '}
                    {[v.orgName, v.detail].filter(Boolean).join(' ') || '-'} ·{' '}
                    {VERIFY_METHOD[v.method] ?? v.method}
                  </span>
                  <span className="small-note">
                    {VERIFY_STATUS[v.status] ?? v.status} · {formatDay(v.createdAt)}
                    {v.expiresAt ? ` · ${formatDay(v.expiresAt)}까지` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="admin-card">
          <div className="admin-card-head">
            <h2>이 회원에 대한 관리자 작업</h2>
          </div>
          {logs.length === 0 ? (
            <p className="small-note">아직 없어요.</p>
          ) : (
            <ul className="admin-mini-list">
              {logs.map((log) => (
                <li key={log.id}>
                  <span>
                    <strong>
                      {ADMIN_ACTIONS[log.action as keyof typeof ADMIN_ACTIONS] ?? log.action}
                    </strong>{' '}
                    {log.detail}
                  </span>
                  <span className="small-note">
                    {log.adminEmail} · {formatDateTime(log.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
