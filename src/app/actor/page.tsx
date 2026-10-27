import Link from 'next/link';
import { BrandLogo } from '@/components/brand';
import { redirect } from 'next/navigation';
import { getActorId } from '@/lib/auth';
import { listOpenRoles } from '@/lib/db';
import MyApplications from './my-applications';
import RoleFinder from '@/components/role-finder';

export const dynamic = 'force-dynamic';

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
        <RoleFinder roles={roles} />
      </div>
    </main>
  );
}
