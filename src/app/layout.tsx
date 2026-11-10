import type { Metadata, Viewport } from 'next';
import { NavTracker } from '@/components/back-button';
import './globals.css';
import { NAV_BOOT_SCRIPT } from '@/components/nav-collapse';
import InAppGate from '@/components/in-app-gate';
import PilotBanner from '@/components/pilot-banner';
import SiteNotice from '@/components/site-notice';

const DESCRIPTION =
  '학생·독립영화 제작팀과 신인 배우를 위한 캐스팅 플랫폼. 공고부터 최종 합격까지 한곳에서.';

/** 공유 미리보기 이미지 주소를 완성할 사이트 주소(운영·데모가 각자 자기 주소를 쓴다) */
function siteUrl() {
  const url =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://castingflow-kr.vercel.app');
  return new URL(url);
}

const BLOCK_INSTALL_PROMPT = true;
/** 지인 대상 파일럿 기간 동안 화면 맨 위에 안내 띠를 띄운다. 정식 공개 때 false로. */
const PILOT_NOTICE = true;
const NO_INSTALL_PROMPT = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault()})`;

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: '캐스팅플로우',
  description: DESCRIPTION,
  // 카카오톡·인스타그램 등에 링크를 보냈을 때 보이는 미리보기(제목·설명·큰 이미지)
  openGraph: {
    type: 'website',
    siteName: '캐스팅플로우',
    locale: 'ko_KR',
    title: '캐스팅플로우 · 공고부터 합격까지 한곳에서',
    description: DESCRIPTION,
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: '캐스팅플로우' }],
  },
  twitter: { card: 'summary_large_image' },
  applicationName: '캐스팅플로우',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '캐스팅플로우' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4f6fa',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: NAV_BOOT_SCRIPT }} />
        {/* 잠시 막음: 크롬·삼성 인터넷이 링크를 열자마자 띄우는 '앱 설치' 안내. 브라우저 메뉴의
            '홈 화면에 추가'로는 계속 설치할 수 있다. 다시 띄우려면 BLOCK_INSTALL_PROMPT를 false로. */}
        {BLOCK_INSTALL_PROMPT && <script dangerouslySetInnerHTML={{ __html: NO_INSTALL_PROMPT }} />}
        {/* 관리자가 /admin/notice에서 켜는 공지 띠 */}
        <SiteNotice />
        {PILOT_NOTICE && <PilotBanner />}
        <NavTracker />
        {children}
        {/* 카카오톡·인스타그램 등 앱 안 브라우저면 바깥 브라우저로 옮긴다(구글 로그인이 막혀서) */}
        <InAppGate />
      </body>
    </html>
  );
}
