'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Notice = {
  text: string;
  tone: 'info' | 'warn';
  link: string;
  linkLabel: string;
  updatedAt: string;
};

const KEY = 'site-notice-closed';

/**
 * 관리자가 /admin/notice에서 켠 공지 띠. 화면 맨 위에 뜨고, 닫으면 같은 공지는 다시 뜨지 않는다.
 * 공지를 고치면(updatedAt이 바뀌면) 닫았던 사람에게도 다시 보인다.
 */
export default function SiteNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const path = usePathname();

  useEffect(() => {
    let alive = true;
    fetch('/api/notice')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { notice?: Notice | null } | null) => {
        if (!alive || !data?.notice) return;
        let closed = '';
        try {
          closed = localStorage.getItem(KEY) || '';
        } catch {
          /* 저장소를 못 쓰면 늘 보여 준다 */
        }
        setNotice(closed === data.notice.updatedAt ? null : data.notice);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // 관리자 공지 편집 화면에서는 미리보기가 따로 있어 띄우지 않는다.
  if (!notice || path?.startsWith('/admin/notice')) return null;

  function close() {
    try {
      localStorage.setItem(KEY, notice!.updatedAt);
    } catch {
      /* 저장 못 해도 이번에는 닫는다 */
    }
    setNotice(null);
  }

  return <NoticeBar notice={notice} onClose={close} />;
}

export function NoticeBar({ notice, onClose }: { notice: Notice; onClose?: () => void }) {
  return (
    <div className={`site-notice site-notice-${notice.tone}`} role="status">
      <span>
        {notice.tone === 'warn' ? '⚠️ ' : '📢 '}
        {notice.text}
        {notice.link && (
          <>
            {' '}
            <a href={notice.link}>{notice.linkLabel || '자세히 보기'}</a>
          </>
        )}
      </span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="공지 닫기">
          ×
        </button>
      )}
    </div>
  );
}
