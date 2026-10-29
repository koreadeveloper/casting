import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  filtersToQuery,
  hasRoleFilters,
  matchesRoleFilters,
  parseRoleFilters,
  sortRoleListings,
} from '../src/lib/role-search.ts';
import { FORMATS, GENRE_TAGS, PROJECT_REGIONS, ROLE_TYPES } from '../src/lib/project-meta.ts';

const options = {
  formats: FORMATS,
  genres: GENRE_TAGS,
  regions: PROJECT_REGIONS,
  roleTypes: Object.keys(ROLE_TYPES),
};

const listing = {
  projectTitle: '단편영화 〈봄날〉',
  title: '민수 역',
  description: '오랜 친구와 다시 만나는 20대 남성',
  requirement: '서울 이동 가능',
  roleType: 'lead',
  gender: 'male',
  ageMin: 20,
  ageMax: 29,
  shootDates: ['2026-11-16', '2026-11-17'],
  projectFormat: '단편영화',
  projectGenres: ['드라마', '청춘'],
  projectRegion: '서울',
};

const filters = (patch) => ({ ...EMPTY_FILTERS, ...patch });

test('검색 조건 해석: 모르는 값은 버리고 여러 개 고른 값은 모두 받는다', () => {
  const parsed = parseRoleFilters(
    {
      q: '  봄날 ',
      format: ['단편영화', '없는형식', '단편영화'],
      genre: '드라마',
      region: '화성',
      type: ['lead', 'boss'],
      gender: 'other',
      age: ['20', '99'],
      free: '1',
    },
    options,
  );
  assert.deepEqual(parsed, {
    q: '봄날',
    formats: ['단편영화'],
    genres: ['드라마'],
    region: '',
    roleTypes: ['lead'],
    gender: '',
    ages: ['20'],
    free: true,
    sort: 'newest',
  });
  assert.deepEqual(parseRoleFilters({}, options), EMPTY_FILTERS);
});

test('검색 조건은 주소로 바꿔도 같은 값으로 돌아온다', () => {
  const original = filters({ q: '봄날', formats: ['웹드라마'], ages: ['20', '30'], free: true });
  const query = filtersToQuery(original);
  const params = {};
  for (const [key, value] of new URLSearchParams(query)) {
    params[key] = params[key] ? [].concat(params[key], value) : value;
  }
  assert.deepEqual(parseRoleFilters(params, options), original);
  assert.equal(filtersToQuery(EMPTY_FILTERS), '');
  assert.equal(activeFilterCount(original), 4);
  assert.equal(hasRoleFilters(EMPTY_FILTERS), false);
  assert.equal(hasRoleFilters(filters({ q: '민수' })), true);
});

test('키워드: 작품명·배역명·설명에서 대소문자 없이, 낱말마다 모두 찾는다', () => {
  assert.equal(matchesRoleFilters(listing, filters({ q: '봄날' })), true);
  assert.equal(matchesRoleFilters(listing, filters({ q: '민수 친구' })), true);
  assert.equal(matchesRoleFilters(listing, filters({ q: '서울 이동' })), true);
  assert.equal(matchesRoleFilters(listing, filters({ q: '민수 스릴러' })), false);
  assert.equal(matchesRoleFilters({ ...listing, title: 'Ella' }, filters({ q: 'ELLA' })), true);
});

test('형식·장르·지역·비중', () => {
  assert.equal(matchesRoleFilters(listing, filters({ formats: ['단편영화', '광고'] })), true);
  assert.equal(matchesRoleFilters(listing, filters({ formats: ['웹드라마'] })), false);
  // 장르는 하나라도 겹치면 맞다
  assert.equal(matchesRoleFilters(listing, filters({ genres: ['청춘', '공포'] })), true);
  assert.equal(matchesRoleFilters(listing, filters({ genres: ['공포'] })), false);
  assert.equal(matchesRoleFilters(listing, filters({ region: '서울' })), true);
  assert.equal(matchesRoleFilters(listing, filters({ region: '부산' })), false);
  assert.equal(matchesRoleFilters(listing, filters({ roleTypes: ['lead', 'minor'] })), true);
  assert.equal(matchesRoleFilters(listing, filters({ roleTypes: ['extra'] })), false);
});

