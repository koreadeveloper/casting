'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import ProducerNav from '@/components/producer-nav';
import {
  FORMATS,
  GENRE_TAGS,
  PERKS,
  PRODUCTION_TYPES,
  PROJECT_REGIONS,
  RELEASE_CHANNELS,
  ROLE_GENDERS,
  ROLE_TYPES,
  NO_SPECIAL_SCENE,
  SPECIAL_SCENES,
  ageRangeLabel,
  normalizeSpecialScenes,
  projectCover,
  specialScenesLabel,
  splitLocation,
} from '@/lib/project-meta';
import type { ProjectUsage } from '@/lib/accounts';
import { RESULT_WARNING_DAYS, resultDueDate } from '@/lib/result-deadline';
import { daysBetween, formatDates, formatPeriod, normalizeDates } from '@/lib/schedule';

// 등록과 수정이 같은 5단계를 쓴다. 배역 수정도 여기서 한다('수정'은 모두 프로젝트 수정에 모은다).
const STEPS = ['작품 정보', '일정', '배역', '조건·담당', '확인'];
const HINTS = {
  create: [
    '작품을 소개해 주세요. 배우가 지원 여부를 판단하고, 검색·추천에도 쓰입니다.',
    '촬영만이 아니라 오디션·리딩까지 단계별 일정을 적어 주세요.',
    '모집할 배역을 추가해 주세요. 배역마다 지원 링크가 따로 만들어집니다.',
    '지원 일정과 출연 조건을 정해 주세요. 모든 배역에 똑같이 적용됩니다.',
    '입력한 내용을 확인하고 게시하세요.',
  ],
  edit: [
    '작품 정보를 수정합니다.',
    '단계별 일정을 수정합니다. 작품 일정을 따르는 배역의 촬영일도 함께 바뀝니다.',
    '배역을 수정하거나 새 배역을 추가합니다. 저장된 배역은 삭제 대신 접수를 마감할 수 있어요.',
    '저장하면 이 작품의 모든 배역에 똑같이 반영됩니다.',
    '수정할 내용을 확인하고 저장하세요.',
  ],
};
const DRAFT_KEY = 'casting_project_draft';
const MAX_ROLES = 20;
// 촬영 기간이 이보다 길면 날짜를 칩으로 늘어놓지 않고 날짜 입력으로만 고른다.
const MAX_DAY_CHIPS = 62;

export type RoleDraft = {
  /** 화면에서 배역을 구분하는 값. 저장된 배역은 id와 같다. */
  key: string;
  id?: string;
  isClosed?: boolean;
  applicationCount?: number;
  title: string;
  description: string;
  requirement: string;
  roleType: string;
  gender: string;
  ageMin: string;
  ageMax: string;
  headcount: string;
  shootMode: 'all' | 'custom';
  shootDates: string[];
  /** 특수 장면 안내(필수): '없음' 또는 종류 */
  specialScenes: string[];
  specialNote: string;
};

export type ProjectDraft = {
  title: string;
  genre: string;
  genres: string[];
  productionType: string;
  runtime: string;
  releaseChannels: string[];
  releasePeriod: string;
  company: string;
  director: string;
  producerName: string;
  logline: string;
  /** 작품 포스터(/api/uploads/ 사진). 비우면 형식별 기본 커버 */
  posterUrl: string;
  description: string;
  region: string;
  locationDetail: string;
  auditionStart: string;
  auditionEnd: string;
  prepStart: string;
  prepEnd: string;
  shootStart: string;
  shootEnd: string;
  shootSessions: string;
  roles: RoleDraft[];
  deadline: string;
  announcementDate: string;
  pay: string;
  perks: string[];
  contactName: string;
};

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `new-${Date.now().toString(36)}-${keySeq}`;
}

function blankRole(): RoleDraft {
  return {
    key: newKey(),
    title: '',
    description: '',
    requirement: '',
    roleType: '',
    gender: '',
    ageMin: '',
    ageMax: '',
    headcount: '1',
    shootMode: 'all',
    shootDates: [],
    specialScenes: [],
    specialNote: '',
  };
}

function blankDraft(contactName: string): ProjectDraft {
  return {
    title: '',
    genre: '단편영화',
    genres: [],
    productionType: '',
    runtime: '',
    releaseChannels: [],
    releasePeriod: '',
    company: '',
    director: '',
    producerName: '',
    logline: '',
    posterUrl: '',
    description: '',
    region: '서울',
    locationDetail: '',
    auditionStart: '',
    auditionEnd: '',
    prepStart: '',
    prepEnd: '',
    shootStart: '',
    shootEnd: '',
    shootSessions: '',
    roles: [blankRole()],
    deadline: '',
    announcementDate: '',
    pay: '',
    perks: [],
    contactName,
  };
}

