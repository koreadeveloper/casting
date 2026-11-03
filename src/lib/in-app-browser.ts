// 카카오톡·인스타그램처럼 앱 안에서 열리는 브라우저(인앱 브라우저)를 알아본다.
// 구글은 이런 브라우저에서 로그인을 막는다(403 disallowed_useragent). 가입이 구글로만 되므로
// 카카오톡·라인은 같은 주소를 휴대폰의 기본 브라우저로 열어 주고, 나머지 앱은 여는 방법을 안내한다.
// (리프 모듈: 서버의 요청 머리글과 브라우저 양쪽에서 쓰고, node --test에서 바로 불러온다)

export type InAppBrowser = 'kakaotalk' | 'line' | 'other';

/** 앱 안의 브라우저면 그 종류를, 일반 브라우저(사파리·크롬·삼성 인터넷 등)면 null을 돌려준다. */
export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  const ua = userAgent ?? '';
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/\sLine\/\d/.test(ua)) return 'line';
  // 인스타그램, 페이스북, 네이버·다음 앱, 그리고 안드로이드 앱 속 웹뷰(; wv))
  if (/Instagram|FBAN|FBAV|FB_IAB|NAVER\(inapp|DaumApps|; wv\)/i.test(ua)) return 'other';
  return null;
}

/**
 * 같은 주소를 휴대폰의 기본 브라우저로 여는 주소. 공식 방법이 있는 카카오톡·라인만 돌려주고,
 * 나머지 앱은 null이다(화면에서 '다른 브라우저로 열기' 메뉴를 안내한다).
 */
export function externalBrowserUrl(kind: InAppBrowser, url: string): string | null {
  if (kind === 'kakaotalk') return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  if (kind === 'line') {
    const target = new URL(url);
    target.searchParams.set('openExternalBrowser', '1');
    return target.toString();
  }
  return null;
}
