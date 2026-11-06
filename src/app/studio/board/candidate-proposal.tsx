'use client';

import { useState } from 'react';
import styles from './board.module.css';

export type CandidateProposal = {
  roleId: string;
  roleTitle: string;
  status: 'sent' | 'accepted' | 'declined';
  senderName: string;
  createdAt: string;
};
export type BoardRoleOption = { id: string; title: string; open: boolean };

const STATUS_LABEL: Record<CandidateProposal['status'], string> = {
  sent: '답변 기다리는 중',
  accepted: '수락하고 지원함',
  declined: '거절함',
};

/** 후보 카드에 붙는 짧은 상태 표시. 지원했으면 '지원함', 아니면 가장 최근 제안 상태. */
export function proposalBadge(proposals: CandidateProposal[], applied: boolean) {
  if (applied) return { label: '지원함', tone: 'applied' as const };
  const last = proposals.at(-1);
  if (!last) return null;
  if (last.status === 'declined') return { label: '제안 거절', tone: 'declined' as const };
  return { label: '제안 보냄', tone: 'sent' as const };
}

/**
 * 지원하지 않은 후보 배우에게 이 공고의 배역으로 출연 제안을 보낸다.
 * 배우는 '내 페이지'에서 제안을 보고, 수락하면 지원서를 내서 지원자로 들어온다(그때부터 채팅 가능).
 */
export default function CandidateProposalBlock({
  actorName,
  actorId,
  proposals,
  applied,
  roles,
  onSent,
}: {
  actorName: string;
  actorId: string;
  proposals: CandidateProposal[];
  applied: boolean;
  roles: BoardRoleOption[];
  onSent: () => void;
}) {
  const proposed = new Set(proposals.map((item) => item.roleId));
  const available = roles.filter((role) => role.open && !proposed.has(role.id));
  const [roleId, setRoleId] = useState('');
  const [message, setMessage] = useState(
    `${actorName}님, 프로필을 인상 깊게 봤습니다. 아래 배역에 함께해 주실 수 있을지 제안드립니다.`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!roleId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId, roleId, message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '제안을 보내지 못했습니다.');
      setRoleId('');
      setNotice('제안을 보냈어요. 배우가 수락하고 지원하면 지원자 카드로 올라와요.');
      onSent();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '제안을 보내지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail-block">
      <h3>출연 제안</h3>
      {applied && <p>이 공고에 지원한 배우예요. 지원자 카드에서 지원서를 보고 대화할 수 있어요.</p>}
      {proposals.length > 0 && (
        <ul className={styles.proposalList}>
          {proposals.map((item) => (
            <li key={item.roleId}>
              <strong>{item.roleTitle}</strong>
              <span className={`${styles.proposalStatus} ${styles[`p_${item.status}`]}`}>
                {STATUS_LABEL[item.status]}
              </span>
              {item.senderName && <small>{item.senderName}님이 보냄</small>}
            </li>
          ))}
        </ul>
      )}
      {!applied &&
        (available.length === 0 ? (
          <p className="small-note">
            {roles.some((role) => role.open)
              ? '모집 중인 모든 배역으로 이미 제안했어요.'
              : '제안할 수 있는 모집 중 배역이 없어요.'}
          </p>
        ) : (
          <form className={styles.proposalForm} onSubmit={send}>
            <select
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              aria-label="제안할 배역"
              required
            >
              <option value="">제안할 배역 고르기</option>
              {available.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.title}
                </option>
              ))}
            </select>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
              rows={3}
              aria-label="제안 메시지"
              required
            />
            <button className="button button-primary full" disabled={busy || !roleId}>
              {busy ? '보내는 중…' : '출연 제안 보내기'}
            </button>
            <p className="small-note">
              배우의 연락처는 배우가 제안을 수락하고 지원서를 낸 뒤에 볼 수 있어요.
            </p>
          </form>
        ))}
      {notice && <p className="small-note">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
