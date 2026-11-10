'use client';

// 공고 작성 '배역' 단계 맨 위: 시놉시스·메모를 붙여넣으면 AI가 배역 초안을 만들어 준다.
// 초안은 바로 들어가지 않고, 제작진이 고른 배역만 입력칸에 넣는다. 넣은 뒤에도 자유롭게 고칠 수 있다.

import { useState } from 'react';
import { ROLE_GENDERS, ROLE_TYPES, SPECIAL_SCENES, ageRangeLabel } from '@/lib/project-meta';
import { MAX_SOURCE_TEXT, MIN_SOURCE_TEXT, type RoleSuggestion } from '@/lib/role-draft';

type Props = {
  /** 1단계에서 입력한 작품 정보. 같이 보내면 초안이 더 정확해진다. */
  context: { projectTitle: string; format: string; logline: string };
  /** 지금 더 넣을 수 있는 배역 수 */
  room: number;
  onApply: (roles: RoleSuggestion[]) => void;
};

export default function RoleAiHelper({ context, room, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [roles, setRoles] = useState<RoleSuggestion[]>([]);
  const [picked, setPicked] = useState<boolean[]>([]);

  async function makeDraft() {
    setBusy(true);
    setError('');
    setNote('');
    setRoles([]);
    try {
      const response = await fetch('/api/roles/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, ...context }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || '초안을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
        return;
      }
      const list: RoleSuggestion[] = Array.isArray(data.roles) ? data.roles : [];
      setRoles(list);
      setPicked(list.map((_, index) => index < room));
      setNote(data.note || '');
    } catch {
      setError('연결이 끊겼어요. 잠시 뒤에 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  const chosen = roles.filter((_, index) => picked[index]);
  const tooMany = chosen.length > room;
  const length = text.trim().length;

  function apply() {
    if (!chosen.length || tooMany) return;
    onApply(chosen);
    setRoles([]);
    setPicked([]);
    setNote('');
    setOpen(false);
  }

  return (
    <section className="role-ai">
      <div className="role-ai-head">
        <div>
          <strong>시놉시스로 배역 초안 만들기</strong> <small>선택 · AI</small>
          <p className="wiz-note">
            시놉시스나 기획 메모를 붙여넣으면 AI가 배역명·설명·성별·연령대 초안을 만들어요. 고른
            배역만 아래 입력칸에 들어가고, 넣은 뒤에도 고칠 수 있어요.
          </p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? '접기' : '열기'}
        </button>
      </div>

      {open && (
        <>
          <textarea
            rows={7}
            value={text}
            maxLength={MAX_SOURCE_TEXT}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              '예) 부산의 작은 횟집을 운영하는 50대 엄마 정숙과, 서울에서 꿈을 접고 돌아온 20대 후반 딸 지원의 이야기. 지원의 고등학교 동창 태오(남, 20대 후반)는 …'
            }
            aria-label="시놉시스·기획 메모"
          />
          <div className="role-ai-actions">
            <span className="wiz-note">
              {length.toLocaleString()} / {MAX_SOURCE_TEXT.toLocaleString()}자 · 보낸 글은 초안을
              만드는 데만 쓰고 저장하지 않아요.
            </span>
            <button
              type="button"
              className="button button-primary"
              disabled={busy || length < MIN_SOURCE_TEXT}
              onClick={() => void makeDraft()}
            >
              {busy ? '만드는 중…' : 'AI로 배역 초안 만들기'}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}

          {roles.length > 0 && (
            <div className="role-ai-result">
              <p className="wiz-note">{note}</p>
              {roles.map((role, index) => {
                const meta = [
                  ROLE_TYPES[role.roleType],
                  ROLE_GENDERS[role.gender],
                  ageRangeLabel(role.ageMin, role.ageMax),
                  role.headcount > 1 ? `${role.headcount}명` : '',
                ].filter(Boolean);
                return (
                  <label
                    key={`${role.title}-${index}`}
                    className={`role-ai-row${picked[index] ? ' on' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={picked[index] ?? false}
                      onChange={(event) =>
                        setPicked((current) =>
                          current.map((value, at) => (at === index ? event.target.checked : value)),
                        )
                      }
                    />
                    <span className="role-ai-body">
                      <span>
                        <strong>{role.title}</strong>
                        {meta.length > 0 && <small> · {meta.join(' · ')}</small>}
                      </span>
                      {role.description && <span className="role-ai-desc">{role.description}</span>}
                      {role.requirement && (
                        <span className="role-ai-desc">필수 조건: {role.requirement}</span>
                      )}
                      {role.sceneHints.length > 0 && (
                        <span className="role-ai-warn">
                          글에 {role.sceneHints.map((key) => SPECIAL_SCENES[key]).join('·')} 장면이
                          보여요. 특수 장면 안내는 넣은 뒤 직접 골라 주세요.
                        </span>
                      )}
                      {role.source && <span className="role-ai-source">근거: “{role.source}”</span>}
                    </span>
                  </label>
                );
              })}
              {tooMany && (
                <p className="form-error">
                  배역은 {room}개까지 더 넣을 수 있어요. 고른 배역을 줄여 주세요.
                </p>
              )}
              <button
                type="button"
                className="button button-primary full"
                disabled={!chosen.length || tooMany}
                onClick={apply}
              >
                고른 배역 {chosen.length}개 입력칸에 넣기
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
