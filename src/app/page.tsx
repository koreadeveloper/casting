import Link from 'next/link';
import { Brand } from '@/components/brand';
import { DemoEntry } from '@/components/demo-entry';
import { demoFace } from '@/lib/demo-faces';
import { getSession, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const collage = [1, 2, 7, 6, 4];

// 기획서의 차별점. 실제로 들어가 있는 기능만 적는다(없는 기능을 적지 않는다).
// pass: 정식 출시 후 프로젝트 패스에 들어갈 예정인 부분. 파일럿 중에는 무료로 열려 있다.
const strengths: { who: string; title: string; desc: string; pass?: string }[] = [
  {
    who: '신뢰',
    title: '제작진 인증 배지',
    desc: '재학증명서·학교 메일·사업자등록증으로 확인한 팀에 ‘학교 인증’·‘제작사 인증됨’이 붙어요. 인증 전인 팀은 그렇다고 알려 드려요.',
  },
  {
    who: '배우',
    title: '지원 현황 공개',
    desc: '미열람 → 검토 중 → 오디션 대상 → 결과까지 단계가 보여요. 결과 안내일이 지나면 자동으로 알려 드려서 무작정 기다리지 않아요.',
  },
  {
    who: '배우',
    title: '조건을 지원 전에 확인',
    desc: '촬영 일정·출연료·특수 장면 안내를 공고에서 먼저 보고, 프로필 하나로 여러 작품에 지원해요.',
  },
  {
    who: '제작진',
    title: '이상형 월드컵 비교',
    desc: '최종 후보를 1:1로 붙여 가며 골라요. 비슷한 후보 사이에서 하나씩 비교해 정할 수 있어요.',
    pass: '후보 비교',
  },
  {
    who: '제작진',
    title: '팀보드',
    desc: '기본 후보 관리: 지원자를 서류 검토 → 서류 통과 → 오디션 후보로 옮겨요. 공동 평가: 초대한 팀원과 투표·메모를 남겨 함께 정해요.',
    pass: '공동 평가·투표·메모',
  },
  {
    who: '현장',
    title: '촬영 참석 재확인',
    desc: '출연이 확정되면 촬영 3일 전부터 배우 화면에 참석 여부를 묻는 카드가 뜨고, 답은 제작진 알림으로 전달돼요.',
    pass: '참석 재확인',
  },
];

const producerFlow: [string, string][] = [
  ['프로젝트·배역 등록', '촬영 조건·출연료·특수 장면까지 안내에 따라 공고 필수 항목을 채워요.'],
  [
    '지원 받기·배우 찾기',
    '지원 링크를 필름메이커스·SNS 공고에 붙이고, 성별·연령·키·지역·특기·출연 가능일로 배우를 찾아 직접 제안해요.',
  ],
  ['팀과 함께 고르기', '팀보드와 이상형 월드컵으로 후보를 정해요.'],
  ['오디션·촬영', '대화에서 오디션 시간을 확정하고, 촬영 전 참석을 다시 확인해요.'],
];

const actorFlow: [string, string][] = [
  ['프로필 하나 만들기', '갖고 있던 PDF 프로필을 올리면 입력칸을 자동으로 채워 드려요.'],
  ['안심하고 지원', '인증 배지와 촬영 조건·출연료·특수 장면 안내를 보고 지원해요.'],
  ['진행 상황 확인', '지원 현황에서 지금 단계와 결과 안내 예정일을 확인해요.'],
  ['오디션·촬영', '오디션 시간을 고르고, 촬영 전에 참석 여부를 알려 줘요.'],
];

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
      [
        '추가 기능',
        '공동 평가·투표·메모, 후보 비교(이상형 월드컵), 복합 필터, 참석 재확인, 일괄 안내(준비 중)',
      ],
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

function FlowList({ items }: { items: [string, string][] }) {
  return (
    <ol className="lp-flow">
      {items.map(([title, desc], index) => (
        <li key={title}>
          <b>{index + 1}</b>
          <strong>{title}</strong>
          <span>{desc}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function Landing() {
  const session = await getSession();
  const demo = process.env.DEMO_MODE === 'true';
  const home = session ? homeFor(session.role) : '';

  // 로그인한 사람에게는 '내 화면으로'만, 처음 온 사람에게는 제작진·배우 입구를 따로 보여 준다.
  const ctas = session ? (
    <div className="lp-cta">
      <Link className="button button-primary" href={home}>
        내 화면으로 →
      </Link>
    </div>
  ) : (
    <div className="lp-cta">
      <Link className="button button-primary" href="/signup/producer">
        제작진으로 시작하기 →
      </Link>
      <div className="lp-cta-pair">
        <Link className="button button-outline" href="/actors">
          배우 프로필 둘러보기
        </Link>
        <Link className="button button-outline" href="/actor">
          배우로 배역 보기
        </Link>
      </div>
    </div>
  );

  return (
    <main className="landing-page">
      <header className="lp-nav">
        <Brand />
        <nav className="lp-links">
          <a href="#about">서비스 소개</a>
          <a href="#features">차별점</a>
          <a href="#how">이용 방법</a>
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

      <section className="lp-hero" id="about">
        <div className="lp-copy">
          <span className="lp-eyebrow">학생·독립영화 제작팀과 신인 배우를 위한 캐스팅 플랫폼</span>
          <h1>
            공고부터 합격까지
            <br />
            <em>한곳에서</em> 캐스팅
          </h1>
          <p>
            캐스팅 담당자가 따로 없는 제작팀은 조건에 맞는 배우를 빠르게 찾아 팀과 함께 고르고, 신인
            배우는 인증된 공고에 안심하고 지원해 진행 상황을 바로 확인해요.
          </p>
          {ctas}
          {!session && (
            <p className="lp-login-hint">
              이미 계정이 있나요? <Link href="/login">로그인</Link>
            </p>
          )}
          {!session && <DemoEntry />}
        </div>
        <div className="lp-collage" aria-hidden>
          {collage.map((id, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} className={`c${index}`} src={demoFace(id)} alt="" />
          ))}
          <div className="lp-bubble">
            <span className="trust-badge trust-school">학교 인증</span>
            지원 현황 · 오디션 대상
          </div>
        </div>
      </section>

      <section className="lp-section" id="features">
        <h2>캐스팅플로우가 다른 점</h2>
        <p className="lp-lead">
          모집 공고에서 끝나지 않고 최종 선발까지, ‘좋아요 수’가 아니라 인증과 실제 진행 상황으로
          믿을 수 있게 만들었어요.
        </p>
        <div className="lp-grid three">
          {strengths.map((item) => (
            <div key={item.title} className="lp-card">
              <span className="lp-tag">{item.who}</span>
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
              {item.pass && (
                <span className="lp-pass-note">정식 출시 후 프로젝트 패스 · {item.pass}*</span>
              )}
            </div>
          ))}
        </div>
        <p className="lp-footnote">
          * 정식 출시 예정 기준이에요. 지금은 파일럿 기간이라 위 기능을 모두 무료로 쓸 수 있어요.
        </p>
      </section>

      <section className="lp-section" id="how">
        <h2>이렇게 쓰여요</h2>
        <div className="lp-grid two">
          <div className="lp-card lp-audience">
            <span className="lp-tag">제작진 · 학생·독립영화 팀</span>
            <FlowList items={producerFlow} />
            {!session && (
              <Link className="button button-primary" href="/signup/producer">
                제작진으로 시작하기
              </Link>
            )}
          </div>
          <div className="lp-card lp-audience">
            <span className="lp-tag">배우 · 언제나 무료</span>
            <FlowList items={actorFlow} />
            {!session && (
              <Link className="button button-outline" href="/signup/actor">
                배우로 가입하기
              </Link>
            )}
          </div>
        </div>
      </section>

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
          <li>프로젝트 패스는 구매한 작품 1개에만 적용돼요. 다른 작품은 무료 기준으로 이용해요.</li>
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

      <section className="lp-section">
        <div className="lp-final">
          <h2>
            다음 작품의 캐스팅,
            <br />
            지금 시작해 보세요
          </h2>
          <p>파일럿 기간에는 제작진도 무료로 공고를 올리고, 배우는 언제나 무료로 지원해요.</p>
          {ctas}
        </div>
      </section>

      <footer className="lp-footer">
        <Brand />
        <span>좋은 이야기는, 좋은 사람으로부터 · 캐스팅의 새로운 기준</span>
      </footer>
    </main>
  );
}
