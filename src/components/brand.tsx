/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

// 브랜드 이미지는 public/brand에 있다. 크롬·라임 3D 아이콘과 CASTING FLOW 글씨 로고.
export type BrandIconName = 'masks' | 'sparkle' | 'bolt' | 'team' | 'clapper' | 'mascot';

/** 눈 달린 클래퍼보드 캐릭터 마크. 앱 아이콘과 같은 그림이라 홈 화면 아이콘과 사이트 로고가 같아 보인다. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return <img src="/brand/mark.png" alt="" width={size} height={size} className="brand-cf" />;
}

/** 캐릭터 마크 + CASTING FLOW 글씨 로고. 화면 왼쪽 위 로고 자리에 쓴다. */
export function BrandLogo({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-logo">
      <BrandMark size={size} />
      <img
        src="/brand/wordmark.png"
        alt="캐스팅플로우"
        className="brand-wordmark"
        style={{ height: Math.round(size * 0.82) }}
      />
    </span>
  );
}

/** 이모지 대신 쓰는 3D 아이콘(🎭·✦·⚡·👥·🎬). */
export function BrandIcon({ name, size = 24 }: { name: BrandIconName; size?: number }) {
  return (
    <img
      src={`/brand/${name}.png`}
      alt=""
      aria-hidden
      className="brand-icon"
      style={{ width: size, height: size }}
    />
  );
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand-word" style={{ color: 'inherit' }}>
      <BrandLogo />
    </Link>
  );
}
