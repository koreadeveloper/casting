import Link from 'next/link';
import type { OpenRoleListing } from '@/lib/db';
import { ROLE_GENDERS, ROLE_TYPES, ageRangeLabel, projectCover } from '@/lib/project-meta';
import { formatDates } from '@/lib/schedule';
import TrustBadges from '@/components/trust-badges';
import type { ProducerBadges } from '@/lib/verification-rules';
import CoverImage from './cover-image';

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
  fit,
  sample = false,
}: {
  role: OpenRoleListing;
  /** 코드에 둔 예시 공고(lib/sample-role.ts). 마감일 대신 '예시 공고'를 표시한다. */
  sample?: boolean;
  /** 로그인한 배우의 프로필과 맞는 조건. 맞는 성별·연령 칩은 색을 채워 보여 준다. */
  fit?: { gender?: boolean; age?: boolean };
  applied?: boolean;
  /** 제작자 소속 표기(예: "○○대학교 영화과 · 연출") */
  orgLine?: string;
  /** 제작진 인증 배지. undefined면 인증 줄을 아예 안 그리고, 빈 값이면 '확인되지 않았어요'를 보인다. */
  trust?: ProducerBadges | null;
}) {
  const tags = [
    { text: role.projectFormat, fit: false },
    { text: ROLE_TYPES[role.roleType], fit: false },
    { text: ROLE_GENDERS[role.gender], fit: Boolean(fit?.gender) },
    { text: ageRangeLabel(role.ageMin, role.ageMax), fit: Boolean(fit?.age) },
  ].filter((tag) => tag.text);
  return (
    <Link href={`/apply/${role.slug}`} className="pcard role-link">
      <div className="pcard-top">
        <div className="pcard-img" style={{ width: 96, height: 104 }}>
          <CoverImage
            src={role.coverUrl || projectCover(role.projectFormat)}
            fallback={projectCover(role.projectFormat)}
          />
        </div>
        <div className="pcard-info">
          <span className={sample ? 'badge-soft state-off' : 'badge-soft'}>
            {sample ? '예시 공고' : applied ? '지원함' : `${shortDate(role.deadline)} 마감`}
          </span>
          <h3>{role.projectTitle}</h3>
          <p className="sub">{role.title}</p>
          {orgLine && <p className="org-line">{orgLine}</p>}
          {trust !== undefined && <TrustBadges badges={trust ?? undefined} />}
          {tags.length > 0 && (
            <p className="role-tags">
              {tags.map((tag) => (
                <span key={tag.text} className={tag.fit ? 'tag-fit' : undefined}>
                  {tag.fit && '✓ '}
                  {tag.text}
                </span>
              ))}
            </p>
          )}
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
