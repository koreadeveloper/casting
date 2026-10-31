'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import ActorNav from '@/components/actor-nav';
import type { ActorProfileFull, ProfileDocument } from '@/lib/accounts';
import type { ProfileDraft } from '@/lib/profile-draft';
import {
  IMAGE_TAG_GROUPS,
  MAX_SKILLS,
  MAX_TAGS,
  profileCompletion,
  REGIONS,
  SKILL_GROUPS,
  type Gender,
  type PickGroup,
} from '@/lib/profile';
import { embedUrl } from '@/lib/video';

const SECTIONS = [
  ['basic', '기본 정보'],
  ['photos', '프로필 사진'],
  ['video', '연기 영상'],
  ['image', '이미지·특기'],
  ['filmo', '필모그래피'],
  ['docs', '자료실'],
  ['schedule', '출연 불가 일정'],
  ['visibility', '공개 설정'],
] as const;

type ActorProfile = ActorProfileFull;

// Mirror of MAX_DOCUMENTS in @/lib/accounts — that module is server-only
// (pulls in node:sqlite), so it cannot be imported from a client component.
const MAX_DOCUMENTS = 5;

/** PDF 초안에서 채울 수 있는 항목과 화면에 쓰는 이름 */
const DRAFT_FIELDS: [keyof ProfileDraft, string][] = [
  ['name', '이름'],
  ['gender', '성별'],
  ['birthYear', '출생 연도'],
  ['height', '키'],
  ['weight', '몸무게'],
  ['region', '활동 지역'],
  ['agency', '소속'],
  ['intro', '소개'],
  ['tags', '이미지 키워드'],
  ['skills', '특기'],
  ['filmography', '필모그래피'],
];

const GENDER_TEXT: Record<string, string> = { female: '여성', male: '남성', other: '기타' };

/** 초안 값을 한 줄로 보여 준다. */
function draftValueText(draft: ProfileDraft, key: keyof ProfileDraft): string {
  const field = draft[key];
  if (!field) return '';
  const { value } = field;
  if (key === 'gender') return GENDER_TEXT[String(value)] ?? String(value);
  if (key === 'height') return `${value}cm`;
  if (key === 'weight') return `${value}kg`;
  if (key === 'birthYear') return `${value}년`;
  if (Array.isArray(value))
    return value
      .map((item) =>
        typeof item === 'string'
          ? item
          : `${item.year} ${item.title}${item.role ? ` (${item.role})` : ''}`,
      )
      .join(', ');
  return String(value).length > 80 ? `${String(value).slice(0, 80)}…` : String(value);
}

