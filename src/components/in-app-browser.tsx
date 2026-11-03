'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { externalBrowserUrl, type InAppBrowser } from '@/lib/in-app-browser';

const APP_NAME: Record<InAppBrowser, string> = {
  kakaotalk: '카카오톡',
  line: '라인',
  other: '이 앱',
};

/** 앱 안의 브라우저에서 구글 버튼 위에 보여 주는 안내. 구글이 이런 브라우저의 로그인을 막는다. */
export function InAppBrowserNotice({ kind }: { kind: InAppBrowser }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt('이 주소를 복사해 사파리나 크롬에 붙여 넣어 주세요.', window.location.href);
    }
  }

  return (
    <div className="inapp-notice" role="note">
      <strong>{APP_NAME[kind]} 안에서는 구글 로그인이 되지 않아요</strong>
      {kind === 'other' ? (
        <>
          <p>
            오른쪽 위 메뉴(⋯ 또는 ⋮)에서 &lsquo;다른 브라우저로 열기&rsquo;를 누르거나, 주소를
            복사해 사파리·크롬에서 열어 주세요.
          </p>
          <button type="button" className="button button-outline sm full" onClick={copyLink}>
            {copied ? '주소를 복사했어요' : '주소 복사하기'}
          </button>
        </>
      ) : (
        <p>아래 버튼을 누르면 휴대폰의 기본 브라우저(사파리·크롬)에서 이어서 진행돼요.</p>
      )}
    </div>
  );
}

/** 로그인 버튼 링크. 카카오톡·라인 안이면 구글 화면을 기본 브라우저에서 바로 연다. */
export function SocialLink({
  href,
  inApp,
  className,
  children,
}: {
  href: string;
  /** 바깥 브라우저로 보낼 때만 넘긴다(카카오 로그인은 카카오톡 안에서도 되므로 null). */
  inApp: InAppBrowser | null;
  className: string;
  children: ReactNode;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!inApp) return;
    const target = externalBrowserUrl(inApp, new URL(href, window.location.href).toString());
    if (!target) return;
    event.preventDefault();
    window.location.href = target;
  }

  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