/** 이 기기에 임시 저장한 내용을 불러온다. 예전 구조로 저장된 것도 빈칸만 채워서 쓴다. */
function restoreDraft(saved: unknown, base: ProjectDraft): ProjectDraft {
  if (!saved || typeof saved !== 'object') return base;
  const raw = saved as Partial<ProjectDraft> & { location?: string };
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  const merged: ProjectDraft = {
    ...base,
    ...raw,
    genres: list(raw.genres),
    releaseChannels: list(raw.releaseChannels),
    perks: list(raw.perks),
    posterUrl: typeof raw.posterUrl === 'string' ? raw.posterUrl : '',
    roles: (Array.isArray(raw.roles) && raw.roles.length ? raw.roles : [{}]).map((role) => ({
      ...blankRole(),
      ...(role as Partial<RoleDraft>),
      id: undefined,
      key: newKey(),
      shootDates: list((role as Partial<RoleDraft>).shootDates),
      specialScenes: list((role as Partial<RoleDraft>).specialScenes),
    })),
  };
  // 시·도 칸이 생기기 전의 임시 저장은 지역이 한 줄로 들어 있다.
  if (raw.location && !raw.region) {
    const split = splitLocation(raw.location);
    merged.region = split.region || base.region;
    merged.locationDetail = split.detail;
  }
  return merged;
}

function dayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()];
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${weekday})`;
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

type Props = {
  contactName: string;
  /** 수정 모드: 프로젝트 id (없으면 신규 등록) */
  editId?: string;
  /** 수정 모드: 저장된 프로젝트와 배역 */
  initial?: ProjectDraft;
  /** 수정 모드: 프로젝트 정리(삭제·보관) 방법과 연결된 기록 수 */
  removal?: { mode: 'delete' | 'archive'; usage: ProjectUsage; archived: boolean };
};

export default function ProjectWizard({ contactName, editId, initial, removal }: Props) {
  const isEdit = Boolean(editId);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProjectDraft>(() => initial ?? blankDraft(contactName));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  // 프로젝트 정리: 확인 패널을 연 상태, 진행 중, 오류. 확인 사이에 지원이 들어오면 보관으로 바뀐다.
  const [removalMode, setRemovalMode] = useState(removal?.mode ?? 'delete');
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  async function cleanUp() {
    if (!editId || !removal) return;
    setRemoving(true);
    setRemoveError('');
    try {
      const response = await fetch('/api/projects', {
        method: removalMode === 'delete' && !removal.archived ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          removalMode === 'delete' && !removal.archived
            ? { id: editId }
            : { id: editId, archived: !removal.archived },
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.href = `/login?next=/studio/projects/${editId}/edit`;
        return;
      }
      if (response.status === 409 && data.canArchive) {
        // 그사이 지원서가 들어왔다. 지우지 않고 보관하도록 안내를 바꾼다.
        setRemovalMode('archive');
        setRemoveError('그사이 지원자가 생겨 삭제할 수 없어요. 대신 보관할 수 있어요.');
        setRemoving(false);
        return;
      }
      if (!response.ok) throw new Error(data.error || '프로젝트를 정리하지 못했습니다.');
      location.replace('/studio');
    } catch (reason) {
      setRemoveError(reason instanceof Error ? reason.message : '프로젝트를 정리하지 못했습니다.');
      setRemoving(false);
    }
  }

  useEffect(() => {
    if (isEdit) return; // 수정 모드에서는 신규 등록 임시 저장을 불러오지 않는다
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        setDraft((current) => restoreDraft(JSON.parse(saved), current));
        setNotice('임시 저장한 내용을 불러왔습니다.');
      }
    } catch {
      /* 손상된 임시 저장은 무시 */
    }
  }, [isEdit]);

  // 단계 이동을 브라우저 기록에 남긴다. 휴대폰 뒤로가기 = 이전 단계(입력 내용은 그대로).
  useEffect(() => {
    const onPop = () => {
      const saved = (history.state as { __csStep?: number } | null)?.__csStep;
      setStep(typeof saved === 'number' ? saved : 0);
      setError('');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const projectDays = useMemo(
    () => daysBetween(draft.shootStart, draft.shootEnd),
    [draft.shootStart, draft.shootEnd],
  );
  const roleDays = (role: RoleDraft) =>
    role.shootMode === 'custom' ? normalizeDates(role.shootDates) : projectDays;

  const set =
    (key: keyof ProjectDraft) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((current) => ({ ...current, [key]: event.target.value }));
  const toggleIn = (key: 'genres' | 'releaseChannels' | 'perks', value: string) =>
    setDraft((current) => ({ ...current, [key]: toggle(current[key], value) }));
  const setRole = (key: string, patch: Partial<RoleDraft>) =>
    setDraft((current) => ({
      ...current,
      roles: current.roles.map((role) => (role.key === key ? { ...role, ...patch } : role)),
    }));

  function problem(target: number) {
    if (target === 0) {
      if (!draft.title.trim()) return '작품명을 입력해 주세요.';
      if (!FORMATS.includes(draft.genre)) return '형식을 골라 주세요.';
      if (!PROJECT_REGIONS.includes(draft.region)) return '촬영 지역(시·도)을 골라 주세요.';
      if (draft.region !== '미정' && !draft.locationDetail.trim())
        return '촬영 지역의 상세 위치를 입력해 주세요.';
    }
    if (target === 1) {
      if (draft.auditionStart && draft.auditionEnd && draft.auditionEnd < draft.auditionStart)
        return '오디션 종료일이 시작일보다 빠릅니다.';
      if (draft.prepStart && draft.prepEnd && draft.prepEnd < draft.prepStart)
        return '리딩·리허설 종료일이 시작일보다 빠릅니다.';
      if (!draft.shootStart) return '촬영 시작일을 입력해 주세요.';
      if (draft.shootEnd && draft.shootEnd < draft.shootStart)
        return '촬영 종료일이 시작일보다 빠릅니다.';
    }
    if (target === 2) {
      const filled = draft.roles.filter((role) => role.title.trim() || role.description.trim());
      if (filled.length === 0) return '배역을 하나 이상 입력해 주세요.';
      for (const role of filled) {
        if (!role.title.trim() || !role.description.trim())
          return '배역명과 배역 설명을 모두 입력해 주세요.';
        const min = Number(role.ageMin) || 0;
        const max = Number(role.ageMax) || 0;
        if (min > 0 && max > 0 && max < min) return `'${role.title}'의 연령대를 확인해 주세요.`;
        if (role.shootMode === 'custom' && normalizeDates(role.shootDates).length === 0)
          return `'${role.title}'의 촬영일을 하나 이상 골라 주세요.`;
        if (normalizeSpecialScenes(role.specialScenes).length === 0)
          return `'${role.title}'의 특수 장면 안내를 골라 주세요. 없으면 '특수 장면 없음'을 고르면 돼요.`;
      }
    }
    if (target === 3) {
      if (!draft.deadline || !draft.announcementDate)
        return '지원 마감일과 결과 안내일을 입력해 주세요.';
      if (draft.announcementDate < draft.deadline)
        return '결과 안내일은 지원 마감일 이후여야 합니다.';
      if (!draft.pay.trim()) return '출연료·교통·식비 조건을 입력해 주세요.';
      if (!draft.contactName.trim()) return '담당자를 입력해 주세요.';
    }
    return '';
  }

  function goStep(next: number) {
    setStep(next);
    history.pushState({ __csStep: next }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function previous() {
    // 앞으로 갈 때마다 기록을 쌓았으니, 이전 단계는 뒤로가기와 같다.
    if (((history.state as { __csStep?: number } | null)?.__csStep ?? 0) > 0) history.back();
    else setStep((current) => Math.max(0, current - 1));
    setError('');
  }

  function saveDraft() {
    if (isEdit) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setNotice('이 기기에 임시 저장했습니다.');
  }

  async function next() {
    const issue = problem(step);
    if (issue) {
      setError(issue);
      return;
    }
    setError('');
    if (step < STEPS.length - 1) {
      goStep(step + 1);
      return;
    }
    // 마지막 확인 단계: 앞 단계를 다시 한 번 모두 확인한다.
    for (let index = 0; index < STEPS.length - 1; index += 1) {
      const earlier = problem(index);
      if (earlier) {
        setError(`${STEPS[index]}: ${earlier}`);
        return;
      }
    }
    setBusy(true);
    try {
      const response = await fetch('/api/projects', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { id: editId } : {}),
          ...draft,
          shootSessions: Number(draft.shootSessions) || 0,
          roles: draft.roles
            .filter((role) => role.title.trim() || role.description.trim())
            .map((role) => ({
              ...(role.id ? { id: role.id, isClosed: Boolean(role.isClosed) } : {}),
              title: role.title,
              description: role.description,
              requirement: role.requirement,
              roleType: role.roleType,
              gender: role.gender,
              ageMin: Number(role.ageMin) || 0,
              ageMax: Number(role.ageMax) || 0,
              headcount: Number(role.headcount) || 1,
              shootMode: role.shootMode,
              shootDates: role.shootMode === 'custom' ? normalizeDates(role.shootDates) : [],
              specialScenes: normalizeSpecialScenes(role.specialScenes),
              specialNote: role.specialNote,
            })),
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        location.href = `/login?next=${isEdit ? `/studio/projects/${editId}/edit` : '/studio/projects/new'}`;
        return;
      }
      if (!response.ok)
        throw new Error(data.error || `프로젝트를 ${isEdit ? '수정' : '등록'}하지 못했습니다.`);
      if (!isEdit) localStorage.removeItem(DRAFT_KEY);
      // 단계 기록이 뒤로가기에 남지 않게 현재 기록을 바꿔 치운다.
      location.replace('/studio');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `프로젝트를 ${isEdit ? '수정' : '등록'}하지 못했습니다.`,
      );
      setBusy(false);
    }
  }

  const resultDue = resultDueDate(draft.announcementDate, draft.auditionEnd);
  const sessions = Number(draft.shootSessions) || 0;
  const shootSummary = projectDays.length
    ? `${formatPeriod(draft.shootStart, draft.shootEnd)}${sessions ? ` · 총 ${sessions}회차` : ''}`
    : '';

  return (
    <main className="app-shell wide">
      <ProducerNav active="new-project" />
      <div className="screen-pad page-top">
        <Link className="back-link" href="/studio">
          ‹ 프로젝트
        </Link>
        <div className="wizard-shell">
          <ol className="wizard-steps vertical">
            {STEPS.map((label, index) => (
              <li key={label} className={index === step ? 'on' : index < step ? 'done' : ''}>
                <b>{index < step ? '✓' : index + 1}</b>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <section className="wizard-panel">
            <h1 className="page-title" style={{ marginBottom: 6 }}>
              {isEdit ? '프로젝트 수정' : '프로젝트 등록'}
            </h1>
            <p className="muted" style={{ marginBottom: 20 }}>
              {HINTS[isEdit ? 'edit' : 'create'][step]}
            </p>
            <div className="role-form">
              <p className="form-legend">
                <em>*</em> 표시는 꼭 채워야 하는 항목이에요. 나머지는 나중에 채워도 됩니다.
              </p>

              {step === 0 && (
                <>
                  <h2 className="wiz-section">작품</h2>
                  <label>
                    작품명 <em>*</em>
                    <input
                      value={draft.title}
                      onChange={set('title')}
                      placeholder="예: 단편영화 〈봄날〉"
                    />
                  </label>
                  <div className="form-two">
                    <label>
                      형식 <em>*</em>
                      <select value={draft.genre} onChange={set('genre')}>
                        {!FORMATS.includes(draft.genre) && <option value="">골라 주세요</option>}
                        {FORMATS.map((format) => (
                          <option key={format}>{format}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      제작 구분 <i>선택</i>
                      <select value={draft.productionType} onChange={set('productionType')}>
                        <option value="">선택 안 함</option>
                        {Object.entries(PRODUCTION_TYPES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <PosterPicker
                    format={draft.genre}
                    posterUrl={draft.posterUrl}
                    onChange={(posterUrl) => setDraft((current) => ({ ...current, posterUrl }))}
                  />
                  <fieldset className="wiz-field">
                    <legend>
                      장르 <i>여러 개 선택</i>
                    </legend>
                    <div className="chip-pick">
                      {GENRE_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={draft.genres.includes(tag)}
                          className={draft.genres.includes(tag) ? 'on' : ''}
                          onClick={() => toggleIn('genres', tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="form-two">
                    <label>
                      분량 <i>선택</i>
                      <input
                        value={draft.runtime}
                        onChange={set('runtime')}
                        placeholder="예: 20분, 8부작"
                      />
                    </label>
                    <label>
                      공개 예정 시기 <i>선택</i>
                      <input
                        value={draft.releasePeriod}
                        onChange={set('releasePeriod')}
                        placeholder="예: 2027년 상반기"
                      />
                    </label>
                  </div>
                  <fieldset className="wiz-field">
                    <legend>
                      공개처 <i>여러 개 선택</i>
                    </legend>
                    <div className="chip-pick">
                      {Object.entries(RELEASE_CHANNELS).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={draft.releaseChannels.includes(value)}
                          className={draft.releaseChannels.includes(value) ? 'on' : ''}
                          onClick={() => toggleIn('releaseChannels', value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <h2 className="wiz-section">제작진</h2>
                  <label>
                    제작사·단체 <i>선택</i>
                    <input
                      value={draft.company}
                      onChange={set('company')}
                      placeholder="예: 한국영화아카데미, ○○필름"
                    />
                  </label>
                  <div className="form-two">
                    <label>
                      연출 <i>선택</i>
                      <input value={draft.director} onChange={set('director')} />
                    </label>
                    <label>
                      프로듀서 <i>선택</i>
                      <input value={draft.producerName} onChange={set('producerName')} />
                    </label>
                  </div>

                  <h2 className="wiz-section">소개</h2>
                  <label>
                    한 줄 소개 <i>선택</i>
                    <input
                      value={draft.logline}
                      onChange={set('logline')}
                      maxLength={120}
                      placeholder="예: 이별 후 처음 고향에 돌아온 청년의 하루"
                    />
                  </label>
                  <label>
                    시놉시스 <i>선택</i>
                    <textarea
                      rows={4}
                      value={draft.description}
                      onChange={set('description')}
                      placeholder="줄거리와 분위기, 참고 작품을 적어 주세요."
                    />
                  </label>

                  <h2 className="wiz-section">촬영 지역</h2>
                  <div className="form-two">
                    <label>
                      시·도 <em>*</em>
                      <select value={draft.region} onChange={set('region')}>
                        {!PROJECT_REGIONS.includes(draft.region) && (
                          <option value="">골라 주세요</option>
                        )}
                        {PROJECT_REGIONS.map((region) => (
                          <option key={region}>{region}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      상세 위치 {draft.region === '미정' ? <i>선택</i> : <em>*</em>}
                      <input
                        value={draft.locationDetail}
                        onChange={set('locationDetail')}
                        placeholder="예: 성동구"
                      />
                    </label>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h2 className="wiz-section">오디션</h2>
                  <div className="form-two">
                    <label>
                      시작일 <i>선택</i>
                      <input
                        type="date"
                        value={draft.auditionStart}
                        onChange={set('auditionStart')}
                      />
                    </label>
                    <label>
                      종료일 <i>선택</i>
                      <input type="date" value={draft.auditionEnd} onChange={set('auditionEnd')} />
                    </label>
                  </div>
                  <h2 className="wiz-section">리딩·리허설</h2>
                  <div className="form-two">
                    <label>
                      시작일 <i>선택</i>
                      <input type="date" value={draft.prepStart} onChange={set('prepStart')} />
                    </label>
                    <label>
                      종료일 <i>선택</i>
                      <input type="date" value={draft.prepEnd} onChange={set('prepEnd')} />
                    </label>
                  </div>
                  <h2 className="wiz-section">촬영</h2>
                  <div className="form-two">
                    <label>
                      시작일 <em>*</em>
                      <input type="date" value={draft.shootStart} onChange={set('shootStart')} />
                    </label>
                    <label>
                      종료일 <i>선택</i>
                      <input type="date" value={draft.shootEnd} onChange={set('shootEnd')} />
                    </label>
                  </div>
                  <label>
                    총 회차 <i>선택</i>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      inputMode="numeric"
                      value={draft.shootSessions}
                      onChange={set('shootSessions')}
                      placeholder="예: 3"
                    />
                  </label>
                  <p className="wiz-note">
                    배역 촬영일은 기본으로 이 촬영 기간을 그대로 따라요. 배역마다 날짜가 다르면 다음
                    단계에서 따로 고를 수 있어요.
                  </p>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="wiz-bulk">
                    <span>
                      작품 촬영 일정: <strong>{shootSummary || '미정'}</strong>
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          roles: current.roles.map((role) => ({ ...role, shootMode: 'all' })),
                        }))
                      }
                    >
                      모든 배역에 일괄 적용
                    </button>
                  </div>
                  {draft.roles.map((role, index) => {
                    const extraDays = normalizeDates(role.shootDates).filter(
                      (day) => !projectDays.includes(day),
                    );
                    return (
                      <div key={role.key} className="role-block">
                        <div className="role-block-head">
                          <strong>
                            배역 {index + 1}
                            {role.id && (
                              <small className="wiz-count">
                                지원자 {role.applicationCount ?? 0}명
                              </small>
                            )}
                          </strong>
                          {role.id ? (
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setRole(role.key, { isClosed: !role.isClosed })}
                            >
                              {role.isClosed ? '접수 다시 열기' : '접수 마감'}
                            </button>
                          ) : (
                            draft.roles.length > 1 && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  setDraft((current) => ({
                                    ...current,
                                    roles: current.roles.filter((item) => item.key !== role.key),
                                  }))
                                }
                              >
                                삭제
                              </button>
                            )
                          )}
                        </div>
                        {role.isClosed && (
                          <p className="wiz-note">
                            지원 접수를 마감한 배역이에요. 저장하면 반영돼요.
                          </p>
                        )}
                        <label>
                          배역명 <em>*</em>
                          <input
                            value={role.title}
                            onChange={(event) => setRole(role.key, { title: event.target.value })}
                            placeholder="예: 민수 역"
                          />
                        </label>
                        <div className="form-two">
                          <label>
                            비중 <i>선택</i>
                            <select
                              value={role.roleType}
                              onChange={(event) =>
                                setRole(role.key, { roleType: event.target.value })
                              }
                            >
                              <option value="">선택 안 함</option>
                              {Object.entries(ROLE_TYPES).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            성별 <i>선택</i>
                            <select
                              value={role.gender}
                              onChange={(event) =>
                                setRole(role.key, { gender: event.target.value })
                              }
                            >
                              <option value="">선택 안 함</option>
                              {Object.entries(ROLE_GENDERS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="form-two">
                          <label>
                            연령대 <i>선택</i>
                            <span className="range-inputs">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                inputMode="numeric"
                                aria-label="최소 나이"
                                value={role.ageMin}
                                onChange={(event) =>
                                  setRole(role.key, { ageMin: event.target.value })
                                }
                                placeholder="20"
                              />
                              <span aria-hidden>~</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                inputMode="numeric"
                                aria-label="최대 나이"
                                value={role.ageMax}
                                onChange={(event) =>
                                  setRole(role.key, { ageMax: event.target.value })
                                }
                                placeholder="29"
                              />
                            </span>
                          </label>
                          <label>
                            모집 인원
                            <input
                              type="number"
                              min={1}
                              max={999}
                              inputMode="numeric"
                              value={role.headcount}
                              onChange={(event) =>
                                setRole(role.key, { headcount: event.target.value })
                              }
                            />
                          </label>
                        </div>
                        <label>
                          배역 설명 <em>*</em>
                          <textarea
                            rows={3}
                            value={role.description}
                            onChange={(event) =>
                              setRole(role.key, { description: event.target.value })
                            }
                            placeholder="인물의 성격과 필요한 연기를 적어 주세요."
                          />
                        </label>
                        <label>
                          {/* 항목 이름에 '필수'가 들어가 있어서, 입력 자체는 선택이라는 걸 따로 적어 준다 */}
                          지원 필수 조건 <i>선택</i>
                          <input
                            value={role.requirement}
                            onChange={(event) =>
                              setRole(role.key, { requirement: event.target.value })
                            }
                            placeholder="예: 부산 사투리 가능"
                          />
                        </label>
                        {/* 공고 필수 항목: 배우가 지원 전에 알아야 할 장면. '없음'도 직접 고르게 한다. */}
                        <fieldset className="wiz-field">
                          <legend>
                            특수 장면 안내 <em>*</em>
                          </legend>
                          <div className="chip-pick">
                            <button
                              type="button"
                              aria-pressed={role.specialScenes.includes(NO_SPECIAL_SCENE)}
                              className={role.specialScenes.includes(NO_SPECIAL_SCENE) ? 'on' : ''}
                              onClick={() =>
                                setRole(role.key, {
                                  specialScenes: role.specialScenes.includes(NO_SPECIAL_SCENE)
                                    ? []
                                    : [NO_SPECIAL_SCENE],
                                  specialNote: '',
                                })
                              }
                            >
                              특수 장면 없음
                            </button>
                            {Object.entries(SPECIAL_SCENES).map(([value, label]) => {
                              const on = role.specialScenes.includes(value);
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  aria-pressed={on}
                                  className={on ? 'on' : ''}
                                  onClick={() =>
                                    setRole(role.key, {
                                      // 종류를 고르면 '없음'은 자동으로 풀린다.
                                      specialScenes: toggle(
                                        role.specialScenes.filter(
                                          (item) => item !== NO_SPECIAL_SCENE,
                                        ),
                                        value,
                                      ),
                                    })
                                  }
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          {role.specialScenes.some((item) => item !== NO_SPECIAL_SCENE) && (
                            <label>
                              구체적인 안내 <i>선택</i>
                              <textarea
                                rows={2}
                                maxLength={500}
                                value={role.specialNote}
                                onChange={(event) =>
                                  setRole(role.key, { specialNote: event.target.value })
                                }
                                placeholder="예: 상반신 노출 1컷. 최소 인원만 있는 현장에서 촬영하고, 사전 리허설을 합니다."
                              />
                            </label>
                          )}
                        </fieldset>
                        <fieldset className="wiz-field">
                          <legend>촬영일</legend>
                          <div className="seg-choice" role="group" aria-label="촬영일 정하는 방식">
                            <button
                              type="button"
                              aria-pressed={role.shootMode === 'all'}
                              className={role.shootMode === 'all' ? 'on' : ''}
                              onClick={() => setRole(role.key, { shootMode: 'all' })}
                            >
                              작품 일정 그대로
                            </button>
                            <button
                              type="button"
                              aria-pressed={role.shootMode === 'custom'}
                              className={role.shootMode === 'custom' ? 'on' : ''}
                              onClick={() => setRole(role.key, { shootMode: 'custom' })}
                            >
                              이 배역만 따로 지정
                            </button>
                          </div>
                          {role.shootMode === 'all' ? (
                            <p className="wiz-note">
                              {shootSummary
                                ? `작품 촬영 일정(${shootSummary})을 그대로 따라요.`
                                : '일정 단계에서 촬영 기간을 먼저 정해 주세요.'}
                            </p>
                          ) : (
                            <>
                              {projectDays.length > 0 && projectDays.length <= MAX_DAY_CHIPS && (
                                <div className="chip-pick day-chips">
                                  {projectDays.map((day) => (
                                    <button
                                      key={day}
                                      type="button"
                                      aria-pressed={role.shootDates.includes(day)}
                                      className={role.shootDates.includes(day) ? 'on' : ''}
                                      onClick={() =>
                                        setRole(role.key, {
                                          shootDates: toggle(role.shootDates, day),
                                        })
                                      }
                                    >
                                      {dayLabel(day)}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {extraDays.length > 0 && (
                                <div className="chip-pick day-chips">
                                  {extraDays.map((day) => (
                                    <button
                                      key={day}
                                      type="button"
                                      className="on"
                                      aria-label={`${dayLabel(day)} 빼기`}
                                      onClick={() =>
                                        setRole(role.key, {
                                          shootDates: role.shootDates.filter(
                                            (item) => item !== day,
                                          ),
                                        })
                                      }
                                    >
                                      {dayLabel(day)} ×
                                    </button>
                                  ))}
                                </div>
                              )}
                              <label className="date-add">
                                {projectDays.length > 0 && projectDays.length <= MAX_DAY_CHIPS
                                  ? '촬영 기간 밖의 날짜 추가'
                                  : '날짜 추가'}
                                <input
                                  type="date"
                                  value=""
                                  onChange={(event) => {
                                    const day = event.target.value;
                                    if (day && !role.shootDates.includes(day))
                                      setRole(role.key, {
                                        shootDates: [...role.shootDates, day],
                                      });
                                  }}
                                />
                              </label>
                              <p className="wiz-note">
                                {normalizeDates(role.shootDates).length
                                  ? `고른 날짜: ${formatDates(role.shootDates, 4)}`
                                  : '이 배역이 촬영하는 날을 하나 이상 골라 주세요.'}
                              </p>
                            </>
                          )}
                        </fieldset>
                      </div>
                    );
                  })}
                  {draft.roles.length < MAX_ROLES && (
                    <button
                      type="button"
                      className="button button-soft full"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          roles: [...current.roles, blankRole()],
                        }))
                      }
                    >
                      ＋ 배역 추가
                    </button>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <div className="form-two">
                    <label>
                      지원 마감일 <em>*</em>
                      <input type="date" value={draft.deadline} onChange={set('deadline')} />
                    </label>
                    <label>
                      결과 안내일 <em>*</em>
                      <input
                        type="date"
                        value={draft.announcementDate}
                        onChange={set('announcementDate')}
                      />
                    </label>
                  </div>
                  <p className="wiz-note result-rule">
                    {resultDue
                      ? `결과 기준일은 ${formatPeriod(resultDue)}${resultDue !== draft.announcementDate ? '(오디션 종료일)' : ''}이에요. `
                      : '결과 안내일(오디션 종료일이 더 늦으면 그날)이 결과 기준일이에요. '}
                    배우가 무기한 기다리지 않도록, 이날까지 결과를 정하지 않은 지원자에게는 다음 날
                    자동으로 &lsquo;불합격&rsquo;이 안내돼요. {RESULT_WARNING_DAYS}일 전부터
                    스튜디오와 알림에서 미리 알려 드리고, 기준일을 미루면 자동 안내도 함께 미뤄져요.
                  </p>
                  <label>
                    출연료·교통·식비 <em>*</em>
                    <input
                      value={draft.pay}
                      onChange={set('pay')}
                      placeholder="예: 회차당 15만 원, 교통비·식비 별도 지급"
                    />
                  </label>
                  <fieldset className="wiz-field">
                    <legend>
                      제공 항목 <i>여러 개 선택</i>
                    </legend>
                    <div className="chip-pick">
                      {Object.entries(PERKS).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={draft.perks.includes(value)}
                          className={draft.perks.includes(value) ? 'on' : ''}
                          onClick={() => toggleIn('perks', value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label>
                    담당자 <em>*</em>
                    <input
                      value={draft.contactName}
                      onChange={set('contactName')}
                      placeholder="예: 연출 이지현"
                    />
                  </label>
                  <p className="wiz-note">
                    지원 마감·결과 안내·출연료·담당자는 이 작품의 모든 배역에 똑같이 적용돼요.
                  </p>
                </>
              )}

              {step === 4 && (
                <div className="review-card">
                  <div>
                    <span>작품</span>
                    <strong>
                      {draft.title} · {draft.genre}
                      {draft.genres.length > 0 && ` · ${draft.genres.join('·')}`}
                    </strong>
                  </div>
                  {(draft.productionType || draft.runtime || draft.releaseChannels.length > 0) && (
                    <div>
                      <span>제작·공개</span>
                      <strong>
                        {[
                          PRODUCTION_TYPES[draft.productionType],
                          draft.runtime,
                          draft.releaseChannels.map((value) => RELEASE_CHANNELS[value]).join('·'),
                          draft.releasePeriod,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </strong>
                    </div>
                  )}
                  {(draft.company || draft.director || draft.producerName) && (
                    <div>
                      <span>제작진</span>
                      <strong>
                        {[
                          draft.company,
                          draft.director && `연출 ${draft.director}`,
                          draft.producerName && `PD ${draft.producerName}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </strong>
                    </div>
                  )}
                  {draft.logline.trim() && (
                    <div>
                      <span>한 줄 소개</span>
                      <strong>{draft.logline}</strong>
                    </div>
                  )}
                  <div>
                    <span>촬영 지역</span>
                    <strong>
                      {draft.region} {draft.locationDetail}
                    </strong>
                  </div>
                  <div>
                    <span>일정</span>
                    <strong>
                      {[
                        draft.auditionStart &&
                          `오디션 ${formatPeriod(draft.auditionStart, draft.auditionEnd)}`,
                        draft.prepStart &&
                          `리딩·리허설 ${formatPeriod(draft.prepStart, draft.prepEnd)}`,
                        shootSummary && `촬영 ${shootSummary}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </strong>
                  </div>
                  <div>
                    <span>배역</span>
                    <strong className="review-roles">
                      {draft.roles
                        .filter((role) => role.title.trim())
                        .map((role) => (
                          <span key={role.key}>
                            {[
                              role.title,
                              ROLE_TYPES[role.roleType],
                              ROLE_GENDERS[role.gender],
                              ageRangeLabel(Number(role.ageMin) || 0, Number(role.ageMax) || 0),
                              `${Number(role.headcount) || 1}명`,
                              `촬영 ${formatDates(roleDays(role)) || '미정'}`,
                              specialScenesLabel(normalizeSpecialScenes(role.specialScenes)),
                              role.isClosed && '접수 마감',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        ))}
                    </strong>
                  </div>
                  <div>
                    <span>지원 마감</span>
                    <strong>{draft.deadline}</strong>
                  </div>
                  <div>
                    <span>결과 안내</span>
                    <strong>{draft.announcementDate}</strong>
                  </div>
                  <div>
                    <span>조건</span>
                    <strong>
                      {draft.pay}
                      {draft.perks.length > 0 &&
                        ` · ${draft.perks.map((value) => PERKS[value]).join('·')} 제공`}
                    </strong>
                  </div>
                  <div>
                    <span>담당자</span>
                    <strong>{draft.contactName}</strong>
                  </div>
                </div>
              )}

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="wizard-actions">
                {!isEdit && (
                  <button type="button" className="button button-outline" onClick={saveDraft}>
                    임시 저장
                  </button>
                )}
                {step > 0 && (
                  <button type="button" className="button button-outline" onClick={previous}>
                    이전
                  </button>
                )}
                <button
                  type="button"
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => void next()}
                >
                  {step === STEPS.length - 1
                    ? busy
                      ? isEdit
                        ? '저장 중…'
                        : '게시 중…'
                      : isEdit
                        ? '수정 내용 저장'
                        : '프로젝트 게시하기'
                    : '다음 단계 →'}
                </button>
              </div>
              {isEdit && removal && (
                <ProjectCleanup
                  title={draft.title}
                  mode={removalMode}
                  usage={removal.usage}
                  archived={removal.archived}
                  confirming={confirming}
                  busy={removing}
                  error={removeError}
                  onOpen={() => {
                    setConfirming(true);
                    setRemoveError('');
                  }}
                  onCancel={() => setConfirming(false)}
                  onConfirm={() => void cleanUp()}
                />
              )}
            </div>
          </section>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status" onClick={() => setNotice('')}>
          {notice}
          <button aria-label="닫기">×</button>
        </div>
      )}
    </main>
  );
}

/**
 * 작품 포스터 올리기. 비워 두면 형식에 맞는 기본 커버가 프로젝트 카드·대화에 쓰인다.
 * 업로드는 /api/uploads(storage.ts: Vercel Blob 또는 로컬 폴더)를 그대로 쓴다.
 */
function PosterPicker({
  format,
  posterUrl,
  onChange,
}: {
  format: string;
  posterUrl: string;
  onChange: (posterUrl: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '포스터를 올리지 못했습니다.');
      if (String(data.url).endsWith('.pdf'))
        throw new Error('포스터는 사진 파일만 올릴 수 있어요.');
      onChange(data.url);
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : '포스터를 올리지 못했습니다.');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="wiz-field poster-pick">
      <div className="poster-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={projectCover(format, posterUrl)} alt="작품 이미지 미리 보기" />
      </div>
      <div className="poster-body">
        <strong>
          포스터 <i>선택</i>
        </strong>
        <p>
          {posterUrl
            ? '프로젝트 카드와 배우와의 대화에 이 포스터가 보여요.'
            : '올리지 않으면 형식에 맞는 기본 커버가 보여요.'}
        </p>
        <div className="poster-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={uploading}
            onClick={() => input.current?.click()}
          >
            {uploading ? '올리는 중…' : posterUrl ? '바꾸기' : '포스터 올리기'}
          </button>
          {posterUrl && (
            <button type="button" className="text-button" onClick={() => onChange('')}>
              기본 커버로
            </button>
          )}
        </div>
        {uploadError && (
          <p className="form-error" role="alert">
            {uploadError}
          </p>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => void upload(event.target.files)}
        />
      </div>
    </div>
  );
}

type CleanupProps = {
  title: string;
  mode: 'delete' | 'archive';
  usage: ProjectUsage;
  archived: boolean;
  confirming: boolean;
  busy: boolean;
  error: string;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * 프로젝트 정리(수정 화면 맨 아래).
 * 지원자·제안이 없으면 완전 삭제, 있으면 배우가 보는 기록이 남아 있어 보관(숨김)만 한다.
 * 실수로 누르지 않게 화면 안에서 한 번 더 확인한다.
 */
function ProjectCleanup(props: CleanupProps) {
  const { usage, mode, archived } = props;
  const name = props.title.trim();
  const records = [
    usage.applications > 0 && `지원자 ${usage.applications}명`,
    usage.proposals > 0 && `캐스팅 제안 ${usage.proposals}건`,
  ].filter(Boolean);
  const action = archived ? '다시 꺼내기' : mode === 'delete' ? '프로젝트 삭제' : '프로젝트 보관';
  return (
    <section className="cleanup-box" aria-labelledby="cleanup-title">
      <h2 id="cleanup-title">프로젝트 정리</h2>
      <p className="wiz-note">
        {archived
          ? '보관한 프로젝트예요. 다시 꺼내면 내 프로젝트 목록과 팀 보드에 다시 보여요.'
          : mode === 'delete'
            ? '아직 지원자와 보낸 캐스팅 제안이 없어 완전히 삭제할 수 있어요.'
            : `${records.join('·')}의 기록이 있어 삭제 대신 보관할 수 있어요.`}
      </p>
      {!props.confirming ? (
        <button
          type="button"
          className={`button button-outline${mode === 'delete' && !archived ? ' danger' : ''}`}
          onClick={props.onOpen}
        >
          {action}
        </button>
      ) : (
        <div className="cleanup-confirm" role="alertdialog" aria-labelledby="cleanup-question">
          <strong id="cleanup-question">
            {name ? `‘${name}’ 프로젝트를` : '이 프로젝트를'}{' '}
            {archived ? '다시 꺼낼까요?' : mode === 'delete' ? '삭제할까요?' : '보관할까요?'}
          </strong>
          {archived ? (
            <ul>
              <li>내 프로젝트 목록과 팀 보드에 다시 보여요.</li>
              <li>배역 접수는 마감된 상태예요. 다시 받으려면 배역 단계에서 접수를 열어 주세요.</li>
            </ul>
          ) : mode === 'delete' ? (
            <ul>
              <li>배역 {usage.roles}개와 지원 링크가 모두 사라지고, 되돌릴 수 없어요.</li>
              {usage.teamMembers > 0 && (
                <li>초대한 팀원 {usage.teamMembers}명도 이 프로젝트 보드를 더 볼 수 없어요.</li>
              )}
              <li>캘린더에 잡아 둔 일정은 지우지 않고 남겨 둬요.</li>
            </ul>
          ) : (
            <ul>
              <li>
                {records.join('·')}의 지원서·대화·팀 보드 기록이 있어 완전히 지우지 않고 보관해요.
              </li>
              <li>모든 배역의 지원 접수가 마감돼요.</li>
              <li>
                내 프로젝트 목록과 팀 보드에서 숨겨져요
                {usage.teamMembers > 0 ? `(초대한 팀원 ${usage.teamMembers}명에게도)` : ''}.
              </li>
              <li>배우가 보는 지원 현황과 대화는 그대로 남아요.</li>
              <li>스튜디오 홈의 &lsquo;보관한 프로젝트&rsquo;에서 언제든 다시 꺼낼 수 있어요.</li>
            </ul>
          )}
          {props.error && (
            <p className="form-error" role="alert">
              {props.error}
            </p>
          )}
          <div className="cleanup-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={props.onCancel}
              disabled={props.busy}
            >
              취소
            </button>
            <button
              type="button"
              className={`button ${mode === 'delete' && !archived ? 'button-danger' : 'button-primary'}`}
              onClick={props.onConfirm}
              disabled={props.busy}
            >
              {props.busy ? '처리 중…' : action}
            </button>
          </div>
        </div>
      )}
      {!props.confirming && props.error && (
        <p className="form-error" role="alert">
          {props.error}
        </p>
      )}
    </section>
  );
}
