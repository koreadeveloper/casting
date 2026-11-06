import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  passwordLoginEnabled,
  passwordProblem,
  verifyPassword,
} from '../src/lib/password.ts';
import { createSessionToken, readSessionToken } from '../src/lib/session-token.ts';
import {
  availabilityIn,
  cleanList,
  dateRange,
  IMAGE_TAGS,
  matchesFilters,
  MAX_RANGE_DAYS,
  profileCompletion,
} from '../src/lib/profile.ts';
import { embedUrl } from '../src/lib/video.ts';
import { safeImageRef } from '../src/lib/validation.ts';

const SECRET = 'x'.repeat(32);

test('비밀번호는 해시로 저장되고 같은 값만 통과한다', () => {
  const stored = hashPassword('casting2026');
  assert.notEqual(stored, 'casting2026');
  assert.equal(verifyPassword('casting2026', stored), true);
  assert.equal(verifyPassword('casting2027', stored), false);
  assert.equal(verifyPassword('casting2026', 'plain'), false);
  assert.notEqual(hashPassword('casting2026'), stored);
});

test('비밀번호 규칙: 8자 이상, 영문과 숫자 포함', () => {
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('onlyletters'));
  assert.equal(passwordProblem('letters123'), '');
});

test('세션 토큰은 서명·역할·만료를 검증한다', () => {
  const session = { userId: '5b0c1c3e-1111-2222-3333-444455556666', role: 'producer' };
  const token = createSessionToken(session, SECRET, 1000);
  assert.deepEqual(readSessionToken(token, SECRET, 2000), session);
  assert.equal(readSessionToken(token, 'y'.repeat(32), 2000), null);
  assert.equal(readSessionToken(token.replace('.producer.', '.actor.'), SECRET, 2000), null);
  assert.equal(readSessionToken(token, SECRET, 1000 + 8 * 24 * 3600 * 1000), null);
  assert.equal(readSessionToken(token, 'short', 2000), null);
});

const base = {
  userId: 'a1',
  name: '김도윤',
  gender: 'male',
  birthYear: 2000,
  height: 181,
  weight: 70,
  region: '서울',
  intro: '단편영화 3편 주연, 담백한 감정 연기를 좋아합니다.',
  tags: ['소년미'],
  skills: ['영어'],
  photos: ['a', 'b', 'c'],
  videoUrl: 'https://youtu.be/abcdefg',
  filmography: [{ year: '2025', title: '봄날', role: '주연' }],
  unavailableDates: ['2026-10-26'],
  isPublic: true,
  updatedAt: '',
};

test('프로필 완성도는 채운 항목 비율로 계산한다', () => {
  assert.equal(profileCompletion(base), 100);
  assert.equal(profileCompletion({ ...base, photos: ['a'], videoUrl: '' }), 83);
  assert.equal(
    profileCompletion({
      ...base,
      gender: '',
      birthYear: null,
      height: null,
      region: '',
      intro: '',
      tags: [],
      skills: [],
      photos: [],
      videoUrl: '',
      filmography: [],
    }),
    8,
  );
});

test('배우 검색 필터: 성별·연령·키·지역·특기·태그·불가일', () => {
  const year = 2026;
  assert.equal(matchesFilters(base, { gender: 'male', ageMin: 20, ageMax: 29 }, year), true);
  assert.equal(matchesFilters(base, { gender: 'female' }, year), false);
  assert.equal(matchesFilters(base, { ageMin: 30 }, year), false);
  assert.equal(matchesFilters(base, { heightMin: 182 }, year), false);
  assert.equal(matchesFilters(base, { region: '부산' }, year), false);
  assert.equal(matchesFilters(base, { skill: '영어', tag: '소년미' }, year), true);
  assert.equal(matchesFilters(base, { available: '2026-10-26' }, year), false);
  assert.equal(matchesFilters(base, { available: '2026-10-27' }, year), true);
  assert.equal(matchesFilters(base, { q: '감정' }, year), true);
  assert.equal(matchesFilters({ ...base, height: null }, { heightMin: 150 }, year), false);
});

test('태그 목록은 허용 값만, 중복 없이, 최대 개수까지', () => {
  assert.deepEqual(cleanList(['청순한', '청순한', '해킹', 3, '시크한'], IMAGE_TAGS, 5), [
    '청순한',
    '시크한',
  ]);
  assert.equal(cleanList(IMAGE_TAGS, IMAGE_TAGS, 5).length, 5);
});

