import type { Metadata, Viewport } from 'next';
import { NavTracker } from '@/components/back-button';
import './globals.css';

export const metadata: Metadata = {
  title: '캐스팅플로우',
  description:
    '학생·독립영화 제작팀과 신인 배우를 위한 캐스팅 플랫폼. 공고부터 최종 합격까지 한곳에서.',
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
    <html lang="ko">
      <body>
        <NavTracker />
        {children}
      </body>
    </html>
  );
}
