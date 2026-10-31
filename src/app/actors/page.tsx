import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/brand';
import { listPublicProfiles } from '@/lib/accounts';
import { getSession } from '@/lib/auth';
import { ageOf, genderLabel } from '@/lib/profile';

export const dynamic = 'force-dynamic';

// 로그인 전 제작진이 '어떤 배우가 있는지' 맛보기로 보는 화면.
// 사진·이름·나이대·이미지 태그만 보여 주고, 키·경력·연락은 가입 후에 연다.
const PREVIEW_COUNT = 12;

const GENDERS: [string, string][] = [
  ['', '전체'],
  ['female', '여성'],
  ['male', '남성'],
];

function ageBand(birthYear: number | null) {
  const age = ageOf(birthYear);
  if (age === null) return '';
  return age >= 50 ? '50대 이상' : `${Math.floor(age / 10) * 10}대`;
}

export default async function ActorPreview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session?.role === 'producer') redirect('/studio/actors');

  const params = await searchParams;
  const gender = GENDERS.some(([value]) => value === params.g) ? String(params.g ?? '') : '';
  const all = await listPublicProfiles();
  const matched = all
    .filter((profile) => !gender || profile.gender === gender)
    // 사진이 있는 프로필을 먼저 보여 준다.
    .sort((a, b) => Number(b.photos.length > 0) - Number(a.photos.length > 0));
  const shown = matched.slice(0, PREVIEW_COUNT);
  const withPhoto = all.filter((profile) => profile.photos.length > 0).length;

  return (
    <main className="app-shell narrow">
      <header className="home-header">
        <Link href="/" className="brand-word" style={{ color: 'inherit' }}>
          <BrandLogo />
        </Link>
        {!session && (
          <div className="home-auth">
            <Link href="/login?next=/studio/actors" className="text-button home-header-btn">
              로그인
            </Link>
            <Link href="/signup/producer" className="button button-primary sm home-header-btn">
              가입하기
            </Link>
          </div>
        )}
      </header>
      <div className="screen-pad">
        <p className="greet-sub">제작진을 위한 미리보기 · 프로필을 공개한 배우만 보여요</p>
        <h1 className="page-title">등록된 배우</h1>

        <div className="preview-stats">
          <div>
            <strong>{all.length}</strong>
            <span>프로필 공개 배우</span>
          </div>
          <div>
            <strong>{withPhoto}</strong>
            <span>사진 등록</span>
          </div>
        </div>

        <div className="join-nudge">
          <p>
            제작진으로 가입하면 <strong>키·경력·영상까지 보고</strong> 조건으로 찾아 팀과 함께
            비교할 수 있어요.
          </p>
          <Link href="/signup/producer" className="button button-soft sm">
            제작진 가입
          </Link>
        </div>

        <div className="filter-row preview-filter" role="group" aria-label="성별">
          {GENDERS.map(([value, label]) => (
            <Link
              key={value || 'all'}
              href={value ? `/actors?g=${value}` : '/actors'}
              className={gender === value ? 'filter active' : 'filter'}
              scroll={false}
            >
              {label}
            </Link>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="empty-card">아직 프로필을 공개한 배우가 없어요.</div>
        ) : (
          <div className="actor-grid">
            {shown.map((actor) => (
              <div key={actor.userId} className="actor-tile">
                <Link href={`/actors/${actor.userId}`} className="tile-photo">
                  {actor.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={actor.photos[0]} alt={`${actor.name} 프로필 사진`} loading="lazy" />
                  ) : (
                    <span>{actor.name.slice(-2)}</span>
                  )}
                </Link>
                <Link href={`/actors/${actor.userId}`} className="tile-info">
                  <strong>{actor.name}</strong>
                  <span>
                    {[ageBand(actor.birthYear), genderLabel[actor.gender]]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <div className="tag-row">
                    {actor.tags.slice(0, 2).map((tag) => (
                      <i key={tag}>{tag}</i>
                    ))}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {matched.length > shown.length && (
          <div className="preview-more">
            <p>
              <strong>{matched.length - shown.length}명</strong>의 배우가 더 있어요.
            </p>
            <Link href="/signup/producer" className="button button-primary full">
              제작진으로 가입하고 전체 보기 →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
