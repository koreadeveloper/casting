import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '캐스팅플로우',
    short_name: '캐스팅플로우',
    description: '학생·독립영화 제작팀과 신인 배우를 위한 캐스팅 플랫폼',
    start_url: '/studio',
    display: 'standalone',
    // 설치 앱을 켤 때 아이콘 뒤로 보이는 바탕. 앱 아이콘 바탕색(옵시디언 검정)과 맞춘다.
    background_color: '#0b0d12',
    theme_color: '#f4f6fa',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // 안드로이드가 아이콘을 동그라미·물방울 모양으로 잘라도 캐릭터가 잘리지 않게 여백을 둔 판
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
