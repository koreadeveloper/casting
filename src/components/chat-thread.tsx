'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import ChatAttachmentView, { FileBadge } from '@/components/chat-attachment';
import { CHAT_FILE_ACCEPT, CHAT_FILE_MAX_BYTES, formatFileSize } from '@/lib/chat-files';
import type { ChatMessage } from '@/lib/types';

type Props = {
  applicationId: string;
  mode: 'producer' | 'actor';
  receipt?: string;
  peerName: string;
  peerPhoto?: string;
  peerSub: string;
  projectTitle: string;
  roleTitle: string;
  projectImage?: string;
  onViewProfile?: () => void;
  profileHref?: string;
  onClose?: () => void;
};

function slotLabel(slot: string) {
  const date = new Date(`${slot}:00+09:00`);
  if (Number.isNaN(date.valueOf())) return slot;
  const day = date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  });
  const dow = date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' });
  const time = date.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} (${dow}) ${time}`;
}
function slotTime(slot: string) {
  const date = new Date(`${slot}:00+09:00`);
  return Number.isNaN(date.valueOf())
    ? slot
    : date.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}
function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

const Svg = {
  calendar: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.6 12 21 12 21Z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.3" r="2.2" />
    </svg>
  ),
  doc: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M6 3h8l4 4v14H6V3Z" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 12h6M9 16h6" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      aria-hidden
    >
      <path d="m4.5 12.5 5 5 10-11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  send: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.4 20.4 21.8 12 3.4 3.6l-.1 6.5L14 12l-10.7 1.9.1 6.5Z" />
    </svg>
  ),
  clip: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden
    >
      <path
        d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  plus: (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  back: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function ChatThread({
  applicationId,
  mode,
  receipt,
  peerName,
  peerPhoto,
  peerSub,
  projectTitle,
  roleTitle,
  projectImage,
  onViewProfile,
  profileHref,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);
  const [slots, setSlots] = useState(['', '']);
  const [place, setPlace] = useState('');
  const [preparation, setPreparation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(true);
  // 보내기 전에 고른 첨부 파일. 보내기를 누르면 입력한 글과 함께 한 메시지로 간다.
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageList = useRef<HTMLDivElement>(null);

  function pickFile(picked: File | undefined) {
    if (fileInput.current) fileInput.current.value = '';
    if (!picked) return;
    if (picked.size > CHAT_FILE_MAX_BYTES) {
      setError(`파일은 4MB 이하만 보낼 수 있습니다. (고른 파일 ${formatFileSize(picked.size)})`);
      return;
    }
    setError('');
    setFile(picked);
  }

  const endpoint = `/api/chat/${applicationId}`;
  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: receipt ? { 'X-Receipt-Token': receipt } : undefined,
      });
      if (!response.ok) return;
      const data = (await response.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
    } catch {
      /* 연결 안내는 전송 시 표시 */
    }
  }, [endpoint, receipt]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (navigator.onLine) void load();
    }, 8000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight;
  }, [messages.length]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  async function send(kind: 'text' | 'offer') {
    if (!navigator.onLine) {
      setError('연결이 끊겼습니다. 입력 내용은 전송되지 않았습니다.');
      return;
    }
    setBusy(true);
    setError('');
    const payload =
      kind === 'text'
        ? { kind, body: draft }
        : {
            kind,
            body: '오디션 시간을 제안합니다. 가능한 시간을 골라주세요.',
            slots: slots.filter(Boolean),
            place,
            preparation,
          };
    const withFile = kind === 'text' && file;
    let request: RequestInit;
    if (withFile) {
      const form = new FormData();
      form.append('file', withFile);
      form.append('body', draft);
      if (receipt) form.append('receipt', receipt);
      request = { method: 'POST', body: form };
    } else {
      request = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, receipt }),
      };
    }
    try {
      const response = await fetch(withFile ? `${endpoint}/files` : endpoint, request);
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          data.error ||
            (response.status === 413
              ? '파일이 너무 커서 보내지 못했습니다. 4MB 이하로 줄여 주세요.'
              : '전송하지 못했습니다.'),
        );
      if (kind === 'text') {
        setDraft('');
        setFile(null);
      } else {
        setOfferOpen(false);
        setSlots(['', '']);
        setPlace('');
        setPreparation('');
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '전송하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function respond(messageId: string, action: 'confirm') {
    if (!navigator.onLine) {
      setError('연결이 끊겼습니다. 응답이 저장되지 않았습니다.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, action, receipt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '응답을 저장하지 못했습니다.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '응답을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const confirmed = [...messages]
    .reverse()
    .find((item) => item.kind === 'offer' && item.status === 'confirmed');

  let lastDay = '';

  return (
    <div className="chat-thread">
      {mode === 'producer' ? (
        <div className="chat-peer">
          {onClose && (
            <button
              className="text-button"
              style={{ padding: 0 }}
              onClick={onClose}
              aria-label="뒤로"
            >
              {Svg.back}
            </button>
          )}
          <div className="avatar">
            {peerPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={peerPhoto} alt="" />
            ) : (
              peerName.slice(-2)
            )}
          </div>
          <div className="who">
            <strong>{peerName}</strong>
            <span>{peerSub}</span>
          </div>
        </div>
      ) : (
        <div className="chat-peer">
          <div className="who">
            <strong>제작진과의 대화</strong>
            <span>{peerSub}</span>
          </div>
        </div>
      )}
      <div className="chat-context">
        <div className="thumb">
          {projectImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={projectImage} alt="" />
          )}
        </div>
        <div className="cc">
          <strong>{projectTitle}</strong>
          <span>{roleTitle}</span>
        </div>
        {mode === 'producer' && onViewProfile && (
          <button className="linky" onClick={onViewProfile}>
            지원서 보기 ›
          </button>
        )}
        {mode === 'actor' && profileHref && <a href={profileHref}>공고 보기 ›</a>}
      </div>
      {confirmed && (
        <div className="confirmed-schedule">
          <span>확정된 오디션 일정</span>
          <strong>{slotLabel(confirmed.selectedSlot)}</strong>
          <small>
            {confirmed.place}
            {confirmed.preparation ? ` · 준비물 ${confirmed.preparation}` : ''}
          </small>
        </div>
      )}
      <div className="chat-messages" ref={messageList} role="log" aria-label="대화 내용">
        {messages.length === 0 && (
          <div className="chat-empty">
            아직 대화가 없습니다.
            <br />
            {mode === 'producer'
              ? '연락을 시작하면 배우의 지원 현황에 대화가 열립니다.'
              : '제작진의 메시지를 기다려 주세요.'}
          </div>
        )}
        {messages.map((message) => {
          const day = dayLabel(message.createdAt);
          const divider = day !== lastDay ? day : '';
          lastDay = day;
          return (
            <Fragment key={message.id}>
              {divider && <div className="date-pill">{divider}</div>}
              {message.kind === 'text' ? (
                <div className={`bubble-row ${message.sender === mode ? 'mine' : 'theirs'}`}>
                  <div className={`bubble${message.attachment ? ' has-file' : ''}`}>
                    {message.attachment && (
                      <ChatAttachmentView
                        applicationId={applicationId}
                        attachment={message.attachment}
                        receipt={receipt}
                      />
                    )}
                    {message.body && <p>{message.body}</p>}
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
              ) : (
                <>
                  <div className="offer-card">
                    <div className="offer-head">{Svg.calendar} 오디션 제안</div>
                    <p>{message.body}</p>
                    {message.status === 'sent' || !message.selectedSlot ? (
                      <div className="offer-slots">
                        {message.slots.map((slot) => (
                          <span key={slot} className="slot-chip">
                            {slotLabel(slot)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="offer-lines">
                        <div className="ol">
                          {Svg.calendar}
                          <div>{slotLabel(message.selectedSlot)}</div>
                        </div>
                      </div>
                    )}
                    <div className="offer-lines" style={{ marginTop: 10 }}>
                      <div className="ol">
                        {Svg.pin}
                        <div>{message.place}</div>
                      </div>
                      {message.preparation && (
                        <div className="ol">
                          {Svg.doc}
                          <div>{message.preparation}</div>
                        </div>
                      )}
                    </div>
                    <div className={`offer-status offer-${message.status}`}>
                      {message.status === 'sent'
                        ? '배우 응답 대기 중'
                        : message.status === 'selected'
                          ? `배우가 ${slotTime(message.selectedSlot)} 선택 · 제작자 확정 대기`
                          : message.status === 'confirmed'
                            ? `확정 · ${slotLabel(message.selectedSlot)}`
                            : message.status === 'change_requested'
                              ? '배우가 다른 시간을 요청했습니다'
                              : '배우가 참석하기 어렵다고 했습니다'}
                    </div>
                    {mode === 'actor' && message.status === 'sent' && (
                      <div
                        className="offer-status"
                        style={{ background: '#fff', color: '#6f6a80' }}
                      >
                        위의 오디션 일정 화면에서 시간을 선택해 주세요.
                      </div>
                    )}
                    {mode === 'producer' && message.status === 'selected' && (
                      <button
                        className="button button-primary full"
                        disabled={busy || !online}
                        onClick={() => void respond(message.id, 'confirm')}
                      >
                        이 일정 확정하기
                      </button>
                    )}
                    {message.status === 'confirmed' && (
                      <div className="offer-done-btn">{Svg.check} 배우 확인 완료</div>
                    )}
                  </div>
                  {message.status === 'confirmed' && (
                    <div className="sys-pill">{Svg.check} 오디션 일정이 확정되었습니다.</div>
                  )}
                </>
              )}
            </Fragment>
          );
        })}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!online && <p className="chat-offline">오프라인 · 메시지를 보낼 수 없습니다.</p>}
      {mode === 'producer' && offerOpen && (
        <div className="offer-composer">
          <strong>오디션 시간 제안</strong>
          {slots.map((slot, index) => (
            <label key={index}>
              시간 {index + 1}
              <input
                type="datetime-local"
                value={slot}
                onChange={(event) =>
                  setSlots((current) =>
                    current.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
              />
            </label>
          ))}
          {slots.length < 3 && (
            <button className="text-button" onClick={() => setSlots((current) => [...current, ''])}>
              ＋ 시간 추가
            </button>
          )}
          <label>
            장소 또는 온라인 링크
            <input
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              placeholder="예: 성수 스튜디오"
            />
          </label>
          <label>
            준비물
            <input
              value={preparation}
              onChange={(event) => setPreparation(event.target.value)}
              placeholder="예: 지정대사 2장, 신분증"
            />
          </label>
          <button
            className="button button-primary full"
            disabled={busy || !online || !place || slots.filter(Boolean).length < 2}
            onClick={() => void send('offer')}
          >
            제안 보내기
          </button>
        </div>
      )}
      {file && (
        <div className="chat-pending-file">
          <FileBadge ext={/\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() || 'file'} />
          <div className="chat-file-info">
            <strong title={file.name}>{file.name}</strong>
            <span>
              {formatFileSize(file.size)} · {busy ? '보내는 중…' : '보내기를 누르면 전송돼요'}
            </span>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => setFile(null)}
            disabled={busy}
            aria-label="첨부 취소"
          >
            ×
          </button>
        </div>
      )}
      <div className="chat-compose">
        {mode === 'producer' && (
          <button
            className="plus-btn"
            onClick={() => setOfferOpen(!offerOpen)}
            aria-label="오디션 시간 제안"
          >
            {offerOpen ? '×' : Svg.plus}
          </button>
        )}
        <button
          type="button"
          className="plus-btn attach-btn"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          aria-label="파일 첨부"
          title="사진·PDF·한글·워드·엑셀 (4MB까지)"
        >
          {Svg.clip}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={CHAT_FILE_ACCEPT}
          hidden
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
        <input
          aria-label="메시지 입력"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.nativeEvent.isComposing &&
              (draft.trim() || file) &&
              !busy
            ) {
              event.preventDefault();
              void send('text');
            }
          }}
          placeholder={file ? '파일과 함께 보낼 말 (선택)' : '메시지를 입력하세요'}
        />
        <button
          className="send-btn"
          aria-label="메시지 보내기"
          disabled={busy || !online || (!draft.trim() && !file)}
          onClick={() => void send('text')}
        >
          {Svg.send}
        </button>
      </div>
    </div>
  );
}
