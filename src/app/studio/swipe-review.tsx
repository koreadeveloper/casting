'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Application, ReviewStatus } from '@/lib/types';
import { reviewLabels } from '@/lib/types';

/*
 * 카드로 빠르게 검토하기 (기획서 U02 '카드로 보기').
 * ← 제외 · ↑ 보류 · → 관심. 제스처만으로 결정을 강제하지 않도록 같은 버튼을 항상 함께 둔다.
 * 직전 결정은 '되돌리기'로 원래 상태로 돌릴 수 있다. 분류 값은 목록·상세·팀 보드와 같은 값이다.
 */

type Direction = 'left' | 'up' | 'right';

const DECISION: Record<Direction, ReviewStatus> = {
  left: 'excluded',
  up: 'hold',
  right: 'interested',
};

/** 이만큼 끌면 결정으로 본다(px). */
const THRESHOLD = 90;
/** 카드가 날아가는 시간(ms). CSS의 swipe-card 전환 시간과 맞춘다. */
const LEAVE_MS = 220;

type Decision = { id: string; index: number; previous: ReviewStatus; next: ReviewStatus };

function conditionLabel(value: string) {
  return value === 'yes' ? '가능' : value === 'no' ? '불가' : '미확인';
}

function initials(name: string) {
  return name.slice(-2);
}

