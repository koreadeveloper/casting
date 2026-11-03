// 앱 안 브라우저(인앱 브라우저) 판별과 바깥 브라우저로 여는 주소.
// 구글은 앱 안 브라우저에서의 로그인을 정책상 막는다(403 disallowed_useragent). 그래서
// - 카카오톡: 자동으로 기본 브라우저로 넘긴다(카카오톡 전용 주소).
// - 라인: 주소에 openExternalBrowser=1을 붙이면 바깥 브라우저로 열린다.
// - 그 밖의 앱(인스타그램·에브리타임·페이스북·네이버 등): 쓰기 전에 열 브라우저를 고르게 한다.
// DB·Next에 기대지 않아 테스트로 지킨다.

export type InAppKind =
  | 'kakaotalk'
  | 'line'
  | 'instagram'
  | 'facebook'
  | 'everytime'
  | 'naver'
  | 'daum'
  | 'band'
  | 'threads'
  | 'tiktok'
  | 'webview';

export type Platform = 'android' | 'ios' | 'other';

export const IN_APP_LABEL: Record<InAppKind, string> = {
  kakaotalk: '카카오톡',
  line: '라인',
  instagram: '인스타그램',
  facebook: '페이스북',
  everytime: '에브리타임',
  naver: '네이버 앱',
  daum: '다음 앱',
  band: '밴드',
  threads: '스레드',
  tiktok: '틱톡',
  webview: '앱',
};

// 앞에서부터 먼저 맞는 것을 고른다. 이름이 분명한 앱을 먼저 보고, 마지막에 안드로이드 웹뷰 일반 표시(wv)를 본다.
const RULES: [InAppKind, RegExp][] = [
  ['kakaotalk', /KAKAOTALK/i],
  ['line', /\bLine\//],
  ['instagram', /Instagram/i],
  ['facebook', /FBAN|FBAV|FB_IAB|FBIOS/i],
  ['everytime', /everytime/i],
  ['naver', /NAVER\(inapp/i],
  ['daum', /DaumApps/i],
  ['band', /\bBAND\//],
  ['threads', /Barcelona/],
  ['tiktok', /musical_ly|BytedanceWebview|TikTok/i],
];

export function platformOf(userAgent: string): Platform {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return 'other';
}

/**
 * 앱 안 브라우저면 그 종류, 아니면 null.
 * iOS는 홈 화면에 설치한 웹앱(PWA)도 사파리 표시가 없어서, 이름이 분명한 앱만 잡는다.
 * 안드로이드는 앱 안 웹뷰에 붙는 '; wv)' 표시도 잡는다(크롬·삼성 인터넷·설치한 웹앱에는 없다).
 */
export function detectInApp(userAgent: string): InAppKind | null {
  for (const [kind, rule] of RULES) if (rule.test(userAgent)) return kind;
  if (platformOf(userAgent) === 'android' && /; wv\)/.test(userAgent)) return 'webview';
  return null;
}

/** 카카오톡에서 기본 브라우저로 여는 주소 */
export function kakaoExternalUrl(url: string) {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}

/** 라인에서 바깥 브라우저로 여는 주소 */
export function lineExternalUrl(url: string) {
  const target = new URL(url);
  target.searchParams.set('openExternalBrowser', '1');
  return target.toString();
}

/** 안드로이드: 지정한 브라우저 앱으로 연다. 앱을 지정하지 않으면 기본 브라우저(또는 고르기 창). */
export function androidIntentUrl(url: string, packageName?: string) {
  const target = new URL(url);
  const scheme = target.protocol.replace(':', '');
  const fallback = `S.browser_fallback_url=${encodeURIComponent(url)};`;
  return `intent://${target.host}${target.pathname}${target.search}${target.hash}#Intent;scheme=${scheme};${
    packageName
      ? `package=${packageName};`
      : 'action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;'
  }${fallback}end`;
}

export const ANDROID_BROWSERS = [
  { label: 'Chrome으로 열기', packageName: 'com.android.chrome' },
  { label: '삼성 인터넷으로 열기', packageName: 'com.sec.android.app.sbrowser' },
];

/** iOS: 사파리로 여는 주소(iOS 17 이상) */
export function iosSafariUrl(url: string) {
  return url.replace(/^https:\/\//, 'x-safari-https://').replace(/^http:\/\//, 'x-safari-http://');
}

/** iOS: 크롬으로 여는 주소(크롬이 깔려 있을 때) */
export function iosChromeUrl(url: string) {
  return url.replace(/^https:\/\//, 'googlechromes://').replace(/^http:\/\//, 'googlechrome://');
}