/** 키워드·특기를 묶음별로 보여 준다. 목록이 길어서 한 줄로 늘어놓으면 찾기 어렵다. */
function ChipGroups({
  groups,
  picked,
  onPick,
}: {
  groups: PickGroup[];
  picked: string[];
  onPick: (value: string) => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.title} className="chip-group">
          <p className="chip-group-label">{group.title}</p>
          <div className="chip-pick">
            {group.items.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={picked.includes(item)}
                className={picked.includes(item) ? 'on' : ''}
                onClick={() => onPick(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function ProfileEditor({ initial }: { initial: ActorProfile }) {
  const [profile, setProfile] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [newDate, setNewDate] = useState('');
  // PDF로 만든 프로필 초안. 배우가 고른 항목만 입력칸에 채운다.
  const [draftBusy, setDraftBusy] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const draftInput = useRef<HTMLInputElement>(null);
  const completion = profileCompletion(profile);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  const update = <K extends keyof ActorProfile>(key: K, value: ActorProfile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));
  const toggle = (key: 'tags' | 'skills', value: string, max: number) =>
    setProfile((current) => {
      const list = current[key];
      if (list.includes(value)) return { ...current, [key]: list.filter((item) => item !== value) };
      if (list.length >= max) {
        setError(
          key === 'tags'
            ? `이미지 키워드는 최대 ${max}개까지 고를 수 있어요.`
            : '특기를 더 고를 수 없어요.',
        );
        return current;
      }
      setError('');
      return { ...current, [key]: [...list, value] };
    });
  const numberOrNull = (value: string) => (value === '' ? null : Number(value));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 8 - profile.photos.length)) {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch('/api/uploads', { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '사진을 올리지 못했습니다.');
        urls.push(data.url);
      }
      setProfile((current) => ({ ...current, photos: [...current.photos, ...urls].slice(0, 8) }));
      setNotice('사진을 올렸습니다. 저장을 눌러 프로필에 반영하세요.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '사진을 올리지 못했습니다.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function uploadDocument(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (profile.documents.length >= MAX_DOCUMENTS) {
      setError(`자료는 최대 ${MAX_DOCUMENTS}개까지 올릴 수 있어요.`);
      if (docInput.current) docInput.current.value = '';
      return;
    }
    setDocUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '자료를 올리지 못했습니다.');
      const document: ProfileDocument = { name: file.name, url: data.url };
      setProfile((current) => ({
        ...current,
        documents: [...current.documents, document].slice(0, MAX_DOCUMENTS),
      }));
      setNotice('자료를 올렸습니다. 저장을 눌러 프로필에 반영하세요.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '자료를 올리지 못했습니다.');
    } finally {
      setDocUploading(false);
      if (docInput.current) docInput.current.value = '';
    }
  }

  /** PDF를 읽어 초안을 만든다. 저장은 하지 않고 화면에서 확인하게 한다. */
  async function makeDraft(body: FormData | string) {
    setDraftBusy(true);
    setError('');
    setDraft(null);
    try {
      const response = await fetch(
        '/api/profile/draft',
        typeof body === 'string'
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: body }),
            }
          : { method: 'POST', body },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '초안을 만들지 못했습니다.');
      setDraft(data.draft as ProfileDraft);
      setDraftNote(data.note || '');
      setPicked(Object.fromEntries(Object.keys(data.draft).map((key) => [key, true])));
      if (data.filled === 0 && !data.note)
        setDraftNote('읽을 수 있는 항목을 찾지 못했어요. 아래에 내용을 붙여넣어 보세요.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '초안을 만들지 못했습니다.');
    } finally {
      setDraftBusy(false);
      if (draftInput.current) draftInput.current.value = '';
    }
  }

  /** 고른 항목만 입력칸에 채운다. 실제 저장은 아래 '저장' 버튼을 눌러야 된다. */
  function applyDraft() {
    if (!draft) return;
    setProfile((current) => {
      const next = { ...current };
      if (picked.name && draft.name) next.name = draft.name.value;
      if (picked.gender && draft.gender) next.gender = draft.gender.value;
      if (picked.birthYear && draft.birthYear) next.birthYear = draft.birthYear.value;
      if (picked.height && draft.height) next.height = draft.height.value;
      if (picked.weight && draft.weight) next.weight = draft.weight.value;
      if (picked.region && draft.region) next.region = draft.region.value;
      if (picked.agency && draft.agency) next.agency = draft.agency.value;
      if (picked.intro && draft.intro) next.intro = draft.intro.value;
      if (picked.tags && draft.tags) next.tags = draft.tags.value.slice(0, MAX_TAGS);
      if (picked.skills && draft.skills) next.skills = draft.skills.value.slice(0, MAX_SKILLS);
      if (picked.filmography && draft.filmography)
        next.filmography = [...current.filmography, ...draft.filmography.value].slice(0, 12);
      return next;
    });
    setDraft(null);
    setDraftNote('');
    setNotice('초안을 채웠어요. 내용을 확인하고 맨 아래 저장을 눌러 주세요.');
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '저장하지 못했습니다.');
      setProfile(data.profile);
      setSaved(data.profile);
      setNotice('프로필을 저장했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell wide">
      <ActorNav active="profile" actorId={profile.userId} />
      <div className="screen-pad page-top">
        <div className="title-row">
          <h1 className="page-title">프로필 관리</h1>
          <Link className="button button-outline sm" href={`/actors/${profile.userId}`}>
            프로필 미리보기
          </Link>
        </div>
        <div className="completion-card static">
          <div>
            <strong>프로필 완성도 {completion}%</strong>
            <span>
              {completion < 100
                ? '사진 3장, 연기 영상, 필모그래피까지 채우면 100%가 돼요.'
                : '완벽해요! 제작자 검색에 잘 보입니다.'}
            </span>
          </div>
          <div className="bar">
            <i style={{ width: `${completion}%` }} />
          </div>
        </div>
        <div className="editor-layout">
          <aside className="desk-only editor-menu">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </aside>
          <div className="editor-body">
            {/*
              프로필 PDF로 입력칸을 먼저 채워 주는 자리.
              규칙 기반으로 읽어서 같은 PDF면 늘 같은 결과가 나오고, 어느 줄에서 읽었는지 함께 보여 준다.
              읽은 값을 바로 저장하지 않고 배우가 고른 항목만 채운다.
            */}
            <section className="editor-card draft-card">
              <h2>
                프로필 PDF로 먼저 채우기 <small>선택</small>
              </h2>
              <p className="muted small">
                경력기술서·프로필 PDF를 올리면 이름·나이·키·지역·특기·필모그래피를 읽어 입력칸
                초안을 만들어요. 읽은 값은 바로 저장되지 않고, 확인한 항목만 채웁니다.
              </p>
              <div className="split-actions" style={{ marginTop: 12 }}>
                <button
                  className="button button-primary"
                  disabled={draftBusy}
                  onClick={() => draftInput.current?.click()}
                >
                  {draftBusy ? '읽는 중…' : 'PDF 올려서 초안 만들기'}
                </button>
                <button
                  className="button button-soft"
                  onClick={() => setPasteOpen((open) => !open)}
                  aria-expanded={pasteOpen}
                >
                  내용 붙여넣기
                </button>
              </div>
              <input
                ref={draftInput}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append('file', file);
                  void makeDraft(form);
                }}
              />
              {pasteOpen && (
                <div style={{ marginTop: 12 }}>
                  <label className="field-label" htmlFor="draft-paste">
                    프로필 내용 붙여넣기
                  </label>
                  <textarea
                    id="draft-paste"
                    rows={6}
                    value={pasteText}
                    onChange={(event) => setPasteText(event.target.value)}
                    placeholder={
                      '이름: 홍길동\n1999년생 · 여성\n키 165cm\n지역: 서울\n특기: 노래, 댄스'
                    }
                  />
                  <button
                    className="button button-soft full"
                    disabled={draftBusy || pasteText.trim().length < 10}
                    onClick={() => void makeDraft(pasteText)}
                  >
                    붙여넣은 내용으로 초안 만들기
                  </button>
                  <p className="muted small">
                    스캔한 PDF는 글자가 아니라 사진이라 읽을 수 없어요. 그럴 때 이 칸을 쓰세요.
                  </p>
                </div>
              )}
              {draftNote && <p className="form-error">{draftNote}</p>}
              {draft && Object.keys(draft).length > 0 && (
                <div className="draft-result">
                  <strong>{Object.keys(draft).length}개 항목을 읽었어요</strong>
                  <p className="muted small">채울 항목을 확인해 주세요.</p>
                  {DRAFT_FIELDS.filter(([key]) => draft[key]).map(([key, label]) => (
                    <label key={key} className="draft-row">
                      <input
                        type="checkbox"
                        checked={picked[key] ?? true}
                        onChange={(event) =>
                          setPicked((current) => ({ ...current, [key]: event.target.checked }))
                        }
                      />
                      <span className="draft-label">{label}</span>
                      <span className="draft-value">{draftValueText(draft, key)}</span>
                      <small className="draft-source">{draft[key]!.source}</small>
                    </label>
                  ))}
                  <div className="split-actions">
                    <button className="button button-primary" onClick={applyDraft}>
                      고른 항목 채우기
                    </button>
                    <button
                      className="button button-soft"
                      onClick={() => {
                        setDraft(null);
                        setDraftNote('');
                      }}
                    >
                      쓰지 않기
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section id="basic" className="editor-card">
              <h2>기본 정보</h2>
              <div className="role-form">
                <label>
                  이름 <em>*</em>
                  <input
                    value={profile.name}
                    onChange={(event) => update('name', event.target.value)}
                  />
                </label>
                <div className="form-two">
                  <label>
                    성별
                    <select
                      value={profile.gender}
                      onChange={(event) => update('gender', event.target.value as Gender)}
                    >
                      <option value="">선택 안 함</option>
                      <option value="female">여성</option>
                      <option value="male">남성</option>
                      <option value="other">기타</option>
                    </select>
                  </label>
                  <label>
                    출생연도
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="2000"
                      value={profile.birthYear ?? ''}
                      onChange={(event) => update('birthYear', numberOrNull(event.target.value))}
                    />
                  </label>
                </div>
                <div className="form-three">
                  <label>
                    키 (cm)
                    <input
                      type="number"
                      inputMode="numeric"
                      value={profile.height ?? ''}
                      onChange={(event) => update('height', numberOrNull(event.target.value))}
                    />
                  </label>
                  <label>
                    체중 (kg)
                    <input
                      type="number"
                      inputMode="numeric"
                      value={profile.weight ?? ''}
                      onChange={(event) => update('weight', numberOrNull(event.target.value))}
                    />
                  </label>
                  <label>
                    활동 지역
                    <select
                      value={profile.region}
                      onChange={(event) => update('region', event.target.value)}
                    >
                      <option value="">선택</option>
                      {REGIONS.map((region) => (
                        <option key={region}>{region}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  소속/에이전시
                  <input
                    value={profile.agency}
                    maxLength={60}
                    placeholder="소속사 또는 에이전시명 (없으면 비워 두세요)"
                    onChange={(event) => update('agency', event.target.value)}
                  />
                </label>
                <label>
                  소개글
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={profile.intro}
                    onChange={(event) => update('intro', event.target.value)}
                    placeholder="출연작, 연기 스타일, 하고 싶은 작품을 적어 주세요. (20자 이상)"
                  />
                </label>
              </div>
            </section>

            <section id="photos" className="editor-card">
              <h2>
                프로필 사진 <small>{profile.photos.length}/8 · 첫 번째 사진이 대표 사진</small>
              </h2>
              <div className="photo-editor">
                {profile.photos.map((url, index) => (
                  <div key={url} className={`pe-item${index === 0 ? ' main' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`프로필 사진 ${index + 1}`} />
                    {index === 0 && <span className="pe-badge">대표</span>}
                    <div className="pe-actions">
                      {index > 0 && (
                        <button
                          onClick={() =>
                            update('photos', [
                              url,
                              ...profile.photos.filter((item) => item !== url),
                            ])
                          }
                        >
                          대표로
                        </button>
                      )}
                      <button
                        onClick={() =>
                          update(
                            'photos',
                            profile.photos.filter((item) => item !== url),
                          )
                        }
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {profile.photos.length < 8 && (
                  <button
                    className="pe-add"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                  >
                    <span>＋</span>
                    {uploading ? '올리는 중…' : '사진 추가'}
                    <small>JPG·PNG·WEBP, 5MB 이하</small>
                  </button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => void upload(event.target.files)}
              />
            </section>

            <section id="video" className="editor-card">
              <h2>연기 영상</h2>
              <div className="role-form">
                <label>
                  영상 링크
                  <input
                    type="url"
                    value={profile.videoUrl}
                    onChange={(event) => update('videoUrl', event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <small className="hint">YouTube·Vimeo 링크는 프로필에서 바로 재생됩니다.</small>
                </label>
                {profile.videoUrl && embedUrl(profile.videoUrl) && (
                  <div className="video-frame">
                    <iframe
                      src={embedUrl(profile.videoUrl)!}
                      title="연기 영상 미리보기"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            </section>

            <section id="image" className="editor-card">
              <h2>
                이미지 키워드{' '}
                <small>
                  최대 {MAX_TAGS}개 · {profile.tags.length}개 선택
                </small>
              </h2>
              <ChipGroups
                groups={IMAGE_TAG_GROUPS}
                picked={profile.tags}
                onPick={(tag) => toggle('tags', tag, MAX_TAGS)}
              />
              <h2 style={{ marginTop: 22 }}>
                특기{' '}
                <small>
                  최대 {MAX_SKILLS}개 · {profile.skills.length}개 선택
                </small>
              </h2>
              <ChipGroups
                groups={SKILL_GROUPS}
                picked={profile.skills}
                onPick={(skill) => toggle('skills', skill, MAX_SKILLS)}
              />
            </section>

            <section id="filmo" className="editor-card">
              <h2>필모그래피</h2>
              {profile.filmography.map((item, index) => (
                <div key={index} className="filmo-row">
                  <input
                    aria-label="연도"
                    placeholder="2025"
                    maxLength={4}
                    value={item.year}
                    onChange={(event) =>
                      update(
                        'filmography',
                        profile.filmography.map((row, i) =>
                          i === index ? { ...row, year: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="작품명"
                    placeholder="작품명"
                    value={item.title}
                    onChange={(event) =>
                      update(
                        'filmography',
                        profile.filmography.map((row, i) =>
                          i === index ? { ...row, title: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="역할"
                    placeholder="주연"
                    value={item.role}
                    onChange={(event) =>
                      update(
                        'filmography',
                        profile.filmography.map((row, i) =>
                          i === index ? { ...row, role: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <button
                    className="text-button"
                    aria-label="삭제"
                    onClick={() =>
                      update(
                        'filmography',
                        profile.filmography.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="button button-soft full"
                onClick={() =>
                  update('filmography', [
                    ...profile.filmography,
                    { year: String(new Date().getFullYear()), title: '', role: '' },
                  ])
                }
              >
                ＋ 작품 추가
              </button>
            </section>

            <section id="docs" className="editor-card">
              <h2>
                자료실{' '}
                <small>
                  PDF 최대 {MAX_DOCUMENTS}개 · {profile.documents.length}개 등록
                </small>
              </h2>
              <p className="muted" style={{ marginBottom: 12 }}>
                경력기장, 포트폴리오 등 PDF 자료를 올리면 제작자가 프로필에서 열어볼 수 있습니다.
              </p>
              {profile.documents.length > 0 && (
                <ul className="filmo" style={{ marginBottom: 12 }}>
                  {profile.documents.map((doc) => (
                    <li key={doc.url}>
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        {doc.name || '첨부 자료'} ↗
                      </a>
                      <button
                        className="text-button"
                        aria-label={`${doc.name || '첨부 자료'} 삭제`}
                        onClick={() =>
                          update(
                            'documents',
                            profile.documents.filter((item) => item.url !== doc.url),
                          )
                        }
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {profile.documents.length < MAX_DOCUMENTS && (
                <button
                  className="button button-soft full"
                  disabled={docUploading}
                  onClick={() => docInput.current?.click()}
                >
                  {docUploading ? '올리는 중…' : '＋ PDF 자료 추가'}
                </button>
              )}
              <input
                ref={docInput}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(event) => void uploadDocument(event.target.files)}
              />
            </section>

            <section id="schedule" className="editor-card">
              <h2>출연 불가 일정</h2>
              <p className="muted" style={{ marginBottom: 12 }}>
                촬영이 어려운 날짜만 등록하세요. 제작자에게는 해당 날짜에 가능/불가 여부만 보입니다.
              </p>
              <div className="date-add">
                <input
                  type="date"
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                />
                <button
                  className="button button-outline sm"
                  disabled={!newDate || profile.unavailableDates.includes(newDate)}
                  onClick={() => {
                    update('unavailableDates', [...profile.unavailableDates, newDate].sort());
                    setNewDate('');
                  }}
                >
                  추가
                </button>
              </div>
              <div className="chip-pick">
                {profile.unavailableDates.map((date) => (
                  <button
                    key={date}
                    className="on"
                    onClick={() =>
                      update(
                        'unavailableDates',
                        profile.unavailableDates.filter((item) => item !== date),
                      )
                    }
                  >
                    {date} ×
                  </button>
                ))}
              </div>
            </section>

            <section id="visibility" className="editor-card">
              <h2>공개 설정</h2>
              <label className="check">
                <input
                  type="checkbox"
                  checked={profile.isPublic}
                  onChange={(event) => update('isPublic', event.target.checked)}
                />
                <span>제작자 배우 검색에 내 프로필 공개</span>
              </label>
              <p className="small-note">
                공개하면 로그인 전 &lsquo;배우 프로필 둘러보기&rsquo;에도 대표
                사진·이름·나이대·이미지 태그가 보여요. 연락처와 이메일은 검색에 공개되지 않습니다.
                제안을 수락하고 지원한 배역의 제작자에게만 전달됩니다.
              </p>
            </section>
          </div>
        </div>
      </div>
      <div className="save-bar">
        {error && <span className="save-error">{error}</span>}
        <span className="save-state">
          {dirty ? '저장하지 않은 변경 사항이 있습니다' : '모든 변경 사항이 저장됨'}
        </span>
        <button
          className="button button-primary"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {busy ? '저장 중…' : '저장하기'}
        </button>
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