export default function SwipeReview({
  items,
  title,
  paused,
  onDecide,
  onSeen,
  onOpenDetail,
  onShowInterested,
  onClose,
}: {
  /** 검토할 지원자들(열 때 정한 순서). 상태는 부모가 최신 값으로 넘긴다. */
  items: Application[];
  title: string;
  /** 위에 상세 시트가 열려 있으면 키보드 조작을 멈춘다. */
  paused: boolean;
  /** 분류 저장. 실패하면 false. */
  onDecide: (id: string, status: ReviewStatus) => Promise<boolean>;
  /** 카드를 보여 준 것도 '열람'이다(배우 화면: 미열람 → 검토 중). */
  onSeen: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onShowInterested: () => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<Direction | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const start = useRef<{ x: number; y: number; pointer: number } | null>(null);

  const current = items[index];
  const upcoming = items[index + 1];
  const done = index >= items.length;

  useEffect(() => {
    if (current && !current.viewedAt) onSeen(current.id);
    // 카드가 바뀔 때마다 한 번만 알린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const decide = useCallback(
    (direction: Direction) => {
      if (!current || leaving) return;
      const next = DECISION[direction];
      const at = index;
      const entry: Decision = { id: current.id, index: at, previous: current.status, next };
      setLeaving(direction);
      setHistory((list) => [...list, entry]);
      window.setTimeout(() => {
        setLeaving(null);
        setDrag({ x: 0, y: 0, active: false });
        setIndex(at + 1);
      }, LEAVE_MS);
      // 이미 같은 분류면 저장할 것이 없다. 넘기기만 한다.
      if (current.status === next) return;
      void onDecide(current.id, next).then((ok) => {
        if (ok) return;
        // 저장에 실패하면 그 카드로 돌아가 다시 고르게 한다.
        setHistory((list) => list.filter((item) => item !== entry));
        setIndex(at);
      });
    },
    [current, index, leaving, onDecide],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last || leaving) return;
    setHistory((list) => list.slice(0, -1));
    setIndex(last.index);
    setDrag({ x: 0, y: 0, active: false });
    if (last.previous !== last.next) void onDecide(last.id, last.previous);
  }, [history, leaving, onDecide]);

  const skip = useCallback(() => {
    if (!current || leaving) return;
    setIndex((value) => value + 1);
  }, [current, leaving]);

  useEffect(() => {
    if (paused) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      if (event.key === 'ArrowLeft') decide('left');
      else if (event.key === 'ArrowRight') decide('right');
      else if (event.key === 'ArrowUp') decide('up');
      else if (event.key === 'ArrowDown') skip();
      else if (event.key === 'Backspace' || event.key.toLowerCase() === 'z') undo();
      else if (event.key === 'Escape') onClose();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, decide, skip, undo, onClose]);

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (leaving || (event.target as HTMLElement).closest('button, a')) return;
    start.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || origin.pointer !== event.pointerId) return;
    setDrag({ x: event.clientX - origin.x, y: event.clientY - origin.y, active: true });
  }
  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || origin.pointer !== event.pointerId) return;
    start.current = null;
    const x = event.clientX - origin.x;
    const y = event.clientY - origin.y;
    if (-y > THRESHOLD && Math.abs(y) > Math.abs(x)) decide('up');
    else if (x > THRESHOLD) decide('right');
    else if (x < -THRESHOLD) decide('left');
    else setDrag({ x: 0, y: 0, active: false });
  }

  // 끄는 방향에 따라 카드 위에 '관심·제외·보류' 표시를 띄운다.
  const hint: Direction | null =
    leaving ??
    (-drag.y > 30 && Math.abs(drag.y) > Math.abs(drag.x)
      ? 'up'
      : drag.x > 30
        ? 'right'
        : drag.x < -30
          ? 'left'
          : null);
  const strength = leaving
    ? 1
    : Math.min(1, Math.max(Math.abs(drag.x), hint === 'up' ? -drag.y : 0) / THRESHOLD);
  const transform = leaving
    ? leaving === 'up'
      ? 'translate(0, -120vh) rotate(0deg)'
      : `translate(${leaving === 'right' ? '' : '-'}130vw, ${drag.y}px) rotate(${leaving === 'right' ? 18 : -18}deg)`
    : `translate(${drag.x}px, ${Math.min(drag.y, 40)}px) rotate(${drag.x / 18}deg)`;

  // 이번에 고른 결과(같은 사람을 다시 고르면 마지막 것만 센다)
  const finalById = new Map(history.map((item) => [item.id, item.next]));
  const tally = (status: ReviewStatus) =>
    [...finalById.values()].filter((value) => value === status).length;

  return (
    <div className="swipe-screen" role="dialog" aria-modal="true" aria-label="카드로 지원자 검토">
      <header className="swipe-head">
        <button type="button" className="back-link" onClick={onClose}>
          ‹ 목록
        </button>
        <div className="swipe-title">
          <strong>카드 검토</strong>
          <span>{title}</span>
        </div>
        <span className="swipe-count" aria-live="polite">
          {Math.min(index + 1, items.length)} / {items.length}
        </span>
      </header>
      <div className="swipe-progress" aria-hidden>
        <span style={{ width: `${(Math.min(index, items.length) / items.length) * 100}%` }} />
      </div>

      {done ? (
        <section className="swipe-done">
          <strong>모두 넘겨 봤어요</strong>
          <p>
            이번에 고른 결과 · 관심 {tally('interested')} · 보류 {tally('hold')} · 제외{' '}
            {tally('excluded')}
          </p>
          <p className="muted">분류는 목록과 팀 보드에도 그대로 반영돼 있어요.</p>
          <div className="swipe-done-actions">
            <button type="button" className="button button-primary" onClick={onShowInterested}>
              관심 지원자만 보기
            </button>
            <button type="button" className="button button-outline" onClick={onClose}>
              목록으로
            </button>
            {history.length > 0 && (
              <button type="button" className="text-button" onClick={undo}>
                ↶ 마지막 결정 되돌리기
              </button>
            )}
          </div>
        </section>
      ) : (
        <div className="swipe-stage">
          {upcoming && (
            <article className="swipe-card is-next" aria-hidden>
              <CardBody item={upcoming} />
            </article>
          )}
          {current && (
            <article
              key={current.id}
              className={`swipe-card${drag.active && !leaving ? ' dragging' : ''}`}
              style={{ transform }}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              aria-label={`${current.name} 지원서 카드`}
            >
              {hint && (
                <span className={`swipe-stamp stamp-${hint}`} style={{ opacity: strength }}>
                  {hint === 'right' ? '관심' : hint === 'left' ? '제외' : '보류'}
                </span>
              )}
              <CardBody item={current} />
              <button
                type="button"
                className="swipe-detail"
                onClick={() => onOpenDetail(current.id)}
              >
                지원서 자세히 보기 ›
              </button>
            </article>
          )}
        </div>
      )}

      {!done && (
        <footer className="swipe-actions">
          <div className="swipe-buttons">
            <button
              type="button"
              className="swipe-btn btn-left"
              onClick={() => decide('left')}
              disabled={Boolean(leaving)}
            >
              <b aria-hidden>✕</b>
              제외
            </button>
            <button
              type="button"
              className="swipe-btn btn-up"
              onClick={() => decide('up')}
              disabled={Boolean(leaving)}
            >
              <b aria-hidden>‖</b>
              보류
            </button>
            <button
              type="button"
              className="swipe-btn btn-right"
              onClick={() => decide('right')}
              disabled={Boolean(leaving)}
            >
              <b aria-hidden>♥</b>
              관심
            </button>
          </div>
          <div className="swipe-sub">
            <button type="button" onClick={undo} disabled={!history.length || Boolean(leaving)}>
              ↶ 되돌리기
            </button>
            <span className="muted">← 제외 · ↑ 보류 · → 관심</span>
            <button type="button" onClick={skip} disabled={Boolean(leaving)}>
              건너뛰기 ›
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function CardBody({ item }: { item: Application }) {
  return (
    <>
      <div className="swipe-photo">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrl} alt={`${item.name} 사진`} draggable={false} />
        ) : (
          // 사진이 없으면 가짜 이미지를 만들지 않고 '사진 없음'으로 알린다(기획서 U02).
          <div className="swipe-nophoto">
            <span>{initials(item.name)}</span>
            사진 없음
          </div>
        )}
        <span className={`status-chip chip-${item.status}`}>
          {item.status === 'new' ? '미분류' : reviewLabels[item.status]}
        </span>
        {item.photoUrls.length > 1 && (
          <span className="swipe-photos">사진 {item.photoUrls.length}장</span>
        )}
      </div>
      <div className="swipe-info">
        <h2>
          {item.name} <small>{item.age ? `${item.age}세` : ''}</small>
        </h2>
        <p>{item.introduction || '소개를 적지 않았어요.'}</p>
        <div className="swipe-tags">
          <span className={item.available === 'yes' ? 'ok' : 'warn'}>
            촬영 {conditionLabel(item.available)}
          </span>
          <span className={item.travel === 'yes' ? 'ok' : 'warn'}>
            이동 {conditionLabel(item.travel)}
          </span>
          <span className={item.payAccepted === 'yes' ? 'ok' : 'warn'}>
            출연료 {conditionLabel(item.payAccepted)}
          </span>
          <span>{item.videoUrl ? '▣ 영상 있음' : '영상 없음'}</span>
          {item.shortlist && <span className="ok">★ 후보</span>}
        </div>
      </div>
    </>
  );
}
