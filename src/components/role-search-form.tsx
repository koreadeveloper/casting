'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { FORMATS, GENRE_TAGS, PROJECT_REGIONS, ROLE_TYPES } from '@/lib/project-meta';
import {
  AGE_BANDS,
  EMPTY_FILTERS,
  activeFilterCount,
  filtersToQuery,
  type RoleFilters,
} from '@/lib/role-search';

type Props = {
  /** 주소의 검색 조건(서버가 해석한 값) */
  initial: RoleFilters;
  /** 로그인한 배우의 출연 불가일 수. null이면 로그인 전이라 '출연 불가일 피하기'를 숨긴다. */
  unavailableCount: number | null;
};

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/**
 * 모집 중인 배역 검색·필터. 조건을 주소(?q=…&format=…)에 담아 서버가 걸러 보여 준다.
 * 그래서 공고를 보고 뒤로 돌아오거나 주소를 공유해도 같은 조건이 남는다.
 */
export default function RoleSearchForm({ initial, unavailableCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const applied = useRef(filtersToQuery(initial));

  function apply(next: RoleFilters) {
    const query = filtersToQuery(next);
    if (query === applied.current) return;
    applied.current = query;
    startTransition(() => {
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    });
  }

  function change(patch: Partial<RoleFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    apply(next);
  }

  // 키워드는 입력을 잠깐 멈추면 찾는다(글자마다 서버에 묻지 않게).
  useEffect(() => {
    const timer = setTimeout(() => apply(filters), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  const count = activeFilterCount(filters);
  const chips = (key: 'formats' | 'genres' | 'roleTypes' | 'ages', options: [string, string][]) => (
    <div className="chip-pick">
      {options.map(([value, label]) => {
        const on = filters[key].includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            className={on ? 'on' : ''}
            onClick={() => change({ [key]: toggle(filters[key], value) })}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <form
      className="role-search"
      role="search"
      aria-label="모집 중인 배역 검색"
      onSubmit={(event) => {
        event.preventDefault();
        apply(filters);
      }}
    >
      <div className="search-row">
        <label className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={filters.q}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            placeholder="작품명·배역명·설명으로 찾기"
            aria-label="키워드"
            enterKeyHint="search"
          />
        </label>
        <button
          type="button"
          className="filter-btn"
          aria-expanded={open}
          aria-controls="role-filter-panel"
          onClick={() => setOpen((value) => !value)}
        >
          필터{count > 0 && <b>{count}</b>}
        </button>
      </div>

      {open && (
        <div className="filter-panel role-filter-panel" id="role-filter-panel">
          <div className="fp-head">
            <strong>필터</strong>
            <button
              type="button"
              className="text-button"
              onClick={() => change({ ...EMPTY_FILTERS, q: filters.q })}
            >
              초기화
            </button>
          </div>
          <fieldset>
            <legend>형식</legend>
            {chips(
              'formats',
              FORMATS.map((value) => [value, value]),
            )}
          </fieldset>
          <fieldset>
            <legend>
              장르 <small>하나라도 맞으면 보여요</small>
            </legend>
            {chips(
              'genres',
              GENRE_TAGS.map((value) => [value, value]),
            )}
          </fieldset>
          <fieldset>
            <legend>비중</legend>
            {chips('roleTypes', Object.entries(ROLE_TYPES))}
          </fieldset>
          <fieldset>
            <legend>
              성별 <small>성별 무관 배역은 항상 보여요</small>
            </legend>
            <div className="chip-pick">
              {(
                [
                  ['', '전체'],
                  ['female', '여성'],
                  ['male', '남성'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filters.gender === value}
                  className={filters.gender === value ? 'on' : ''}
                  onClick={() => change({ gender: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>
              연령대 <small>연령 제한 없는 배역은 항상 보여요</small>
            </legend>
            {chips(
              'ages',
              Object.entries(AGE_BANDS).map(([value, band]) => [value, band.label]),
            )}
          </fieldset>
          <fieldset>
            <legend>촬영 지역</legend>
            <select
              value={filters.region}
              onChange={(event) => change({ region: event.target.value })}
              aria-label="촬영 지역"
            >
              <option value="">전체</option>
              {PROJECT_REGIONS.map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </fieldset>
          {unavailableCount !== null && (
            <fieldset>
              <legend>촬영일</legend>
              {unavailableCount > 0 ? (
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={filters.free}
                    onChange={(event) => change({ free: event.target.checked })}
                  />
                  내 출연 불가일({unavailableCount}일)과 겹치는 배역 빼기
                </label>
              ) : (
                <p className="wiz-note">
                  <Link href="/me/profile">프로필에 출연 불가일을 등록</Link>하면 촬영일이 겹치는
                  배역을 뺄 수 있어요.
                </p>
              )}
            </fieldset>
          )}
        </div>
      )}
      {pending && (
        <p className="wiz-note" role="status">
          찾는 중…
        </p>
      )}
    </form>
  );
}
