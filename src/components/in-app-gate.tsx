'use client';

import { useEffect, useState } from 'react';
import {
  ANDROID_BROWSERS,
  androidIntentUrl,
  detectInApp,
  IN_APP_LABEL,
  iosChromeUrl,
  iosSafariUrl,
  kakaoExternalUrl,
  lineExternalUrl,
  platformOf,
  type InAppKind,
  type Platform,
} from '@/lib/in-app';

/**
 * 앱 안 브라우저(카카오톡·인스타그램·에브리타임 등)에서 열리면 바깥 브라우저로 옮긴다.
 * 구글 로그인이 앱 안 브라우저에서는 막히기 때문에, 화면을 쓰기 전에 브라우저를 고르게 한다.
 * - 카카오톡·라인: 자동으로 바깥 브라우저로 넘긴다. 넘어가지 않을 때를 대비해 아래 화면도 띄운다.
 * - 그 밖의 앱: 이 화면을 닫을 수 없고, 열 브라우저를 고르거나 주소를 복사해야 한다.
 */
export default function InAppGate() {
  const [kind, setKind] = useState<InAppKind | null>(null);
  const [platform, setPlatform] = useState<Platform>('other');
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const found = detectInApp(navigator.userAgent);
    if (!found) return;
    const here = location.href;
    setKind(found);
    setPlatform(platformOf(navigator.userAgent));
    setUrl(here);
    if (found === 'kakaotalk') location.href = kakaoExternalUrl(here);
    else if (found === 'line' && !new URL(here).searchParams.has('openExternalBrowser'))
      location.replace(lineExternalUrl(here));
  }, []);

  if (!kind) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 클립보드를 못 쓰는 앱도 있어서, 주소 칸을 골라 직접 복사할 수 있게 둔다.
      const field = document.getElementById('in-app-url') as HTMLInputElement | null;
      field?.select();
      document.execCommand?.('copy');
    }
    setCopied(true);
  }

  const app = IN_APP_LABEL[kind];
  return (
    <div className="in-app-gate" role="dialog" aria-modal="true" aria-labelledby="in-app-title">
      <div className="in-app-card">
        <span className="in-app-icon" aria-hidden>
          🌐
        </span>
        <h2 id="in-app-title">브라우저에서 열어 주세요</h2>
        <p>
          {app} 안에서는 구글 로그인과 일부 기능이 막혀 있어요. 아래에서 열 브라우저를 골라 주세요.
        </p>
        <div className="in-app-actions">
          {kind === 'kakaotalk' && (
            <a className="button button-primary full" href={kakaoExternalUrl(url)}>
              기본 브라우저로 열기
            </a>
          )}
          {kind === 'line' && (
            <a className="button button-primary full" href={lineExternalUrl(url)}>
              바깥 브라우저로 열기
            </a>
          )}
          {platform === 'android' &&
            ANDROID_BROWSERS.map((browser, index) => (
              <a
                key={browser.packageName}
                className={`button ${index === 0 && kind !== 'kakaotalk' && kind !== 'line' ? 'button-primary' : 'button-outline'} full`}
                href={androidIntentUrl(url, browser.packageName)}
              >
                {browser.label}
              </a>
            ))}
          {platform === 'android' && (
            <a className="button button-outline full" href={androidIntentUrl(url)}>
              다른 브라우저 고르기
            </a>
          )}
          {platform === 'ios' && (
            <>
              <a
                className={`button ${kind === 'kakaotalk' || kind === 'line' ? 'button-outline' : 'button-primary'} full`}
                href={iosSafariUrl(url)}
              >
                Safari로 열기
              </a>
              <a className="button button-outline full" href={iosChromeUrl(url)}>
                Chrome으로 열기
              </a>
            </>
          )}
          <button type="button" className="button button-soft full" onClick={() => void copy()}>
            {copied ? '주소를 복사했어요 ✓' : '주소 복사하기'}
          </button>
        </div>
        <input
          id="in-app-url"
          className="in-app-url"
          value={url}
          readOnly
          aria-label="이 화면 주소"
          onFocus={(event) => event.currentTarget.select()}
        />
        <p className="in-app-help">
          버튼으로 열리지 않으면 화면 오른쪽 위(또는 아래)의 <b>⋯</b> 메뉴에서 &lsquo;다른
          브라우저로 열기&rsquo;·&lsquo;Safari로 열기&rsquo;를 누르거나, 주소를 복사해 브라우저에
          붙여 넣어 주세요.
        </p>
      </div>
    </div>
  );
}
