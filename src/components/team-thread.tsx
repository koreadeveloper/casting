'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TeamMessage } from '@/lib/inbox';

/** 공고의 팀 내부방(주인·팀원만, 배우 없음). 8초마다 새 메시지를 불러온다. */
export default function TeamThread({
  projectId,
  projectTitle,
  members,
  onClose,
}: {
  projectId: string;
  projectTitle: string;
  members?: number;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [me, setMe] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const endpoint = `/api/team-chat/${projectId}`;

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || '대화를 불러오지 못했어요.');
        return;
      }
      setMessages(data.messages);
      setMe(data.me);
    } catch {
      /* 다음 차례에 다시 불러온다 */
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '보내지 못했어요.');
      setDraft('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '보내지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-thread">
      <div className="chat-peer">
        <button className="text-button" style={{ padding: 0 }} onClick={onClose} aria-label="뒤로">
          ‹
        </button>
        <div className="who">
          <strong>팀 내부방</strong>
          <span>
            {projectTitle}
            {members ? ` · 제작진 ${members}명` : ''}
          </span>
        </div>
      </div>
      <p className="chat-room-note">제작진끼리만 보는 방이에요. 배우에게는 보이지 않아요.</p>
      <div className="chat-messages" ref={list} role="log" aria-label="팀 대화 내용">
        {messages.length === 0 && (
          <div className="chat-empty">
            아직 대화가 없어요.
            <br />
            배역 캐스팅에 대해 팀원과 이야기를 나눠 보세요.
          </div>
        )}
        {messages.map((message) => {
          const mine = message.senderId === me;
          return (
            <div key={message.id} className={`bubble-row ${mine ? 'mine' : 'theirs'}`}>
              {!mine && <span className="bubble-name">{message.senderName}</span>}
              <div className="bubble">
                <p>{message.body}</p>
                <small>
                  {new Date(message.createdAt).toLocaleTimeString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </small>
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="chat-compose">
        <input
          aria-label="팀 메시지 입력"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="팀원에게 보낼 메시지"
        />
        <button
          className="send-btn"
          aria-label="메시지 보내기"
          disabled={busy || !draft.trim()}
          onClick={() => void send()}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
