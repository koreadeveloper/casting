'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import BackButton from '@/components/back-button';
import ProducerNav from '@/components/producer-nav';
import ActorNav from '@/components/actor-nav';
import type { ActorProfileFull } from '@/lib/accounts';
import { profileAge, genderLabel } from '@/lib/profile';
import { pushRecent, RECENT_ACTORS } from '@/lib/recent';
import { useBackClose } from '@/lib/use-back-close';
import { embedUrl } from '@/lib/video';

type Tab = 'intro' | 'video' | 'filmo' | 'photos' | 'docs';

export default function ActorDetail({
  profile,
  viewer,
  favorite: initialFavorite,
  roles,
  proposedRoleIds,
  justSaved = false,
}: {
  profile: ActorProfileFull;
  viewer: 'producer' | 'self';
  favorite: boolean;
  roles: { id: string; label: string }[];
  proposedRoleIds: string[];
  /** 프로필 관리에서 저장하고 바로 넘어왔는지(안내 문구용) */
  justSaved?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('intro');
  const [photo, setPhoto] = useState(profile.photos[0] || '');
  const [favorite, setFavorite] = useState(initialFavorite);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposed, setProposed] = useState(proposedRoleIds);
  const [roleId, setRoleId] = useState('');
  const [message, setMessage] = useState(
    `${profile.name}님, 프로필을 인상 깊게 봤습니다. 아래 배역에 함께해 주실 수 있을지 제안드립니다.`,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  // 배역 제안 시트는 휴대폰 뒤로가기로 닫힌다.
  useBackClose(proposeOpen, () => setProposeOpen(false));
  const age = profileAge(profile);

  // 제작자가 본 배우만 '최근 본 배우'에 남긴다 (배우가 자기 프로필을 미리볼 때는 제외).
  useEffect(() => {
    if (viewer !== 'producer') return;
    pushRecent(RECENT_ACTORS, {
      id: profile.userId,
      name: profile.name,
      sub: [profileAge(profile) ? `${profileAge(profile)}세` : '', profile.region]
        .filter(Boolean)
        .join(' · '),
      photo: profile.photos[0] || '',
      href: `/actors/${profile.userId}`,
    });
  }, [viewer, profile.userId, profile.name, profile.region, profile.birthYear, profile.photos]);
  const embed = profile.videoUrl ? embedUrl(profile.videoUrl) : null;
  const available = roles.filter((role) => !proposed.includes(role.id));
  const proposedLabels = roles
    .filter((role) => proposed.includes(role.id))
    .map((role) => role.label);

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    const response = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: profile.userId, favorite: next }),
    });
    if (!response.ok) setFavorite(!next);
  }

  async function propose(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: profile.userId, roleId, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '제안을 보내지 못했습니다.');
      setProposed((current) => [...current, roleId]);
      setRoleId('');
      setProposeOpen(false);
      setNotice(
        `캐스팅 제안을 보냈습니다${data.notified ? '(배우에게 메일로도 알렸어요)' : ''}. 배우가 수락하면 지원자 목록에 표시됩니다.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '제안을 보내지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const facts = [
    age !== null ? `${age}세` : '',
    profile.height ? `${profile.height}cm` : '',
    profile.weight ? `${profile.weight}kg` : '',
    profile.region,
    profile.gender ? genderLabel[profile.gender] : '',
  ].filter(Boolean);

  return (
    <main className="app-shell wide">
      {viewer === 'producer' && <ProducerNav active="actors" />}
      {/* 배우 본인이 미리보기로 볼 때도 하단(넓은 화면은 왼쪽) 메뉴를 그대로 둔다 */}
      {viewer === 'self' && <ActorNav active="preview" actorId={profile.userId} />}
      <div className="screen-pad page-top">
        {/* 배우 검색·추천·팀 보드 등 어디서 왔든 그 화면으로 돌아간다. */}
        <BackButton
          fallback={viewer === 'producer' ? '/studio/actors' : '/me/profile'}
          label={viewer === 'producer' ? '뒤로' : '프로필 관리'}
        />
        {viewer === 'self' && (
          <div className="notice-bar">
            {justSaved
              ? '프로필을 저장했어요. 제작자에게는 이렇게 보여요.'
              : '제작자에게 보이는 내 프로필 미리보기입니다.'}
          </div>
        )}
        <div className="detail-layout">
          <div className="detail-media">
            <div className="hero-photo">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={`${profile.name} 프로필 사진`} />
              ) : (
                <span>{profile.name.slice(-2)}</span>
              )}
            </div>
            {profile.photos.length > 1 && (
              <div className="thumb-row">
                {profile.photos.map((url) => (
                  <button
                    key={url}
                    className={url === photo ? 'on' : ''}
                    onClick={() => setPhoto(url)}
                    aria-label="사진 보기"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="detail-info">
            <div className="name-row">
              <h1>{profile.name}</h1>
              {viewer === 'producer' && (
                <div className="name-actions">
                  <button
                    className={`button button-outline sm${favorite ? ' fav-on' : ''}`}
                    onClick={() => void toggleFavorite()}
                  >
                    {favorite ? '♥ 관심 저장됨' : '♡ 관심 저장'}
                  </button>
                  <button className="button button-primary sm" onClick={() => setProposeOpen(true)}>
                    캐스팅 제안
                  </button>
                </div>
              )}
            </div>
            <p className="facts">{facts.join(' | ') || '기본 정보 미입력'}</p>
            {profile.agency && <p className="facts">소속 · {profile.agency}</p>}
            {profile.tags.length > 0 && (
              <div className="tag-row big">
                {profile.tags.map((tag) => (
                  <i key={tag}>{tag}</i>
                ))}
              </div>
            )}
            <div className="tabs" role="tablist">
              {(
                [
                  ['intro', '소개'],
                  ['video', '영상'],
                  ['filmo', '필모그래피'],
                  ['photos', '사진'],
                  ...(profile.documents.length > 0 ? ([['docs', '자료']] as [Tab, string][]) : []),
                ] as [Tab, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  className={tab === value ? 'on' : ''}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'intro' && (
              <div className="tab-body">
                <h3>소개글</h3>
                <p className="pre">{profile.intro || '아직 소개글이 없습니다.'}</p>
                {profile.skills.length > 0 && (
                  <>
                    <h3>특기</h3>
                    <div className="tag-row">
                      {profile.skills.map((skill) => (
                        <i key={skill} className="plain">
                          {skill}
                        </i>
                      ))}
                    </div>
                  </>
                )}
                {profile.filmography.length > 0 && (
                  <>
                    <h3>주요 필모그래피</h3>
                    <ul className="filmo">
                      {profile.filmography.slice(0, 3).map((item, index) => (
                        <li key={index}>
                          <b>{item.year}</b>
                          {item.title} <span>{item.role}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            {tab === 'video' && (
              <div className="tab-body">
                {embed ? (
                  <div className="video-frame">
                    <iframe
                      src={embed}
                      title={`${profile.name} 연기 영상`}
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : profile.videoUrl ? (
                  <a
                    className="button button-outline"
                    href={profile.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    연기 영상 열기 ↗
                  </a>
                ) : (
                  <p className="muted">등록된 연기 영상이 없습니다.</p>
                )}
              </div>
            )}
            {tab === 'filmo' && (
              <div className="tab-body">
                {profile.filmography.length ? (
                  <ul className="filmo">
                    {profile.filmography.map((item, index) => (
                      <li key={index}>
                        <b>{item.year}</b>
                        {item.title} <span>{item.role}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">등록된 필모그래피가 없습니다.</p>
                )}
              </div>
            )}
            {tab === 'photos' && (
              <div className="tab-body photo-grid">
                {profile.photos.length ? (
                  profile.photos.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt={`${profile.name} 사진`} loading="lazy" />
                  ))
                ) : (
                  <p className="muted">등록된 사진이 없습니다.</p>
                )}
              </div>
            )}
            {tab === 'docs' && (
              <div className="tab-body">
                <h3>추가 자료</h3>
                <ul className="filmo">
                  {profile.documents.map((doc) => (
                    <li key={doc.url}>
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        {doc.name || '첨부 자료'} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {viewer === 'producer' && (
              <Link
                href={`/report?type=actor&id=${encodeURIComponent(profile.userId)}`}
                className="account-danger"
              >
                이 배우 신고하기
              </Link>
            )}
          </div>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status" onClick={() => setNotice('')}>
          {notice}
          <button aria-label="닫기">×</button>
        </div>
      )}
      {proposeOpen && (
        <div className="sheet-backdrop" onClick={() => setProposeOpen(false)}>
          <section
            className="detail-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="캐스팅 제안"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-title">
              <span>{profile.name}님에게 캐스팅 제안</span>
              <button onClick={() => setProposeOpen(false)} aria-label="닫기">
                ×
              </button>
            </div>
            {proposedLabels.length > 0 && (
              <p className="small-note">이미 제안한 배역: {proposedLabels.join(', ')}</p>
            )}
            {available.length === 0 ? (
              <div className="empty-card">
                {roles.length === 0 ? (
                  <>
                    제안할 수 있는 모집 중 배역이 없습니다.
                    <br />
                    <Link href="/studio/projects/new">프로젝트를 먼저 등록해 주세요.</Link>
                  </>
                ) : (
                  '모든 모집 중 배역으로 이미 제안을 보냈습니다.'
                )}
              </div>
            ) : (
              <form className="role-form" onSubmit={propose}>
                <label>
                  배역
                  <select
                    value={roleId}
                    onChange={(event) => setRoleId(event.target.value)}
                    required
                  >
                    <option value="">배역을 선택해 주세요</option>
                    {available.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  메시지
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={1000}
                    required
                  />
                </label>
                <p className="small-note">
                  배우의 연락처는 배우가 제안을 수락하고 지원서를 제출한 뒤에 확인할 수 있습니다.
                </p>
                {error && <p className="form-error">{error}</p>}
                <button className="button button-primary full" disabled={busy || !roleId}>
                  {busy ? '보내는 중…' : '제안 보내기'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
