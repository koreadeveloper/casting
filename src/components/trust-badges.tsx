import { UNVERIFIED_NOTE, type ProducerBadges } from '@/lib/verification-rules';

/**
 * 공고를 올린 제작진의 인증 표시. 학교 인증·제작사 인증은 따로 붙고, 둘 다 있으면 둘 다 보인다.
 * 아무 인증도 없으면 기획서 문구 그대로 '이전 작품 이력이 확인되지 않았어요'를 보여 준다.
 */
export default function TrustBadges({
  badges,
  withNames = false,
}: {
  badges?: ProducerBadges;
  /** 학교·상호 이름까지 보일지 (공고 상세처럼 자리가 넉넉할 때) */
  withNames?: boolean;
}) {
  if (!badges?.school && !badges?.business) return <p className="trust-none">{UNVERIFIED_NOTE}</p>;
  return (
    <div className="trust-badges">
      {badges.school && (
        <span className="trust-badge trust-school" title={badges.school.name}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m12 4 10 5-10 5L2 9l10-5Zm-6 7.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          학교 인증{withNames && badges.school.name ? ` · ${badges.school.name}` : ''}
        </span>
      )}
      {badges.business && (
        <span className="trust-badge trust-business" title={badges.business.name}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 20V8l8-4 8 4v12M9 20v-6h6v6M3 20h18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          제작사 인증됨{withNames && badges.business.name ? ` · ${badges.business.name}` : ''}
        </span>
      )}
    </div>
  );
}
