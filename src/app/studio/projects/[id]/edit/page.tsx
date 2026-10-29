import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getProject, projectUsage } from '@/lib/accounts';
import { getCurrentUser } from '@/lib/auth';
import { listProjectRoles } from '@/lib/db';
import { projectRemovalMode, splitLocation } from '@/lib/project-meta';
import ProjectWizard, { type ProjectDraft } from '../../new/project-wizard';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export default async function EditProjectPage({ params }: Context) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/studio');
  if (user.role !== 'producer') redirect('/me');
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  if (project.ownerId !== user.id) {
    return (
      <main className="app-shell">
        <div className="screen-pad page-top">
          <Link className="back-link" href="/studio">
            ‹ 프로젝트
          </Link>
          <div className="empty-card">
            프로젝트를 수정할 권한이 없습니다.
            <br />
            소유한 프로젝트만 수정할 수 있습니다.
          </div>
        </div>
      </main>
    );
  }

  const roles = await listProjectRoles(id);
  // 지원 조건은 배역마다 저장돼 있지만 화면에서는 작품 하나의 값으로 다룬다(저장하면 모든 배역에 일괄 반영).
  const first = roles[0];
  const place = splitLocation(project.location, project.region);
  const initial: ProjectDraft = {
    title: project.title,
    genre: project.genre,
    genres: project.genres,
    productionType: project.productionType,
    runtime: project.runtime,
    releaseChannels: project.releaseChannels,
    releasePeriod: project.releasePeriod,
    company: project.company,
    director: project.director,
    producerName: project.producerName,
    logline: project.logline,
    posterUrl: project.posterUrl,
    description: project.description,
    region: place.region,
    locationDetail: place.detail,
    auditionStart: project.auditionStart,
    auditionEnd: project.auditionEnd,
    prepStart: project.prepStart,
    prepEnd: project.prepEnd,
    shootStart: project.shootStart,
    shootEnd: project.shootEnd === project.shootStart ? '' : project.shootEnd,
    shootSessions: project.shootSessions ? String(project.shootSessions) : '',
    roles: roles.map((role) => ({
      key: role.id,
      id: role.id,
      isClosed: role.isClosed,
      applicationCount: role.applicationCount ?? 0,
      title: role.title,
      description: role.description,
      requirement: role.requirement,
      roleType: role.roleType,
      gender: role.gender,
      ageMin: role.ageMin ? String(role.ageMin) : '',
      ageMax: role.ageMax ? String(role.ageMax) : '',
      headcount: String(role.headcount),
      shootMode: role.shootMode,
      shootDates: role.shootMode === 'custom' ? role.shootDates : [],
      specialScenes: role.specialScenes,
      specialNote: role.specialNote,
    })),
    deadline: first?.deadline ?? '',
    announcementDate: first?.announcementDate ?? '',
    pay: first?.pay ?? '',
    perks: project.perks,
    contactName: first?.contactName || user.orgName || user.name,
  };

  // 지원서·제안이 있으면 삭제 대신 보관만 할 수 있다(projectRemovalMode).
  const usage = await projectUsage(id);
  return (
    <ProjectWizard
      contactName={user.orgName || user.name}
      editId={id}
      initial={initial}
      removal={{
        mode: projectRemovalMode(usage),
        usage,
        archived: Boolean(project.archivedAt),
      }}
    />
  );
}
