'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AttendanceCheck } from '@/lib/attendance';

/**
 * 출연 확정된 배우의 지원 현황 화면에 뜨는 '촬영 참석 재확인' 카드.
 * 촬영 3일 전부터 당일까지만 답을 받고, 그 전에는 언제 물어볼지만 알려 준다.
 */
export default function AttendanceCard({
  receipt,
  shootDate,
  dateLabel,
  dayLabel,
  askOpen,
  answer,
}: {
  receipt: string;
  shootDate: string;
  dateLabel: string;
  dayLabel: string;
  askOpen: boolean;
  answer: AttendanceCheck | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!answer);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(status: 'yes' | 'no') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt, shootDate, status, note }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '저장하지 못했습니다.');
      setEditing(false);
      setDeclining(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (!askOpen) {
    return (
      <div className="attend-card attend-later">
        <div className="attend-head">
          <span className="attend-chip">촬영 예정</span>
          <strong>{dateLabel} 촬영</strong>
        </div>
        <p>촬영 3일 전에 참석 여부를 다시 확인해 드려요. 일정이 바뀌면 대화로 먼저 알려 주세요.</p>
      </div>
    );
  }

  if (answer && !editing) {
    return (
      <div className={`attend-card ${answer.status === 'yes' ? 'attend-yes' : 'attend-no'}`}>
        <div className="attend-head">
          <span className="attend-chip">{dayLabel}</span>
          <strong>
            {dateLabel} 촬영 · {answer.status === 'yes' ? '참석 확인 완료' : '참석 어려움 전달됨'}
          </strong>
        </div>
        <p>
          {answer.status === 'yes'
            ? '제작진에게 참석한다고 전했어요. 촬영 당일 뵐게요!'
            : '제작진에게 사유와 함께 전했어요. 대화로 연락이 올 거예요.'}
        </p>
        <button className="text-button" onClick={() => setEditing(true)}>
          답 바꾸기
        </button>
      </div>
    );
  }

  return (
    <div className="attend-card attend-ask">
      <div className="attend-head">
        <span className="attend-chip">{dayLabel}</span>
        <strong>{dateLabel} 촬영에 참석하시나요?</strong>
      </div>
      <p>출연이 확정된 촬영이에요. 제작진이 준비할 수 있게 참석 여부를 알려 주세요.</p>
      {declining ? (
        <>
          <label className="attend-note">
            참석이 어려운 사유
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
              rows={3}
              placeholder="예: 갑자기 다른 촬영이 잡혔어요. 오후 3시 이후는 가능해요."
            />
          </label>
          <div className="split-actions">
            <button
              className="button button-soft"
              disabled={busy}
              onClick={() => setDeclining(false)}
            >
              돌아가기
            </button>
            <button
              className="button button-primary"
              disabled={busy || !note.trim()}
              onClick={() => void submit('no')}
            >
              제작진에게 전하기
            </button>
          </div>
        </>
      ) : (
        <div className="split-actions">
          <button className="button button-soft" disabled={busy} onClick={() => setDeclining(true)}>
            참석이 어려워요
          </button>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void submit('yes')}
          >
            참석할게요
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
