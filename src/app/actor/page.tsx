import Link from 'next/link';
import { BrandLogo } from '@/components/brand';
import { redirect } from 'next/navigation';
import { formatDates } from '@/lib/schedule';
import { getActorId } from '@/lib/auth';
import { listOpenRoles } from '@/lib/db';
import MyApplications from './my-applications';
import ProjectCover from '@/components/project-cover';

export const dynamic = 'force-dynamic';

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  });
}

export default async function ActorHome() {
  if (await getActorId()) redirect('/me');
  const roles = await listOpenRoles(new Date().toISOString().slice(0, 10));
  return (
    <main className="app-shell narrow">
      <header className="home-header">
        <Link href="/" className="brand-word" style={{ color: 'inherit' }}>
          <BrandLogo />
        </Link>
        <Link href="/" className="text-button">
          역할 바꾸기
        </Link>
      </header>
      <div className="screen-pad">
        <p className="greet-sub">안녕하세요, 배우님.</p>
        <h1 className="page-title">오늘의 오디션</h1>
        <MyApplications />
        <div className="section-head">
          <h2>모집 중인 배역</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            {roles.length}개
          </span>
        </div>
        {roles.length === 0 ? (
          <div className="empty-card">지금 모집 중인 배역이 없습니다.</div>
        ) : (
          roles.map((role) => (
            <Link key={role.id} href={`/apply/${role.slug}`} className="pcard role-link">
              <div className="pcard-top">
                <div className="pcard-img" style={{ width: 96, height: 104 }}>
                  <ProjectCover title={role.projectTitle} posterUrl={role.posterUrl} />
                </div>
                <div className="pcard-info">
                  <span className="badge-soft">{shortDate(role.deadline)} 마감</span>
                  <h3>{role.projectTitle}</h3>
                  <p className="sub">{role.title}</p>
                  <p className="meta">
                    촬영 {formatDates(role.shootDates, 1) || shortDate(role.shootDate)} ·{' '}
                    {role.location}
                    <br />
                    {role.pay}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
