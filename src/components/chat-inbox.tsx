'use client';

import { useCallback, useEffect, useState } from 'react';
import ChatThread from '@/components/chat-thread';
import TeamThread from '@/components/team-thread';
import { filterRooms, folderLabel, type InboxFolder, type InboxRoom } from '@/lib/inbox-rules';
import { useBackClose } from '@/lib/use-back-close';

type Inbox = { folders: InboxFolder[]; rooms: InboxRoom[] };

function timeLabel(at: string) {
  if (!at) return '';
  const date = new Date(at);
  const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) === today
    ? date.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: 'numeric',
        minute: '2-digit',
      })
    : date.toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'numeric',
        day: 'numeric',
      });
}

/**
 * 채팅 목록. 카톡처럼 위의 칩으로 전체·안읽음·공고(폴더)를 고르고, 방을 누르면 대화가 열린다.
 * 제작진: 공고마다 팀 내부방 + 배우와의 방(단톡방 또는 나와의 개별방)
 * 배우: 지원한 공고마다 제작진과의 방(단톡방 하나 또는 팀원별 방)
 */
export default function ChatInbox({ viewer }: { viewer: 'producer' | 'actor' }) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState<InboxRoom | null>(null);
  const [error, setError] = useState('');
  useBackClose(Boolean(open), () => setOpen(null));

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/inbox', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '채팅 목록을 불러오지 못했어요.');
      setInbox(data);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '채팅 목록을 불러오지 못했어요.');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const rooms = inbox ? filterRooms(inbox.rooms, filter) : [];
  const unreadTotal = inbox?.rooms.reduce((sum, room) => sum + room.unread, 0) ?? 0;

  function close() {
    setOpen(null);
    void load();
  }

  return (
    <div className="chat-inbox">
      <h1 className="page-title">채팅</h1>
      <div className="inbox-chips" role="tablist" aria-label="채팅 묶음">
        <button
          role="tab"
          aria-selected={filter === 'all'}
          className={filter === 'all' ? 'on' : ''}
          onClick={() => setFilter('all')}
        >
          전체
        </button>
        <button
          role="tab"
          aria-selected={filter === 'unread'}
          className={filter === 'unread' ? 'on' : ''}
          onClick={() => setFilter('unread')}
        >
          안읽음 {unreadTotal > 0 && <b className="inbox-count">{unreadTotal}</b>}
        </button>
        {inbox?.folders.map((folder) => (
          <button
            key={folder.key}
            role="tab"
            aria-selected={filter === folder.key}
            className={filter === folder.key ? 'on' : ''}
            onClick={() => setFilter(folder.key)}
            title={folder.title}
          >
            <span aria-hidden>📁</span>{' '}
            <span className="inbox-chip-title">{folderLabel(folder.title)}</span>
            {folder.unread > 0 && <b className="inbox-count">{folder.unread}</b>}
          </button>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}
      {!inbox && !error && <p className="muted">불러오는 중…</p>}
      {inbox && rooms.length === 0 && (
        <div className="empty-card">
          {filter === 'unread'
            ? '안 읽은 메시지가 없어요.'
            : viewer === 'producer'
              ? '아직 대화가 없어요. 지원자 목록이나 팀 보드에서 배우와 대화를 시작해 보세요.'
              : '아직 열린 대화가 없어요. 제작진이 연락하면 여기에 모여요.'}
        </div>
      )}

      <ul className="inbox-list">
        {rooms.map((room) => (
          <li key={room.key}>
            <button className="inbox-row" onClick={() => setOpen(room)}>
              <span className={`inbox-avatar${room.kind === 'team' ? ' team' : ''}`} aria-hidden>
                {room.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={room.photo} alt="" />
                ) : room.kind === 'team' ? (
                  '👥'
                ) : // 배우가 보는 제작진 방은 이름 대신 슬레이트 아이콘
                viewer === 'actor' ? (
                  '🎬'
                ) : (
                  room.title.slice(-2)
                )}
              </span>
              <span className="inbox-main">
                {/* 전체·안읽음에서는 어느 공고의 방인지 위에 작게 보여 준다 */}
                {(filter === 'all' || filter === 'unread') && (
                  <small className="inbox-folder">📁 {folderLabel(room.folderTitle)}</small>
                )}
                <strong className="inbox-title">{room.title}</strong>
                <span className="inbox-sub">{room.subtitle}</span>
                <span className="inbox-last">{room.last}</span>
              </span>
              <span className="inbox-side">
                <small>{timeLabel(room.lastAt)}</small>
                {room.unread > 0 && <b className="inbox-count">{room.unread}</b>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className="sheet-backdrop" onClick={close}>
          <section
            className="detail-sheet chat-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${open.title} 대화`}
            onClick={(event) => event.stopPropagation()}
          >
            {open.kind === 'team' ? (
              <TeamThread
                projectId={open.projectId!}
                projectTitle={open.projectTitle}
                members={open.members}
                onClose={close}
              />
            ) : (
              <ChatThread
                applicationId={open.applicationId!}
                mode={viewer}
                receipt={viewer === 'actor' ? open.receipt : undefined}
                fixedRoom={viewer === 'actor' ? (open.room ?? '') : undefined}
                peerName={open.title}
                peerPhoto={open.photo || undefined}
                peerSub={open.subtitle}
                projectTitle={open.projectTitle}
                roleTitle={open.roleTitle}
                projectImage="/covers/etc.svg"
                onClose={close}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
