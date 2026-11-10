'use client';

import { useEffect } from 'react';

// 관리자 화면을 그리다 서버 오류가 나면 빈 오류 화면 대신 다시 시도할 수 있게 한다.
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('관리자 화면 오류', error);
  }, [error]);
  return (
    <main className="admin-page">
      <section className="admin-body">
        <h1 className="page-title">관리자</h1>
        <div className="empty-card">
          <p>화면을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.</p>
          <button type="button" className="button button-primary" onClick={() => retry()}>
            다시 불러오기
          </button>
          {error.digest && <p className="small-note">오류 번호 {error.digest}</p>}
        </div>
      </section>
    </main>
  );
}
