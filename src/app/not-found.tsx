import type { Metadata } from 'next';
import Link from 'next/link';
import { Brand, BrandIcon } from '@/components/brand';

export const metadata: Metadata = { title: '페이지를 찾을 수 없어요 · 캐스팅플로우' };

/** 없는 주소나 지워진 공고에 들어왔을 때의 화면 (Next 기본 영어 404 대신). */
export default function NotFound() {
  return (
    <main className="auth-page">
      <header className="auth-top">
        <Brand />
      </header>
      <section className="auth-card fallback-card">
        <div className="fallback-art">
          <BrandIcon name="mascot" size={84} />
        </div>
        <p className="fallback-code">404</p>
        <h1>페이지를 찾을 수 없어요</h1>
        <p className="muted">
          주소가 바뀌었거나, 마감·삭제된 공고일 수 있어요. 받은 링크를 다시 확인해 주세요.
        </p>
        <div className="fallback-actions">
          <Link className="button button-primary full" href="/">
            첫 화면으로
          </Link>
          <Link className="button button-outline full" href="/contact">
            문의하기
          </Link>
        </div>
      </section>
    </main>
  );
}
