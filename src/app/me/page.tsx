import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDates } from '@/lib/schedule';
import ActorNav from '@/components/actor-nav';
import { NotifBell } from '@/components/notif-bell';
import RecentStrip from '@/components/recent-strip';
import { RECENT_ROLES } from '@/lib/recent';
import { getProducerOrgLines, getProfile, listActorProposals } from '@/lib/accounts';
import { getCurrentUser } from '@/lib/auth';
import RoleCard from '@/components/role-card';
import RoleSearchForm from '@/components/role-search-form';
import { closeOverdueResults, listActorApplications, searchOpenRoles } from '@/lib/db';
import { matchRoleForActor } from '@/lib/match';
import { profileCompletion } from '@/lib/profile';
import { ROLE_FILTER_OPTIONS } from '@/lib/project-meta';
import { kstToday } from '@/lib/result-deadline';
import { hasRoleFilters, parseRoleFilters } from '@/lib/role-search';
import { actorStageInfo, actorStageOf } from '@/lib/types';
import ProposalActions from './proposal-actions';

export const dynamic = 'force-dynamic';

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  });
}

export default async function ActorHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/me');
  if (user.role !== 'actor') redirect('/studio');
  const profile = await getProfile(user.id);
  const completion = profile ? profileCompletion(profile) : 0;
  const proposals = await listActorProposals(user.id);
  // 결과 기준일이 지나도록 결과가 없는 내 지원서는 여기서 자동으로 결과를 안내한다.
  await closeOverdueResults({ actorId: user.id }, kstToday());
  const applications = await listActorApplications(user.id);
  const appliedRoleIds = new Set(applications.map((item) => item.roleId));
  const filters = parseRoleFilters(await searchParams, ROLE_FILTER_OPTIONS);
  const searching = hasRoleFilters(filters);
  const { all, roles } = await searchOpenRoles(
    new Date().toISOString().slice(0, 10),
    filters,
    profile?.unavailableDates ?? [],
  );
  const orgLines = await getProducerOrgLines(all.map((role) => role.ownerId));
  const matched = profile
    ? all
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
          <div className="empty-card">
            아직 지원한 배역이 없습니다.
            <br />
            아래 공고에서 첫 지원을 시작해 보세요.
            <a href="#open-roles" className="button button-soft empty-cta">
              모집 중인 배역 보기
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
            <div className="section-head">
              <h2>{user.name}배우님을 위한 맞춤 공고</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                프로필 기반 추천
              </span>
            </div>
            <div className="role-grid">
              {matched.map(({ role, fit }) => (
                <Link
                  key={role.id}
                  href={`/apply/${role.slug}`}
                  className="pcard role-link match-card"
                >
                  <h3>{role.projectTitle}</h3>
                  <p className="sub">{role.title}</p>
                  {role.ownerId && orgLines.get(role.ownerId) && (
                    <p className="org-line">{orgLines.get(role.ownerId)}</p>
                  )}
                  <p className="meta">
                    촬영 {formatDates(role.shootDates, 1) || shortDate(role.shootDate)} ·{' '}
                    {role.location}
                    <br />
                    {role.pay}
                  </p>
                  <div className="match-reasons">
                    {fit.reasons.slice(0, 3).map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="section-head" id="open-roles">
          <h2>모집 중인 배역</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            {searching ? `${roles.length}개 / 전체 ${all.length}개` : `${all.length}개`}
          </span>
        </div>
        <RoleSearchForm
          initial={filters}
          unavailableCount={profile?.unavailableDates.length ?? 0}
        />
        {roles.length === 0 ? (
          <div className="empty-card">
            {searching ? (
              <>
                조건에 맞는 배역이 없어요.
                <br />
                <Link href="/me#open-roles">필터 초기화</Link>
              </>
            ) : (
              '지금 모집 중인 배역이 없습니다.'
            )}
          </div>
        ) : (
          <div className="role-grid">
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                applied={appliedRoleIds.has(role.id)}
                orgLine={role.ownerId ? orgLines.get(role.ownerId) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
