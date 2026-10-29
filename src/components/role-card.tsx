import Link from 'next/link';
import type { OpenRoleListing } from '@/lib/db';
import { ROLE_GENDERS, ROLE_TYPES, ageRangeLabel, projectCover } from '@/lib/project-meta';
import { formatDates } from '@/lib/schedule';
import TrustBadges from '@/components/trust-badges';
import type { ProducerBadges } from '@/lib/verification-rules';

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  });
}

/** 배우 홈의 '모집 중인 배역' 카드. 검색 결과를 훑어볼 수 있게 형식·비중·성별·연령대를 한 줄로 보여 준다. */
export default function RoleCard({
  role,
  applied = false,
  orgLine,
  trust,
}: {
  role: OpenRoleListing;
  applied?: boolean;
  /** 제작자 소속 표기(예: "○○대학교 영화과 · 연출") */
  orgLine?: string;
  /** 제작진 인증 배지. undefined면 인증 줄을 아예 안 그리고, 빈 값이면 '확인되지 않았어요'를 보인다. */
  trust?: ProducerBadges | null;
}) {
  const tags = [
    role.projectFormat,
    ROLE_TYPES[role.roleType],
    ROLE_GENDERS[role.gender],
    ageRangeLabel(role.ageMin, role.ageMax),
  ].filter(Boolean);
  return (
    <Link href={`/apply/${role.slug}`} className="pcard role-link">
      <div className="pcard-top">
        <div className="pcard-img" style={{ width: 96, height: 104 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={role.coverUrl || projectCover(role.projectFormat)} alt="" />
        </div>
        <div className="pcard-info">
          <span className="badge-soft">
            {applied ? '지원함' : `${shortDate(role.deadline)} 마감`}
          </span>
          <h3>{role.projectTitle}</h3>
          <p className="sub">{role.title}</p>
          {orgLine && <p className="org-line">{orgLine}</p>}
          {trust !== undefined && <TrustBadges badges={trust ?? undefined} />}
          {tags.length > 0 && <p className="role-tags">{tags.join(' · ')}</p>}
          <p className="meta">
            촬영 {formatDates(role.shootDates, 1) || shortDate(role.shootDate)} · {role.location}
            <br />
            {role.pay}
          </p>
        </div>
      </div>
    </Link>
  );
}
