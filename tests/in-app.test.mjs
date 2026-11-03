import assert from 'node:assert/strict';
import test from 'node:test';
import {
  androidIntentUrl,
  detectInApp,
  iosChromeUrl,
  iosSafariUrl,
  kakaoExternalUrl,
  lineExternalUrl,
  platformOf,
} from '../src/lib/in-app.ts';

const UA = {
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36;KAKAOTALK 2410420',
  kakaoIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone15,2; iOS 17_5; ko_KR)',
  everytimeAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-G991N Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0 Mobile Safari/537.36 everytimeApp/5.1.0',
  lineIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0 Mobile Safari/537.36',
  safari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  // 홈 화면에 설치한 웹앱(PWA)은 사파리 표시가 없다. 막으면 안 된다.
  iosPwa:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

test('앱 안 브라우저를 알아본다', () => {
  assert.equal(detectInApp(UA.kakaoAndroid), 'kakaotalk');
  assert.equal(detectInApp(UA.kakaoIos), 'kakaotalk');
  assert.equal(detectInApp(UA.instagramIos), 'instagram');
  assert.equal(detectInApp(UA.everytimeAndroid), 'everytime');
  assert.equal(detectInApp(UA.lineIos), 'line');
});

test('일반 브라우저와 설치한 웹앱은 막지 않는다', () => {
  for (const ua of [UA.chromeAndroid, UA.samsung, UA.safari, UA.iosPwa, UA.desktop])
    assert.equal(detectInApp(ua), null, ua);
});

test('바깥 브라우저로 여는 주소', () => {
  const url = 'https://casting-swipe.vercel.app/apply/abc?ref=kakao';
  assert.equal(
    kakaoExternalUrl(url),
    'kakaotalk://web/openExternal?url=https%3A%2F%2Fcasting-swipe.vercel.app%2Fapply%2Fabc%3Fref%3Dkakao',
  );
  assert.equal(
    lineExternalUrl(url),
    'https://casting-swipe.vercel.app/apply/abc?ref=kakao&openExternalBrowser=1',
  );
  assert.match(
    androidIntentUrl(url, 'com.android.chrome'),
    /^intent:\/\/casting-swipe\.vercel\.app\/apply\/abc\?ref=kakao#Intent;scheme=https;package=com\.android\.chrome;S\.browser_fallback_url=.+;end$/,
  );
  assert.match(androidIntentUrl(url), /action=android\.intent\.action\.VIEW/);
  assert.equal(iosSafariUrl(url), 'x-safari-https://casting-swipe.vercel.app/apply/abc?ref=kakao');
  assert.equal(iosChromeUrl(url), 'googlechromes://casting-swipe.vercel.app/apply/abc?ref=kakao');
  assert.equal(platformOf(UA.kakaoIos), 'ios');
  assert.equal(platformOf(UA.everytimeAndroid), 'android');
});
