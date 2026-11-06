'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'pilot-banner-hidden-until';
const HIDE_DAYS = 7;

/**
 * 파일럿(지인 대상 시범 운영) 안내 띠. 화면 맨 위에 붙고, 닫으면 7일 동안 다시 뜨지 않는다.
 * 띠가 보이는 동안 html에 data-pilot을 달아, PC 왼쪽 메뉴가 띠 아래에서 시작하게 한다.
 */
export default function PilotBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let hiddenUntil = 0;
    try {
      hiddenUntil = Number(localStorage.getItem(KEY) || 0);
    } catch {
      /* 저장소를 못 쓰면 늘 보여 준다 */
    }
    setShow(Date.now() > hiddenUntil);
  }, []);

  useEffect(() => {
    if (show) document.documentElement.dataset.pilot = '';
    else delete document.documentElement.dataset.pilot;
  }, [show]);

  if (!show) return null;

  function close() {
    try {
      localStorage.setItem(KEY, String(Date.now() + HIDE_DAYS * 86400000));
    } catch {
      /* 저장 못 해도 이번에는 닫는다 */
    }
    setShow(false);
  }

  return (
    <div className="pilot-banner" role="note">
      <span>
        🧪 <b>파일럿 운영 중</b>이에요. 불편한 점이나 오류는 <Link href="/contact">문의하기</Link>로
        알려 주세요.
      </span>
      <button type="button" onClick={close} aria-label="안내 닫기">
        ×
      </button>
    </div>
  );
}
