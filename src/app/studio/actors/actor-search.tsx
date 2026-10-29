'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import FindSwitch from '@/components/find-switch';
import ProducerNav from '@/components/producer-nav';
import RecentStrip from '@/components/recent-strip';
import { RECENT_ACTORS } from '@/lib/recent';
import { useBackClose } from '@/lib/use-back-close';
import type { ActorProfileFull } from '@/lib/accounts';
import {
  ageOf,
  genderLabel,
  IMAGE_TAG_GROUPS,
  MAX_RANGE_DAYS,
  QUICK_IMAGE_TAGS,
  REGIONS,
  SKILL_GROUPS,
  type Availability,
} from '@/lib/profile';

type Result = ActorProfileFull & { favorite: boolean; availability: Availability | null };

/** '2026-10-24' → '10/24' */
function shortDay(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

/** 기간 검색 결과를 배우 카드에 한 줄로 쓴다. */
function availabilityNote(availability: Availability | null) {
  if (!availability || availability.days === 0) return null;
  const { days, blocked, registered } = availability;
  if (blocked.length === 0)
    return {
      tone: registered ? 'ok' : 'unknown',
      text: registered
        ? days === 1
          ? '촬영일 가능'
          : `${days}일 전체 가능`
        : '출연 불가 일정 미등록',
    } as const;
  return {
    tone: 'partial',
    text: `${days}일 중 ${days - blocked.length}일 가능 · ${blocked.map(shortDay).join(', ')} 불가`,
  } as const;
}

const PAGE_SIZE = 20;

const CAREER_OPTIONS: [string, string][] = [
  ['', '전체'],
  ['1', '경력 있음 (1편 이상)'],
  ['3', '3편 이상'],
  ['5', '5편 이상'],
  ['10', '10편 이상'],
];

const AGE_RANGES: [string, number, number][] = [
  ['10대', 10, 19],
  ['20대', 20, 29],
  ['30대', 30, 39],
  ['40대', 40, 49],
  ['50대 이상', 50, 120],
];

const EMPTY = {
  q: '',
  gender: '',
  age: '',
  heightMin: '',
  heightMax: '',
  region: '',
  skill: '',
  tag: '',
  available: '',
  availableTo: '',
  career: '',
  favorites: false,
  sort: 'recent',
};

export default function ActorSearch() {
  const [filters, setFilters] = useState(EMPTY);
  const [actors, setActors] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(false);
  // 넓은 화면의 왼쪽 필터 패널. 기본은 접어 두고 버튼으로 펼친다.
  const [deskFilters, setDeskFilters] = useState(false);
  // 모바일 필터 시트는 휴대폰 뒤로가기로 닫힌다.
  useBackClose(sheet, () => setSheet(false));
  const loadSeq = useRef(0);

  const load = useCallback(async (current: typeof EMPTY, offset = 0, append = false) => {
    // A fresh (non-append) load invalidates any in-flight "더 보기" request.
    const seq = append ? loadSeq.current : ++loadSeq.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    const params = new URLSearchParams();
    const range = AGE_RANGES.find(([label]) => label === current.age);
    if (range) {
      params.set('ageMin', String(range[1]));
      params.set('ageMax', String(range[2]));
    }
    for (const key of [
      'q',
      'gender',
      'heightMin',
      'heightMax',
      'region',
      'skill',
      'tag',
      'available',
      'availableTo',
      'sort',
    ] as const)
      if (current[key]) params.set(key, current[key]);
    if (current.career) params.set('careerMin', current.career);
    if (current.favorites) params.set('favorites', '1');
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));
    try {
      const response = await fetch(`/api/actors?${params}`, { cache: 'no-store' });
      if (response.status === 401) {
        location.href = '/login?next=/studio/actors';
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '배우를 불러오지 못했습니다.');
      if (seq !== loadSeq.current) return; // stale page — a newer search already ran
      const page: Result[] = data.results || [];
      setTotal(typeof data.total === 'number' ? data.total : page.length);
      setHasMore(Boolean(data.hasMore));
      setActors((prev) => (append ? [...prev, ...page] : page));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '배우를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(filters), filters.q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  async function toggleFavorite(actor: Result) {
    const favorite = !actor.favorite;
    setActors((current) =>
      current.map((item) => (item.userId === actor.userId ? { ...item, favorite } : item)),
    );
    await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: actor.userId, favorite }),
    });
  }

  const activeCount = (
    ['gender', 'age', 'heightMin', 'heightMax', 'region', 'skill', 'available', 'career'] as const
  ).filter((key) => filters[key]).length;

  // 빠른 필터 줄은 자주 쓰는 키워드만 둔다. 필터 패널에서 고른 키워드는 여기에 붙여 보여 준다.
  const quickTags =
    filters.tag && !QUICK_IMAGE_TAGS.includes(filters.tag)
      ? [...QUICK_IMAGE_TAGS, filters.tag]
      : QUICK_IMAGE_TAGS;

  const filterPanel = (
    <div className="filter-panel">
      <div className="fp-head">
        <strong>필터</strong>
        <button className="text-button" onClick={() => setFilters({ ...EMPTY, q: filters.q })}>
          초기화
        </button>
      </div>
      <fieldset>
        <legend>성별</legend>
        {[
          ['', '전체'],
          ['female', '여성'],
          ['male', '남성'],
        ].map(([value, label]) => (
          <label key={value} className="radio">
            <input
              type="radio"
              name="gender"
              checked={filters.gender === value}
              onChange={() => set('gender', value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>연령대</legend>
        <label className="radio">
          <input type="radio" name="age" checked={!filters.age} onChange={() => set('age', '')} />
          전체
        </label>
        {AGE_RANGES.map(([label]) => (
          <label key={label} className="radio">
            <input
              type="radio"
              name="age"
              checked={filters.age === label}
              onChange={() => set('age', label)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>키 (cm)</legend>
        <div className="range-row">
          <input
            type="number"
            inputMode="numeric"
            placeholder="145"
            value={filters.heightMin}
            onChange={(event) => set('heightMin', event.target.value)}
          />
          <span>~</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="190"
            value={filters.heightMax}
            onChange={(event) => set('heightMax', event.target.value)}
          />
        </div>
      </fieldset>
      <fieldset>
        <legend>지역</legend>
        <select value={filters.region} onChange={(event) => set('region', event.target.value)}>
          <option value="">전체</option>
          {REGIONS.map((region) => (
            <option key={region}>{region}</option>
          ))}
        </select>
      </fieldset>
      <fieldset>
        <legend>특기</legend>
        <select value={filters.skill} onChange={(event) => set('skill', event.target.value)}>
          <option value="">전체</option>
          {SKILL_GROUPS.map((group) => (
            <optgroup key={group.title} label={group.title}>
              {group.items.map((skill) => (
                <option key={skill}>{skill}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </fieldset>
      <fieldset>
        <legend>이미지 키워드</legend>
        <select value={filters.tag} onChange={(event) => set('tag', event.target.value)}>
          <option value="">전체</option>
          {IMAGE_TAG_GROUPS.map((group) => (
            <optgroup key={group.title} label={group.title}>
              {group.items.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <small>위쪽 빠른 필터에는 자주 쓰는 키워드만 나와 있어요.</small>
      </fieldset>
      <fieldset>
        <legend>출연 경력</legend>
        <select value={filters.career} onChange={(event) => set('career', event.target.value)}>
          {CAREER_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <small>필모그래피에 등록된 작품 수 기준입니다.</small>
      </fieldset>
      <fieldset>
        <legend>출연 가능 일정</legend>
        <div className="range-row">
          <input
            aria-label="촬영 시작일"
            type="date"
            value={filters.available}
            onChange={(event) => set('available', event.target.value)}
          />
          <span>~</span>
          <input
            aria-label="촬영 종료일"
            type="date"
            min={filters.available || undefined}
            disabled={!filters.available}
            value={filters.availableTo}
            onChange={(event) => set('availableTo', event.target.value)}
          />
        </div>
        <small>
          종료일을 비우면 시작일 하루만 봅니다. 기간을 넣으면 하루도 안 되는 배우만 빼고, 나머지는
          &lsquo;전체 가능 / 일부 가능&rsquo;으로 나눠 보여 줍니다. 최대 {MAX_RANGE_DAYS}일.
        </small>
      </fieldset>
    </div>
  );

  return (
    <main className="app-shell wide">
      <ProducerNav active="actors" />
      <div className="screen-pad page-top">
        <div className="title-row">
          <div>
            <p className="greet-sub">조건에 맞는 배우를 찾아보세요</p>
            <h1 className="page-title">배우 검색</h1>
          </div>
          <span className="count-pill">{loading ? '…' : `${total}명의 배우`}</span>
        </div>
        <FindSwitch active="search" />
        <RecentStrip storageKey={RECENT_ACTORS} title="최근 본 배우" unit="명" />
        <div className="search-row">
          <div className="search-box">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-3.8-3.8" strokeLinecap="round" />
            </svg>
            <input
              aria-label="배우 검색"
              placeholder="이름, 특기, 소개 검색"
              value={filters.q}
              onChange={(event) => set('q', event.target.value)}
            />
          </div>
          <button className="filter-btn mobile-only" onClick={() => setSheet(true)}>
            필터{activeCount > 0 && <b>{activeCount}</b>}
          </button>
          <button
            className={`filter-btn desk-only${deskFilters ? ' on' : ''}`}
            aria-expanded={deskFilters}
            onClick={() => setDeskFilters((open) => !open)}
          >
            {deskFilters ? '필터 접기' : '필터 펼치기'}
            {activeCount > 0 && <b>{activeCount}</b>}
          </button>
          <select
            className="sort-select"
            aria-label="정렬"
            value={filters.sort}
            onChange={(event) => set('sort', event.target.value)}
          >
            <option value="recent">최근 업데이트순</option>
            <option value="name">이름순</option>
            <option value="age">나이 어린순</option>
          </select>
        </div>
        <div className="filter-row" role="group" aria-label="이미지 카테고리">
          <button
            className={!filters.tag && !filters.favorites ? 'filter active' : 'filter'}
            onClick={() => setFilters((c) => ({ ...c, tag: '', favorites: false }))}
          >
            전체
          </button>
          <button
            className={filters.favorites ? 'filter active' : 'filter'}
            onClick={() => set('favorites', !filters.favorites)}
          >
            ♥ 관심 배우
          </button>
          {quickTags.map((tag) => (
            <button
              key={tag}
              className={filters.tag === tag ? 'filter active' : 'filter'}
              onClick={() => set('tag', filters.tag === tag ? '' : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className={`search-layout${deskFilters ? '' : ' filters-closed'}`}>
          {deskFilters && <aside className="desk-only">{filterPanel}</aside>}
          <section>
            {error && <p className="form-error">{error}</p>}
            {!loading && actors.length === 0 ? (
              <div className="empty-card">
                조건에 맞는 배우가 없습니다.
                <br />
                필터를 조금 넓혀 보세요.
              </div>
            ) : (
              <>
                <div className="actor-grid">
                  {actors.map((actor) => (
                    <div key={actor.userId} className="actor-tile">
                      <Link href={`/actors/${actor.userId}`} className="tile-photo">
                        {actor.photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={actor.photos[0]}
                            alt={`${actor.name} 프로필 사진`}
                            loading="lazy"
                          />
                        ) : (
                          <span>{actor.name.slice(-2)}</span>
                        )}
                      </Link>
                      <button
                        className={`heart${actor.favorite ? ' on' : ''}`}
                        aria-label={actor.favorite ? '관심 해제' : '관심 저장'}
                        onClick={() => void toggleFavorite(actor)}
                      >
                        {actor.favorite ? '♥' : '♡'}
                      </button>
                      <Link href={`/actors/${actor.userId}`} className="tile-info">
                        <strong>{actor.name}</strong>
                        <span>
                          {[
                            ageOf(actor.birthYear) !== null ? `${ageOf(actor.birthYear)}세` : '',
                            actor.height ? `${actor.height}cm` : '',
                            actor.region,
                          ]
                            .filter(Boolean)
                            .join(' · ') || genderLabel[actor.gender]}
                        </span>
                        {actor.agency && <span className="muted">{actor.agency}</span>}
                        {(() => {
                          const note = availabilityNote(actor.availability);
                          return note ? (
                            <span className={`avail-note avail-${note.tone}`}>{note.text}</span>
                          ) : null;
                        })()}
                        <div className="tag-row">
                          {actor.tags.slice(0, 2).map((tag) => (
                            <i key={tag}>{tag}</i>
                          ))}
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
                {hasMore && (
                  <button
                    className="button button-soft full"
                    disabled={loadingMore}
                    onClick={() => void load(filters, actors.length, true)}
                  >
                    {loadingMore ? '불러오는 중…' : `더 보기 (${actors.length}/${total})`}
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <section className="detail-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            {filterPanel}
            <button className="button button-primary full" onClick={() => setSheet(false)}>
              {total}명 보기
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
