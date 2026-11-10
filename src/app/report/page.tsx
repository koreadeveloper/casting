import type { Metadata } from 'next';
import Link from 'next/link';
import BackButton from '@/components/back-button';
import { Brand } from '@/components/brand';
import { REPORT_TARGETS, reportReasons } from '@/lib/report-rules';
import { resolveReportTarget } from '@/lib/reports';
import ReportForm from './report-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '신고하기 · 캐스팅플로우',
  robots: { index: false, follow: false },
};

/**
 * 신고하기. /report?type=role|actor|chat&id=... (대화를 배우가 신고할 때는 &t=지원 현황 토큰)
 * 대상과 신고할 자격은 서버에서 확인한다(lib/reports.ts). 확인이 안 되면 문의하기로 안내한다.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const receipt = typeof params.t === 'string' ? params.t : '';
  const target = await resolveReportTarget(params.type, params.id, receipt);
  if (!target)
    return (
      <main className="auth-page">
        <header className="auth-top">
          <Brand />
        </header>
        <section className="auth-card">
          <BackButton fallback="/" label="뒤로" />
          <h1>신고할 대상을 찾지 못했어요</h1>
          <p className="muted">
            이미 내려간 공고이거나, 신고할 수 있는 권한이 없는 화면이에요. 문의하기에서 신고를 보내
            주시면 확인할게요.
          </p>
          <Link
            className="button button-primary full"
            href="/contact?type=report"
            style={{ marginTop: 20 }}
          >
            문의하기로 신고하기
          </Link>
        </section>
      </main>
    );
  return (
    <ReportForm
      type={target.type}
      id={typeof params.id === 'string' ? params.id : ''}
      receipt={receipt}
      typeLabel={REPORT_TARGETS[target.type]}
      targetLabel={target.label}
      reasons={reportReasons(target.type, target.side)}
      accountEmail={target.reporterEmail}
    />
  );
}
