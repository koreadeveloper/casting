import type { Metadata, Viewport } from 'next';
import { NavTracker } from '@/components/back-button';
import './globals.css';

export const metadata: Metadata = {
  title: '캐스팅플로우',
  description:
    '학생·독립영화 제작팀과 신인 배우를 위한 캐스팅 플랫폼. 공고부터 최종 합격까지 한곳에서.',
  applicationName: '캐스팅플로우',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '캐스팅플로우' },
  // 링크 미리보기(카카오톡 등). 제목·설명은 일부러 넣지 않는다: 비워 두면 화면마다 자기 title·description이
  // 미리보기 글자로 쓰인다. 대표 이미지는 app/opengraph-image.tsx가 모든 화면에 붙인다.
  // (화면에서 openGraph를 따로 정하면 이 값과 대표 이미지가 통째로 빠지니, 화면에서는 title·description만 정한다)
  openGraph: { siteName: '캐스팅플로우', locale: 'ko_KR', type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4f6fa',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <NavTracker />
        {children}
      </body>
    </html>
  );
}