test('성별: 고른 성별과 함께 성별 무관·미지정 배역도 보인다', () => {
  assert.equal(matchesRoleFilters(listing, filters({ gender: 'male' })), true);
  assert.equal(matchesRoleFilters(listing, filters({ gender: 'female' })), false);
  assert.equal(
    matchesRoleFilters({ ...listing, gender: 'any' }, filters({ gender: 'female' })),
    true,
  );
  assert.equal(matchesRoleFilters({ ...listing, gender: '' }, filters({ gender: 'female' })), true);
});

test('연령대: 배역 연령 범위와 겹치면 맞고, 제한 없는 배역은 항상 맞다', () => {
  assert.equal(matchesRoleFilters(listing, filters({ ages: ['20'] })), true);
  assert.equal(matchesRoleFilters(listing, filters({ ages: ['30', '40'] })), false);
  // 25~34세 배역은 20대·30대 모두에 걸친다
  const span = { ...listing, ageMin: 25, ageMax: 34 };
  assert.equal(matchesRoleFilters(span, filters({ ages: ['30'] })), true);
  // '30세 이상'(최대 없음)
  const open = { ...listing, ageMin: 30, ageMax: 0 };
  assert.equal(matchesRoleFilters(open, filters({ ages: ['50'] })), true);
  assert.equal(matchesRoleFilters(open, filters({ ages: ['20'] })), false);
  const any = { ...listing, ageMin: 0, ageMax: 0 };
  assert.equal(matchesRoleFilters(any, filters({ ages: ['10'] })), true);
});

test('출연 불가일 피하기: 촬영일이 하루라도 겹치면 뺀다', () => {
  const free = filters({ free: true });
  assert.equal(matchesRoleFilters(listing, free, ['2026-11-17']), false);
  assert.equal(matchesRoleFilters(listing, free, ['2026-11-20']), true);
  // 출연 불가일이 없으면 걸러 낼 것이 없다
  assert.equal(matchesRoleFilters(listing, free, []), true);
  // 토글을 끄면 겹쳐도 보인다
  assert.equal(matchesRoleFilters(listing, EMPTY_FILTERS, ['2026-11-17']), true);
});

test('정렬: 기본은 최신 등록순이고 주소에 남기지 않는다', () => {
  const filters = parseRoleFilters({}, options);
  assert.equal(filters.sort, 'newest');
  assert.equal(filtersToQuery(filters), '');
  assert.equal(parseRoleFilters({ sort: 'weird' }, options).sort, 'newest');
  const sorted = parseRoleFilters({ sort: 'deadline' }, options);
  assert.equal(sorted.sort, 'deadline');
  assert.equal(filtersToQuery(sorted), 'sort=deadline');
  // 정렬은 필터가 아니라서 '검색 중'으로 치지 않는다
  assert.equal(activeFilterCount(sorted), 0);
  assert.equal(hasRoleFilters(sorted), false);
});

test('정렬: 마감 임박순·촬영일 빠른순, 같으면 최신 등록순, 날짜 없으면 맨 뒤', () => {
  const roles = [
    { id: 'a', createdAt: '2026-10-01', deadline: '2026-11-20', shootDates: ['2026-12-05'] },
    { id: 'b', createdAt: '2026-10-03', deadline: '2026-11-10', shootDates: [] },
    {
      id: 'c',
      createdAt: '2026-10-02',
      deadline: '2026-11-10',
      shootDates: ['2026-12-09', '2026-11-30'],
    },
    { id: 'd', createdAt: '2026-10-04', deadline: '', shootDates: [], shootDate: '2026-12-01' },
  ];
  const ids = (sort) =>
    sortRoleListings(roles, sort)
      .map((role) => role.id)
      .join('');
  assert.equal(ids('newest'), 'dbca');
  assert.equal(ids('deadline'), 'bcad');
  assert.equal(ids('shoot'), 'cdab');
  assert.equal(roles[0].id, 'a', '원래 배열은 그대로 둔다');
});
