import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDates } from '@/lib/schedule';
import ActorNav from '@/components/actor-nav';
import { NotifBell } from '@/components/notif-bell';
import RecentStrip from '@/components/recent-strip';
import { RECENT_ROLES } from '@/lib/recent';
import { getProfile, listActorProposals } from '@/lib/accounts';
import { getCurrentUser } from '@/lib/auth';
import { listActorApplications, listOpenRoles } from '@/lib/db';
import { matchHighlights, matchRoleForActor } from '@/lib/match';
import { profileCompletion } from '@/lib/profile';
import { actorStageInfo, actorStageOf } from '@/lib/types';
import ProposalActions from './proposal-actions';
import RoleFinder from '@/components/role-finder';

export const dynamic = 'force-dynamic';

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  });
}

export default async function ActorHome() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/me');
  if (user.role !== 'actor') redirect('/studio');
  const profile = await getProfile(user.id);
  const completion = profile ? profileCompletion(profile) : 0;
  const proposals = await listActorProposals(user.id);
  const applications = await listActorApplications(user.id);
  const appliedRoleIds = new Set(applications.map((item) => item.roleId));
  const roles = await listOpenRoles(new Date().toISOString().slice(0, 10));
  const matched = profile
    ? roles
        .map((role) => ({ role, fit: matchRoleForActor(profile, role) }))
        .filter((entry) => entry.fit.score >= 25 && !appliedRoleIds.has(entry.role.id))
        .sort((a, b) => b.fit.score - a.fit.score)
        .slice(0, 4)
    : [];
  return (
    <main className="app-shell wide">
      <ActorNav active="home" actorId={user.id} />
      <div className="screen-pad page-top">
        <div className="me-top">
          <div>
            <p className="greet-sub">{user.name}님, 안녕하세요.</p>
            <h1 className="page-title">오늘의 오디션</h1>
          </div>
          <NotifBell />
        </div>

        <Link href="/me/profile" className="completion-card">
          <div>
            <strong>프로필 완성도 {completion}%</strong>
            <span>
              {completion < 100
                ? '프로필을 채울수록 제작자 검색에 잘 보이고, 지원서가 자동으로 채워져요.'
                : '프로필이 모두 채워졌어요. 제작자 검색에 노출되고 있습니다.'}
            </span>
          </div>
          <div className="bar">
            <i style={{ width: `${completion}%` }} />
          </div>
        </Link>

        <div className="section-head">
          <h2>받은 캐스팅 제안</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            {proposals.filter((item) => item.status === 'sent').length}건 대기
          </span>
        </div>
        {proposals.length === 0 ? (
          <div className="empty-card">아직 받은 제안이 없습니다.</div>
        ) : (
          proposals.map((proposal) => (
            <div key={proposal.id} className="proposal-card">
              <div className="pc-head">
                <span
                  className={`status-chip ${proposal.status === 'sent' ? 'chip-new' : proposal.status === 'accepted' ? 'chip-interested' : 'chip-excluded'}`}
                >
                  {proposal.status === 'sent'
                    ? '새 제안'
                    : proposal.status === 'accepted'
                      ? '지원 완료'
                      : '거절함'}
                </span>
                <small>
                  {new Date(proposal.createdAt).toLocaleDateString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                  })}
                </small>
              </div>
              <strong>
                {proposal.projectTitle} · {proposal.roleTitle}
              </strong>
              <p className="pc-from">
                {proposal.producerName}
                {proposal.orgName ? ` · ${proposal.orgName}` : ''}
              </p>
              <p className="pc-msg">{proposal.message}</p>
              {proposal.status === 'sent' && <ProposalActions proposal={proposal} />}
            </div>
          ))
        )}

        {/*
          예전에는 서버에 저장된 '내 지원 현황'과 이 기기에만 남는 '내 지원'(MyApplications)을
          둘 다 보여 줘서 같은 지원이 두 번 나오고, 기기에만 남은 접수 링크는 404가 떴다.
          로그인한 배우에게는 계정에 묶인 목록 하나만 보여 준다.
        */}
        <div className="section-head">
          <h2>내 지원 현황</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            {applications.length}건
          </span>
        </div>
        {applications.length === 0 ? (
          // 빈 화면에서 끝나지 않게 다음 할 일(공고 둘러보기)로 이어 준다.
          <div className="empty-card empty-next">
            <strong>아직 지원한 배역이 없어요</strong>
            <span>
              {matched.length > 0
                ? `${user.name} 배우님께 맞는 공고부터 살펴보고 첫 지원을 시작해 보세요.`
                : '아래 모집 중인 배역에서 첫 지원을 시작해 보세요.'}
            </span>
            <a
              className="button button-primary"
              href={matched.length > 0 ? '#match-roles' : '#open-roles'}
            >
              {matched.length > 0 ? '맞춤 공고 보기' : '모집 중인 배역 보기'}
            </a>
          </div>
        ) : (
          applications.map((item) => (
            <Link key={item.id} href={`/status/${item.receiptToken}`} className="audition-card">
              <span className="icon-tile">✓</span>
              <span className="txt">
                {item.projectTitle} · {item.roleTitle}
                <small>
                  {actorStageInfo[actorStageOf(item)].label} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}{' '}
                  접수
                </small>
              </span>
              <span className="chevron">›</span>
            </Link>
          ))
        )}

        <RecentStrip storageKey={RECENT_ROLES} title="최근 본 공고" unit="개" />

        {matched.length > 0 && (
          <>
            <div className="section-head" id="match-roles">
              <h2>{user.name} 배우님을 위한 맞춤 공고</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                프로필 조건 기준
              </span>
            </div>
            <div className="role-grid">
              {matched.map(({ role, fit }) => (
                <Link
                  key={role.id}
                  href={`/apply/${role.slug}`}
                  className="pcard role-link match-card"
                >
                  {/* 점수(50% 매치) 대신 무엇이 맞는지를 보인다. 알림 문구와 같은 근거다. */}
                  <h3>{role.projectTitle}</h3>
                  <p className="sub">{role.title}</p>
                  <p className="meta">
                    촬영 {formatDates(role.shootDates, 1) || shortDate(role.shootDate)} ·{' '}
                    {role.location}
                    <br />
                    {role.pay}
                  </p>
                  <div className="match-reasons">
                    {matchHighlights(fit.facts)
                      .slice(0, 4)
                      .map((item) => (
                        <span key={item}>✓ {item}</span>
                      ))}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <RoleFinder
          roles={roles}
          appliedRoleIds={[...appliedRoleIds]}
          me={
            profile
              ? {
                  gender: profile.gender,
                  // 맞춤 계산(match.ts)과 같은 나이 기준을 쓴다.
                  age: profile.birthYear ? new Date().getFullYear() - profile.birthYear + 1 : null,
                }
              : undefined
          }
        />
      </div>
    </main>
  );
}
