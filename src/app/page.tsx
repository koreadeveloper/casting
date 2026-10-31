import Link from 'next/link';
import { Brand } from '@/components/brand';
import LandingGuide, { type ViewRole } from '@/components/landing/landing-guide';
import { getSession, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
        {/* 요금은 아직 정하지 않았다. 확정 전에는 가격안을 싣지 않고, 지금 무료로 운영 중이라는 사실만 알린다. */}
        <section className="lp-section" id="pricing">
          <h2>요금제</h2>
          <div className="lp-pilot">
            <span className="lp-pilot-tag">지금 · 파일럿 기간</span>
            <strong>현재 제공 중인 기능을 모두 무료로 이용할 수 있어요.</strong>
            <p>
              파일럿 기간에는 팀원 수·작품 수 제한 없이 쓸 수 있어요. 유료 전환을 하게 되면 미리
              안내하며, 직접 구매하지 않으면 결제되지 않아요. 배우는 언제나 무료예요.
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
        </section>
      </LandingGuide>

      <footer className="lp-footer">
        <Brand />
        <span>좋은 이야기는, 좋은 사람으로부터 · 캐스팅의 새로운 기준</span>
      </footer>
    </main>
  );
}
