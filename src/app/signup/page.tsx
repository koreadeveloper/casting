import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Brand, BrandIcon } from '@/components/brand';
import { DemoEntry } from '@/components/demo-entry';
import { getSession, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SignupChoice() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
        <Link className="button button-outline sm" href="/login">
          로그인
        </Link>
      </header>
      <section className="auth-card wide-card">
        <h1>지금, 당신의 이야기를 시작하세요</h1>
        <p className="muted">당신의 역할을 선택하고, 캐스팅플로우와 함께하세요.</p>
        <div className="role-cards">
          <Link href="/signup/producer" className="role-card">
            <span className="role-art">
              <BrandIcon name="clapper" size={40} />
            </span>
            <strong>제작자/감독</strong>
            <small>
              좋은 배우를 찾고,
              <br />
              최고의 작품을 만들어 보세요.
            </small>
            <span className="button button-primary full sm">선택하기 →</span>
          </Link>
          <Link href="/signup/actor" className="role-card">
            <span className="role-art">
              <BrandIcon name="masks" size={40} />
            </span>
            <strong>배우</strong>
            <small>
              나의 가능성을 더 많은 작품과
              <br />
              사람들에게 보여주세요.
            </small>
            <span className="button button-primary full sm">선택하기 →</span>
          </Link>
        </div>
        <DemoEntry />
        <div className="divider-text">
          <span>또는 간편하게 시작하기</span>
        </div>
        <div className="social-row">
          <button disabled title="준비 중">
            Google로 시작하기
          </button>
          <button disabled title="준비 중">
            Apple로 시작하기
          </button>
        </div>
        <p className="small-note center">
          Google·Apple 로그인은 준비 중입니다. 위에서 역할을 고르면 이메일로 가입할 수 있어요.
        </p>
      </section>
    </main>
  );
}
