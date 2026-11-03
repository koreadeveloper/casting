import Link from 'next/link';
import BackButton from './back-button';
import { Brand } from './brand';
import { LEGAL, PRIVACY_PATH, TERMS_PATH } from '@/lib/legal';

/** 이용약관·개인정보처리방침이 함께 쓰는 문서 화면. */
export default function LegalPage({
  title,
  current,
  children,
}: {
  title: string;
  current: 'terms' | 'privacy';
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page legal-page">
      <header className="auth-top">
        <Brand />
        <nav className="legal-nav" aria-label="약관 문서">
          <Link href={TERMS_PATH} aria-current={current === 'terms' ? 'page' : undefined}>
            이용약관
          </Link>
          <Link href={PRIVACY_PATH} aria-current={current === 'privacy' ? 'page' : undefined}>
            개인정보처리방침
          </Link>
        </nav>
      </header>
      <article className="legal-doc">
        <BackButton fallback="/" label="뒤로" />
        <h1>{title}</h1>
        <p className="legal-meta">시행일 {LEGAL.effective}</p>
        {children}
      </article>
    </main>
  );
}

/** 문서 안의 표. 좁은 화면에서는 줄마다 '항목명: 내용' 카드로 쌓인다(data-label). */
export function LegalTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="legal-table">
      <table>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) => (
                <td key={column} data-label={head[column]}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
