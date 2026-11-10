'use client';

import { useState } from 'react';
import { NoticeBar } from '@/components/site-notice';
import type { SiteNotice } from '@/lib/site-notice';
import { formatDateTime } from '../format';

const MAX = 200;

export default function NoticeClient({ initial }: { initial: SiteNotice }) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const set = (patch: Partial<SiteNotice>) => setForm((current) => ({ ...current, ...patch }));

  async function save(next: SiteNotice) {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const response = await fetch('/api/admin/notice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '저장하지 못했어요.');
      setForm(data.notice);
      setSaved(data.notice);
      setOk(data.notice.on ? '공지를 켰어요. 30초 안에 사이트에 보여요.' : '공지를 껐어요.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-body">
      <h1 className="page-title">공지 띠</h1>
      <p className="muted admin-lead">
        모든 화면 맨 위에 짧은 공지를 띄워요. 점검 안내, 새 기능 소식 등에 써 주세요. 방문자가
        닫으면 같은 공지는 다시 안 뜨고, 내용을 고치면 다시 보여요.
      </p>
      <div className="admin-card">
        <div className="admin-card-head">
          <h2>
            지금 상태:{' '}
            {saved.on ? (
              <span className="status-chip admin-chip-new">켜짐</span>
            ) : (
              <span className="status-chip">꺼짐</span>
            )}
          </h2>
          {saved.updatedAt && (
            <span className="small-note">마지막 저장 {formatDateTime(saved.updatedAt)}</span>
          )}
        </div>
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save({ ...form, on: true });
          }}
        >
          <label>
            공지 내용 ({form.text.length}/{MAX})
            <textarea
              value={form.text}
              onChange={(event) => set({ text: event.target.value.slice(0, MAX) })}
              rows={2}
              placeholder="예: 11월 15일 오전 2시~4시 점검으로 잠시 접속이 안 돼요."
            />
          </label>
          <div className="chip-pick" role="group" aria-label="공지 색">
            {(
              [
                ['info', '일반 (연두)'],
                ['warn', '주의 (주황)'],
              ] as const
            ).map(([tone, label]) => (
              <button
                key={tone}
                type="button"
                className={form.tone === tone ? 'on' : ''}
                aria-pressed={form.tone === tone}
                onClick={() => set({ tone })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="admin-form-row">
            <label>
              링크 (선택)
              <input
                value={form.link}
                onChange={(event) => set({ link: event.target.value })}
                placeholder="/contact 또는 https://…"
              />
            </label>
            <label>
              링크 글자 (선택)
              <input
                value={form.linkLabel}
                onChange={(event) => set({ linkLabel: event.target.value.slice(0, 30) })}
                placeholder="자세히 보기"
              />
            </label>
          </div>
          <div>
            <span className="small-note">미리보기</span>
            <div className="admin-notice-preview">
              {form.text.trim() ? (
                <NoticeBar notice={{ ...form, text: form.text.trim() }} onClose={() => undefined} />
              ) : (
                <p className="small-note" style={{ margin: 12 }}>
                  내용을 적으면 여기에 보여요.
                </p>
              )}
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {ok && <p className="form-ok">{ok}</p>}
          <div className="admin-note-actions">
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || !form.text.trim()}
            >
              {saved.on ? '고쳐서 다시 띄우기' : '공지 켜기'}
            </button>
            {saved.on && (
              <button
                type="button"
                className="button button-outline"
                disabled={busy}
                onClick={() => void save({ ...form, on: false })}
              >
                공지 끄기
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
