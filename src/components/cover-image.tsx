'use client';

import { useEffect, useRef } from 'react';

/**
 * 작품 포스터. 파일을 못 불러오면(지워졌거나 다른 저장소에 올라간 경우) 깨진 아이콘 대신
 * 기본 커버를 보여 준다.
 */
export default function CoverImage({
  src,
  fallback = '/covers/etc.svg',
  alt = '',
  loading,
}: {
  src: string;
  fallback?: string;
  alt?: string;
  loading?: 'lazy' | 'eager';
}) {
  const ref = useRef<HTMLImageElement>(null);

  function showFallback(img: HTMLImageElement) {
    if (!img.src.endsWith(fallback)) img.src = fallback;
  }

  // 서버에서 그린 이미지는 화면이 반응하기 전에 이미 실패했을 수 있어 onError가 안 불린다. 붙은 뒤 한 번 더 본다.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) showFallback(img);
  });

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={loading}
      onError={(event) => showFallback(event.currentTarget)}
    />
  );
}
