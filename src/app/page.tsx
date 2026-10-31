import Link from 'next/link';
import { Brand } from '@/components/brand';
import LandingGuide, { type ViewRole } from '@/components/landing/landing-guide';
import { getSession, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 정식 출시 예정 요금제(안). 결제 기능이 없으므로 안내만 하고, 파일럿 중에는 한도를 적용하지 않는다.
// 기능 이름 뒤 '(준비 중)'은 아직 앱에 없는 기능이다.
type Plan = {
  name: string;
  price: string;
  unit: string;
  rows: [string, string][];
  accent?: boolean;
};

const plans: Plan[] = [
  {
    name: '무료',
    price: '0원',
    unit: '제작팀 기본 이용',
    rows: [
      ['적용 범위', '제작팀당 진행 중인 작품 1개'],
      ['모집', '한 작품에서 여러 배역 모집 가능'],
      ['팀원', '소유자 포함 2명'],
      ['기본 기능', '지원서 접수·열람, 기본 검색, 후보 저장·단계 관리, 결과 안내'],
    ],
  },
  {
    name: '프로젝트 패스',
    price: '19,900원',
    unit: '작품당 · 90일 · 예정 가격',
    rows: [
      ['적용 범위', '구매한 작품 1개에만 유료 기능 적용'],
      ['모집', '한 작품에서 여러 배역 모집 가능'],
      ['팀원', '해당 작품에 소유자 포함 최대 10명'],
      ['기본 기능', '무료 기능 모두 포함'],
      // 지금 앱에 있는 기능과 아직 없는 기능을 줄을 나눠 적는다(전체가 준비 중으로 읽히지 않게).
      ['제공 기능', '공동 평가·투표·메모, 후보 비교, 참석 재확인'],
      ['준비 중', '결과 일괄 안내'],
    ],
    accent: true,
  },
];

// 수요를 확인한 뒤 도입을 검토할 상품. 가격·제공 범위는 정하지 않았다.
const laterPlans: [string, string, string][] = [
  [
    '학기 패스',
    '여러 작품을 제작하는 동아리·반복 제작팀용',
    '반복 이용과 재구매 수요를 확인한 후 도입을 검토해요.',
  ],
  [
    '학과 라이선스',
    '여러 학생팀의 이용을 지원하는 대학 영화과용',
    '학과의 구매 의사·예산·필요 기능을 확인한 후 도입을 검토해요.',
  ],
];

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const demo = process.env.DEMO_MODE === 'true';
  const home = session ? homeFor(session.role) : '';
  // ?as=actor|producer: 첫 화면에서 고른 '소개를 볼 역할'. 계정 역할·가입과는 관계없다.
  const as = (await searchParams).as;
  const asRole: ViewRole | null = as === 'actor' || as === 'producer' ? as : null;

  return (
    <main className="landing-page">
      <header className="lp-nav">
        <Brand />
        <nav className="lp-links">
          <a href="#about">서비스 소개</a>
          <a href="#guide">이용 방법</a>
          <a href="#pricing">요금제</a>
        </nav>
        <div className="lp-auth">
          {session ? (
            <Link className="button button-primary sm" href={home}>
              내 화면으로
            </Link>
          ) : (
            <>
              <Link className="text-button" href="/login">
                {demo ? '바로 체험하기' : '로그인'}
              </Link>
              <Link className="button button-primary sm" href="/signup">
                {demo ? '역할 선택하기' : '시작하기'}
              </Link>
            </>
          )}
        </div>
      </header>

      <LandingGuide
        initialRole={asRole ?? (session?.role === 'actor' ? 'actor' : 'producer')}
        chosenFromUrl={asRole !== null}
        home={home}
      >
        <section className="lp-section" id="pricing">
          <h2>요금제</h2>
          <p className="lp-lead">
            배우는 언제나 무료예요. 제작팀은 팀원과 함께 평가하고 후보를 비교하는 등 캐스팅을 더
            효율적으로 만드는 기능에 비용을 내는 구조로 준비하고 있어요.
          </p>

          <div className="lp-pilot">
            <span className="lp-pilot-tag">지금 · 파일럿 기간</span>
            <strong>제공 중인 기능을 모두 무료로 이용할 수 있어요.</strong>
            <p>
              아래 요금제는 정식 출시를 위한 예정안이며, 가격과 제공 범위는 변경될 수 있어요. 유료
              전환은 사전에 안내하며, 별도로 구매하지 않으면 자동으로 결제되지 않아요. 파일럿 중에는
              팀원 수·작품 수 한도도 적용하지 않아요.
            </p>
            {session ? (
              <Link className="button button-primary" href={home}>
                내 화면으로 →
              </Link>
            ) : (
              <Link className="button button-primary" href="/signup/producer">
                무료로 시작하기 →
              </Link>
            )}
          </div>

          <div className="lp-plans-head">
            <span className="lp-tag">정식 출시 예정안</span>
            <span>아직 결제는 받지 않아요. 아래 내용은 검증 중인 안이에요.</span>
          </div>
          <div className="lp-grid two lp-plans">
            {plans.map((plan) => (
              <div key={plan.name} className={`lp-card${plan.accent ? ' accent' : ''}`}>
                <span className="badge-soft">{plan.name}</span>
                <strong className="price">{plan.price}</strong>
                <span className="lp-plan-unit">{plan.unit}</span>
                <dl className="lp-plan-rows">
                  {plan.rows.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <ul className="lp-plan-notes">
            <li>
              프로젝트 패스는 구매한 작품 1개에만 적용돼요. 다른 작품은 무료 기준으로 이용해요.
            </li>
            <li>90일은 정식 유료 운영 시 결제 완료일부터 계산하며, 자동 갱신 없는 1회 결제예요.</li>
            <li>
              인증 정보 확인·지원 현황 확인 같은 기본 신뢰 기능은 어느 요금제에서나 제한 없이
              제공해요.
            </li>
          </ul>

          <div className="lp-later">
            <strong>추후 상품 · 도입 검토 중</strong>
            <div className="lp-later-list">
              {laterPlans.map(([name, who, when]) => (
                <div key={name}>
                  <b>{name}</b>
                  <span>{who}</span>
                  <small>{when}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      </LandingGuide>

      <footer className="lp-footer">
        <Brand />
        <span>좋은 이야기는, 좋은 사람으로부터 · 캐스팅의 새로운 기준</span>
      </footer>
    </main>
  );
}
