import Link from 'next/link';
import { BrandLogo } from '@/components/brand';
import { redirect } from 'next/navigation';
import RoleCard from '@/components/role-card';
import RoleSearchForm from '@/components/role-search-form';
import { getProducerOrgLines } from '@/lib/accounts';
import { getProducerBadges } from '@/lib/verifications';
import { getActorId, getProducerId } from '@/lib/auth';
import { searchOpenRoles } from '@/lib/db';
import { ROLE_FILTER_OPTIONS } from '@/lib/project-meta';
import { hasRoleFilters, parseRoleFilters } from '@/lib/role-search';
import MyApplications from './my-applications';

export const dynamic = 'force-dynamic';

export default async function ActorHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getActorId()) redirect('/me');
  // 로그인한 배우는 위에서 /me로 보낸다. 여기 남는 건 로그인 전 방문자 또는 둘러보는 제작자다.
  const producer = Boolean(await getProducerId());
  const filters = parseRoleFilters(await searchParams, ROLE_FILTER_OPTIONS);
  const searching = hasRoleFilters(filters);
  // 로그인 전이라 출연 불가일을 모른다('출연 불가일 피하기'는 숨긴다).
  const { all, roles } = await searchOpenRoles(new Date().toISOString().slice(0, 10), filters);
  const orgLines = await getProducerOrgLines(roles.map((role) => role.ownerId));
  const badges = await getProducerBadges(roles.map((role) => role.ownerId));
  return (
    <main className="app-shell narrow">
      <header className="home-header">
        <Link href="/" className="brand-word" style={{ color: 'inherit' }}>
          <BrandLogo />
        </Link>
        {producer ? (
          <Link href="/studio" className="button button-outline sm home-header-btn">
            제작자 화면으로
          </Link>
        ) : (
          <div className="home-auth">
            <Link href="/login" className="text-button home-header-btn">
              로그인
            </Link>
            <Link href="/signup/actor" className="button button-primary sm home-header-btn">
              가입하기
            </Link>
          </div>
        )}
      </header>
      <div className="screen-pad">
        <p className="greet-sub">배우는 언제나 무료 · 가입 없이도 지원할 수 있어요</p>
        <h1 className="page-title">오늘의 오디션</h1>
        {!producer && (
          <div className="join-nudge">
            <p>
              가입하면 <strong>프로필 하나로 바로 지원</strong>하고, 지원한 작품의 진행 상황을
              한곳에서 볼 수 있어요.
            </p>
            <Link href="/signup/actor" className="button button-soft sm">
              배우로 가입하기
            </Link>
          </div>
        )}
        <MyApplications />
        <div className="section-head" id="roles">
          <h2>모집 중인 배역</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            {searching ? `${roles.length}개 / 전체 ${all.length}개` : `${all.length}개`}
          </span>
        </div>
        <RoleSearchForm initial={filters} unavailableCount={null} />
        {roles.length === 0 ? (
          <div className="empty-card">
            {searching ? (
              <>
                조건에 맞는 배역이 없어요.
                <br />
                <Link href="/actor#roles">필터 초기화</Link>
              </>
            ) : (
              '지금 모집 중인 배역이 없습니다.'
            )}
          </div>
        ) : (
          roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              orgLine={role.ownerId ? orgLines.get(role.ownerId) : undefined}
              trust={(role.ownerId && badges.get(role.ownerId)) || null}
            />
          ))
        )}
      </div>
    </main>
  );
}
