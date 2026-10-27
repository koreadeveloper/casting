import Link from 'next/link';
import { Brand, BrandIcon, type BrandIconName } from '@/components/brand';
import { DemoEntry } from '@/components/demo-entry';
import { demoFace } from '@/lib/demo-faces';
import { getSession, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const collage = [1, 2, 7, 6, 4];

const values = [
  ['sparkle', '맞춤 추천', '배역 조건과 프로필을 비교해 적합도 순으로 제안'],
  ['bolt', '빠른 검토', '카드·목록으로 지원자를 한 화면에서 비교'],
  ['team', '팀 협업', '감독·PD가 함께 후보를 정리'],
];

const features = [
  ['배우 검색·탐색', '성별·연령·키·지역·특기·출연 가능일로 원하는 배우를 바로 찾습니다.'],
  ['지원 링크', '필름메이커스·SNS 공고에 링크 하나만 붙이면 지원서가 한곳에 모입니다.'],
  ['캐스팅 제안', '마음에 드는 배우에게 배역을 골라 바로 제안하고 응답을 받습니다.'],
  ['오디션 일정', '시간 후보를 보내면 배우가 고르고, 확정까지 대화에서 끝냅니다.'],
];

export default async function Landing() {
  const session = await getSession();
  const demo = process.env.DEMO_MODE === 'true';
  const start = session ? homeFor(session.role) : demo ? '/login' : '/signup';
  return (
    <main className="landing-page">
      <header className="lp-nav">
        <Brand />
        <nav className="lp-links">
          <a href="#about">서비스 소개</a>
          <a href="#features">주요 기능</a>
          <a href="#how">이용 방법</a>
          <a href="#pricing">요금제</a>
        </nav>
        <div className="lp-auth">
          {session ? (
            <Link className="button button-primary sm" href={start}>
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
          <h1>
            좋은 이야기는
            <br />
            <em>좋은 사람</em>으로부터
          </h1>
          <p>
            영화, 드라마, 광고. 다양한 프로젝트의 제작자와 배우를
            <br className="desk-only" /> 더 빠르고 정확하게 연결하는 캐스팅 플랫폼입니다.
          </p>
          <div className="lp-values">
            {values.map(([icon, title, desc]) => (
              <div key={title}>
                <span>
                  <BrandIcon name={icon as BrandIconName} size={26} />
                </span>
                <strong>{title}</strong>
                <small>{desc}</small>
              </div>
            ))}
          </div>
          {demo ? (
            <DemoEntry />
          ) : (
            <div className="lp-cta">
              <Link className="button button-primary" href={start}>
                시작하기 →
              </Link>
              <Link className="button button-outline" href="/actor">
                모집 중인 배역 보기
              </Link>
            </div>
          )}
          {!demo && !session && <DemoEntry />}
        </div>
        <div className="lp-collage" aria-hidden>
          {collage.map((id, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} className={`c${index}`} src={demoFace(id)} alt="" />
          ))}
          <div className="lp-bubble">
            새로운 이야기를
            <br />
            함께해요
          </div>
        </div>
      </section>

      <section className="lp-section" id="features">
        <h2>주요 기능</h2>
        <div className="lp-grid">
          {features.map(([title, desc]) => (
            <div key={title} className="lp-card">
              <strong>{title}</strong>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="how">
        <h2>이용 방법</h2>
        <ol className="lp-steps">
          <li>
            <b>1</b>
            <strong>{demo ? '역할 선택하고 바로 체험' : '가입하고 역할 선택'}</strong>
            <span>제작자 또는 배우로 시작합니다.</span>
          </li>
          <li>
            <b>2</b>
            <strong>프로젝트 등록 · 프로필 작성</strong>
            <span>제작자는 배역을, 배우는 프로필을 올립니다.</span>
          </li>
          <li>
            <b>3</b>
            <strong>탐색 · 제안 · 오디션</strong>
            <span>배우를 찾고 제안하고, 일정을 확정합니다.</span>
          </li>
        </ol>
      </section>

      <section className="lp-section" id="pricing">
        <h2>요금제</h2>
        <div className="lp-grid two">
          <div className="lp-card">
            <span className="badge-soft">Basic</span>
            <strong className="price">무료</strong>
            <p>배역 등록, 지원 링크, 지원자 관리, 배우 검색. 배우는 언제나 무료입니다.</p>
          </div>
          <div className="lp-card accent">
            <span className="badge-soft">Casting Assist</span>
            <strong className="price">프로젝트 단위 · 준비 중</strong>
            <p>맞춤 추천, 셀프테이프 요청, 이상형 월드컵 비교와 팀 워크스페이스.</p>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <Brand />
        <span>좋은 이야기는, 좋은 사람으로부터 · 캐스팅의 새로운 기준</span>
      </footer>
    </main>
  );
}