test('영상 링크는 YouTube·Vimeo만 임베드로 바꾼다', () => {
  assert.equal(
    embedUrl('https://www.youtube.com/watch?v=ScMzIvxBSi4'),
    'https://www.youtube-nocookie.com/embed/ScMzIvxBSi4',
  );
  assert.equal(
    embedUrl('https://youtu.be/ScMzIvxBSi4?t=3'),
    'https://www.youtube-nocookie.com/embed/ScMzIvxBSi4',
  );
  assert.equal(embedUrl('https://vimeo.com/123456'), 'https://player.vimeo.com/video/123456');
  assert.equal(embedUrl('https://example.com/video.mp4'), null);
  assert.equal(embedUrl('not a url'), null);
});

test('사진 경로는 업로드 경로나 http(s)만 허용한다', () => {
  assert.equal(
    safeImageRef('/api/uploads/0b9f6c1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg'),
    '/api/uploads/0b9f6c1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg',
  );
  assert.equal(safeImageRef('/api/uploads/../../etc/passwd'), '');
  assert.equal(safeImageRef('javascript:alert(1)'), '');
});

test('기간 날짜 목록은 시작·종료일을 모두 포함하고 최대 일수를 넘지 않는다', () => {
  assert.deepEqual(dateRange('2026-10-24'), ['2026-10-24']);
  assert.deepEqual(dateRange('2026-10-24', '2026-10-26'), [
    '2026-10-24',
    '2026-10-25',
    '2026-10-26',
  ]);
  // 종료일이 시작일보다 앞서면 하루만 본다
  assert.deepEqual(dateRange('2026-10-24', '2026-10-20'), ['2026-10-24']);
  // 달이 바뀌어도 이어진다
  assert.deepEqual(dateRange('2026-10-31', '2026-11-01'), ['2026-10-31', '2026-11-01']);
  assert.equal(dateRange('2026-01-01', '2026-12-31').length, MAX_RANGE_DAYS);
  assert.deepEqual(dateRange('이상한 값'), []);
});

test('기간 중 며칠 가능한지 세고, 일정 등록 여부를 구분한다', () => {
  const range = dateRange('2026-10-25', '2026-10-27');
  const some = availabilityIn(base, range);
  assert.equal(some.days, 3);
  assert.deepEqual(some.blocked, ['2026-10-26']);
  assert.equal(some.registered, true);
  // 일정을 등록하지 않은 배우는 '가능'이 아니라 '미등록'으로 구분된다
  const none = availabilityIn({ unavailableDates: [] }, range);
  assert.deepEqual(none.blocked, []);
  assert.equal(none.registered, false);
});

test('기간 검색은 하루도 안 되는 배우만 제외한다', () => {
  const year = 2026;
  // 하루만 보는 검색은 예전과 똑같이 동작한다
  assert.equal(matchesFilters(base, { available: '2026-10-26' }, year), false);
  assert.equal(matchesFilters(base, { available: '2026-10-27' }, year), true);
  // 3일 중 하루만 불가하면 조율 여지가 있으니 남긴다
  assert.equal(
    matchesFilters(base, { available: '2026-10-25', availableTo: '2026-10-27' }, year),
    true,
  );
  // 기간 전체가 불가한 배우는 제외한다
  const busy = { ...base, unavailableDates: ['2026-10-25', '2026-10-26'] };
  assert.equal(
    matchesFilters(busy, { available: '2026-10-25', availableTo: '2026-10-26' }, year),
    false,
  );
});

test('회원 탈퇴 본인 확인: 비밀번호 계정과 소셜 로그인 계정', async () => {
  const { deletionConfirmed, hasPassword } = await import('../src/lib/password.ts');
  const withPassword = { email: 'a@b.com', passwordHash: hashPassword('letters123') };
  assert.equal(deletionConfirmed({ password: 'letters123' }, withPassword), true);
  assert.equal(deletionConfirmed({ password: 'wrong1234' }, withPassword), false);
  // 비밀번호 계정은 이메일만으로 탈퇴되지 않는다.
  assert.equal(deletionConfirmed({ email: 'a@b.com' }, withPassword), false);

  const social = { email: 'Me@Gmail.com', passwordHash: '' };
  assert.equal(hasPassword(social.passwordHash), false);
  assert.equal(deletionConfirmed({ email: ' me@gmail.com ' }, social), true);
  assert.equal(deletionConfirmed({ email: 'other@gmail.com' }, social), false);
  assert.equal(deletionConfirmed({ email: '' }, social), false);
  // 소셜 계정에 아무 비밀번호나 넣어도 통과하지 않는다.
  assert.equal(deletionConfirmed({ password: 'anything1' }, social), false);
});

test('비밀번호 로그인은 운영에서 막고, 체험 사이트·개발 중에만 연다', () => {
  assert.equal(passwordLoginEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(passwordLoginEnabled({ NODE_ENV: 'production', DEMO_MODE: 'true' }), true);
  assert.equal(passwordLoginEnabled({ NODE_ENV: 'development' }), true);
});
