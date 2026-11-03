import assert from 'node:assert/strict';
import test from 'node:test';
import { detectInAppBrowser, externalBrowserUrl } from '../src/lib/in-app-browser.ts';

const UA = {
  kakaoIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5',
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.193 Mobile Safari/537.36;KAKAOTALK 2410440',
  lineIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.16.0',
  lineAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A536N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 Line/13.16.0/IAB',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 309.0.0.40.113 (iPhone15,2; iOS 17_0; ko_KR; ko)',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-G991N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/442.0.0.33.113;]',
  naverIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.0.5; 15PRO)',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 12; SM-A325N Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36',
  safari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

test('앱 안의 브라우저: 카카오톡·라인은 따로 알아본다 (안드로이드 웹뷰 표시가 있어도)', () => {
  assert.equal(detectInAppBrowser(UA.kakaoIos), 'kakaotalk');
  assert.equal(detectInAppBrowser(UA.kakaoAndroid), 'kakaotalk');
  assert.equal(detectInAppBrowser(UA.lineIos), 'line');
  assert.equal(detectInAppBrowser(UA.lineAndroid), 'line');
});

test('앱 안의 브라우저: 인스타그램·페이스북·네이버 앱과 안드로이드 웹뷰는 그 밖의 앱', () => {
  for (const ua of [UA.instagram, UA.facebookAndroid, UA.naverIos, UA.androidWebView])
    assert.equal(detectInAppBrowser(ua), 'other', ua);
});

test('앱 안의 브라우저: 일반 브라우저와 빈 값은 아니다', () => {
  for (const ua of [UA.safari, UA.chromeIos, UA.chromeAndroid, UA.samsung, UA.desktop])
    assert.equal(detectInAppBrowser(ua), null, ua);
  assert.equal(detectInAppBrowser(''), null);
  assert.equal(detectInAppBrowser(null), null);
  assert.equal(detectInAppBrowser(undefined), null);
});

test('기본 브라우저로 열기: 카카오톡은 kakaotalk 주소, 라인은 openExternalBrowser=1', () => {
  const url = 'https://casting-swipe.vercel.app/api/auth/google/start?next=%2Fsignup%2Factor';
  assert.equal(
    externalBrowserUrl('kakaotalk', url),
    `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`,
  );
  const line = new URL(externalBrowserUrl('line', url));
  assert.equal(line.searchParams.get('openExternalBrowser'), '1');
  assert.equal(line.searchParams.get('next'), '/signup/actor');
  assert.equal(line.pathname, '/api/auth/google/start');
});

test('기본 브라우저로 열기: 공식 방법이 없는 앱은 null (화면에서 안내)', () => {
  assert.equal(externalBrowserUrl('other', 'https://casting-swipe.vercel.app/login'), null);
});
