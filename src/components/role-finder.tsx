'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ProjectCover from '@/components/project-cover';
import { PROJECT_REGIONS, ROLE_GENDERS, ROLE_TYPES, ageRangeLabel } from '@/lib/project-meta';
import { formatDates } from '@/lib/schedule';
import type { Role } from '@/lib/types';

/*
 * 배우의 공고 찾기. 예전에는 모집 중인 배역을 스크롤하며 하나씩 눌러 조건을 확인해야 했다.
 * 검색어 + 성별·나이·지역·비중·형식·장르 필터 + 정렬. 필터는 기본으로 접어 둔다(노트북에서도).
 * 공고 수가 많지 않아 화면에서 바로 거른다(서버 왕복 없음).
 */

type Sort = 'deadline' | 'newest' | 'shoot';

function shortDate(date: string) {
  return date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '';
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function firstShootDay(role: Role) {
  return [...(role.shootDates.length ? role.shootDates : [role.shootDate])].sort()[0] ?? '';
}

/** 배역이 이 나이를 받는지. 연령 제한이 없는 배역은 받는다. */
function acceptsAge(role: Role, age: number) {
  return (!role.ageMin || age >= role.ageMin) && (!role.ageMax || age <= role.ageMax);
}

/** 성별 조건: 고른 성별 배역 + 성별 무관·미지정 배역 */
function acceptsGender(role: Role, gender: string) {
  return role.gender === gender || role.gender === 'any' || role.gender === '';
}

export default function RoleFinder({
  roles,
  appliedRoleIds = [],
  me,
}: {
  roles: Role[];
  appliedRoleIds?: string[];
  /** 로그인한 배우의 프로필 조건. 있으면 '내 조건에 맞는 공고' 버튼을 보인다. */
  me?: { gender: string; age: number | null };
}) {
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [region, setRegion] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [hideApplied, setHideApplied] = useState(false);
  const [sort, setSort] = useState<Sort>('deadline');
  const [open, setOpen] = useState(false);
  const applied = useMemo(() => new Set(appliedRoleIds), [appliedRoleIds]);

  // 선택지는 지금 공고에 실제로 있는 값만 보인다(누르면 0건이 되는 버튼을 만들지 않는다).
  const options = useMemo(() => {
    const regionSet = new Set(
      roles.map((role) => role.location.trim().split(/\s+/)[0]).filter(Boolean),
    );
    return {
      regions: PROJECT_REGIONS.filter((item) => regionSet.has(item)),
      formats: [...new Set(roles.map((role) => role.projectFormat || '').filter(Boolean))],
      genres: [...new Set(roles.flatMap((role) => role.projectGenres ?? []))],
      types: Object.keys(ROLE_TYPES).filter((key) => roles.some((role) => role.roleType === key)),
    };
  }, [roles]);

  const myGender = me?.gender === 'male' || me?.gender === 'female' ? me.gender : '';
  const myAge = me?.age ?? null;
  const usingMine =
    Boolean(myGender || myAge) && gender === myGender && age === (myAge ? String(myAge) : '');

  const ageNumber = Number(age);
  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = roles.filter((role) => {
      if (
        text &&
        !`${role.projectTitle} ${role.title} ${role.description} ${role.requirement} ${role.location}`
          .toLowerCase()
          .includes(text)
      )
        return false;
      if (gender && !acceptsGender(role, gender)) return false;
      if (ageNumber > 0 && !acceptsAge(role, ageNumber)) return false;
      if (region && !role.location.startsWith(region)) return false;
      if (types.length && !types.includes(role.roleType)) return false;
      if (formats.length && !formats.includes(role.projectFormat || '')) return false;
      if (genres.length && !(role.projectGenres ?? []).some((item) => genres.includes(item)))
        return false;
      if (hideApplied && applied.has(role.id)) return false;
      return true;
    });
    return list.sort((a, b) =>
      sort === 'newest'
        ? b.createdAt.localeCompare(a.createdAt)
        : sort === 'shoot'
          ? firstShootDay(a).localeCompare(firstShootDay(b))
          : a.deadline.localeCompare(b.deadline),
    );
  }, [roles, query, gender, ageNumber, region, types, formats, genres, hideApplied, applied, sort]);

  const activeCount =
    (gender ? 1 : 0) +
    (ageNumber > 0 ? 1 : 0) +
    (region ? 1 : 0) +
    types.length +
    formats.length +
    genres.length +
    (hideApplied ? 1 : 0);

  function reset() {
    setQuery('');
    setGender('');
    setAge('');
    setRegion('');
    setTypes([]);
    setFormats([]);
    setGenres([]);
    setHideApplied(false);
  }

  function applyMine() {
    if (usingMine) {
      setGender('');
      setAge('');
    } else {
      setGender(myGender);
      setAge(myAge ? String(myAge) : '');
    }
  }

  return (
    <section className="role-finder" id="open-roles" aria-label="모집 중인 배역 찾기">
      <div className="section-head">
        <h2>모집 중인 배역</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          {results.length === roles.length
            ? `${roles.length}개`
            : `${roles.length}개 중 ${results.length}개`}
        </span>
      </div>

      <div className="finder-bar">
        <label className="search-box finder-search">
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
            aria-label="공고 검색"
            placeholder="작품명·배역·설명·지역 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={`finder-toggle${open ? ' on' : ''}`}
          aria-expanded={open}
          aria-controls="finder-panel"
          onClick={() => setOpen((value) => !value)}
        >
          필터{activeCount > 0 && <b>{activeCount}</b>}
          <span aria-hidden>{open ? '▴' : '▾'}</span>
        </button>
      </div>

      <div className="finder-quick">
        {(myGender || myAge) && (
          <button type="button" className={usingMine ? 'on' : ''} onClick={applyMine}>
            {usingMine ? '✓ ' : ''}내 조건에 맞는 공고 (
            {[myGender && ROLE_GENDERS[myGender], myAge && `${myAge}세`].filter(Boolean).join('·')})
          </button>
        )}
        <select
          aria-label="정렬"
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
        >
          <option value="deadline">마감 임박순</option>
          <option value="newest">최신 등록순</option>
          <option value="shoot">촬영일 빠른순</option>
        </select>
        {(activeCount > 0 || query) && (
          <button type="button" className="finder-reset" onClick={reset}>
            초기화
          </button>
        )}
      </div>

      {open && (
        <div className="finder-panel" id="finder-panel">
          <div className="finder-row">
            <span className="finder-label">성별</span>
            <div className="chip-pick">
              {(
                [
                  ['', '전체'],
                  ['female', '여성'],
                  ['male', '남성'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value || 'all'}
                  type="button"
                  className={gender === value ? 'on' : ''}
                  onClick={() => setGender(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {gender && <small>성별 무관 배역도 함께 보여요.</small>}
          </div>
          <div className="finder-row">
            <span className="finder-label">나이</span>
            <div className="finder-age">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                placeholder="예: 24"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                aria-label="내 나이"
              />
              <span>세가 지원할 수 있는 배역</span>
            </div>
          </div>
          {options.regions.length > 0 && (
            <div className="finder-row">
              <span className="finder-label">촬영 지역</span>
              <div className="chip-pick">
                {['', ...options.regions].map((value) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    className={region === value ? 'on' : ''}
                    onClick={() => setRegion(value)}
                  >
                    {value || '전체'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {options.types.length > 0 && (
            <div className="finder-row">
              <span className="finder-label">비중</span>
              <div className="chip-pick">
                {options.types.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={types.includes(value) ? 'on' : ''}
                    onClick={() => setTypes((list) => toggle(list, value))}
                  >
                    {ROLE_TYPES[value]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {options.formats.length > 0 && (
            <div className="finder-row">
              <span className="finder-label">형식</span>
              <div className="chip-pick">
                {options.formats.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={formats.includes(value) ? 'on' : ''}
                    onClick={() => setFormats((list) => toggle(list, value))}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}
          {options.genres.length > 0 && (
            <div className="finder-row">
              <span className="finder-label">장르</span>
              <div className="chip-pick">
                {options.genres.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={genres.includes(value) ? 'on' : ''}
                    onClick={() => setGenres((list) => toggle(list, value))}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}
          {applied.size > 0 && (
            <label className="finder-check">
              <input
                type="checkbox"
                checked={hideApplied}
                onChange={(event) => setHideApplied(event.target.checked)}
              />
              이미 지원한 공고 숨기기
            </label>
          )}
          <button type="button" className="text-button" onClick={() => setOpen(false)}>
            필터 닫기
          </button>
        </div>
      )}

      {roles.length === 0 ? (
        <div className="empty-card">지금 모집 중인 배역이 없습니다.</div>
      ) : results.length === 0 ? (
        <div className="empty-card">
          조건에 맞는 공고가 없어요.
          <br />
          <button type="button" className="text-button" onClick={reset}>
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="role-grid">
          {results.map((role) => {
            // 성별·연령대·비중을 카드에서 바로 보이게 한다(설명을 열어 보지 않아도 되게).
            const tags = [
              ROLE_TYPES[role.roleType],
              ROLE_GENDERS[role.gender],
              ageRangeLabel(role.ageMin, role.ageMax),
              role.projectFormat,
            ].filter(Boolean);
            return (
              <Link key={role.id} href={`/apply/${role.slug}`} className="pcard role-link">
                <div className="pcard-top">
                  <div className="pcard-img" style={{ width: 96, height: 104 }}>
                    <ProjectCover title={role.projectTitle} posterUrl={role.posterUrl} />
                  </div>
                  <div className="pcard-info">
                    <span className="badge-soft">
                      {applied.has(role.id) ? '지원함' : `${shortDate(role.deadline)} 마감`}
                    </span>
                    <h3>{role.projectTitle}</h3>
                    <p className="sub">{role.title}</p>
                    {tags.length > 0 && (
                      <div className="role-tags">
                        {tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                    <p className="meta">
                      촬영 {formatDates(role.shootDates, 1) || shortDate(role.shootDate)} ·{' '}
                      {role.location}
                      <br />
                      {role.pay}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
