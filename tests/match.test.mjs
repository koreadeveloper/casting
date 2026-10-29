import test from 'node:test';
import assert from 'node:assert/strict';
import { matchNotice, matchRoleForActor } from '../src/lib/match.ts';

const profile = {
  gender: 'female',
  birthYear: 2001,
  region: '서울',
  intro: '웹드라마 조연 경험',
  tags: ['청순한', '사랑스러운'],
  skills: ['노래', '댄스'],
  unavailableDates: ['2099-01-01'],
};

const role = {
  title: '여주인공',
  description: '청순한 이미지의 20대 여성 배우를 찾습니다.',
  requirement: '노래 가능자 우대',
  location: '서울 마포',
  shootDate: '2099-02-01',
};

test('여러 조건이 맞으면 높은 점수와 이유를 돌려준다', () => {
  const { score, reasons } = matchRoleForActor(profile, role, 2026);
  assert.ok(score >= 55, `expected >=55 got ${score}`);
  assert.ok(reasons.some((item) => item.includes('성별')));
  assert.ok(reasons.some((item) => item.includes('지역')));
  assert.ok(reasons.some((item) => item.includes('청순한')));
  assert.ok(reasons.some((item) => item.includes('노래')));
});

test('조건이 하나도 안 맞으면 낮은 점수', () => {
  const other = {
    ...profile,
    gender: 'male',
    birthYear: 1980,
    region: '부산',
    tags: [],
    skills: [],
  };
  const { score } = matchRoleForActor(other, role, 2026);
  assert.ok(score <= 10, `expected low score got ${score}`);
});

test('촬영일이 출연 불가일과 겹치면 감점', () => {
  const busy = { ...profile, unavailableDates: ['2099-02-01'] };
  const free = matchRoleForActor(profile, role, 2026);
  const taken = matchRoleForActor(busy, role, 2026);
  assert.ok(taken.score < free.score);
  assert.ok(taken.reasons.some((item) => item.includes('겹침')));
});

test('여러 날 촬영하는 배역은 하루라도 불가일이면 감점하고 겹친 날 수를 알려 준다', () => {
  const busy = { ...profile, unavailableDates: ['2099-02-03'] };
  const multi = { ...role, shootDates: ['2099-02-01', '2099-02-02', '2099-02-03'] };
  const free = matchRoleForActor(profile, multi, 2026);
  const taken = matchRoleForActor(busy, multi, 2026);
  assert.ok(taken.score < free.score);
  assert.ok(taken.reasons.includes('촬영일과 출연 불가일 겹침 (1일)'));
});

test('배역에 적은 성별 칸이 설명 글보다 우선한다', () => {
  // 설명 글은 '여성'인데 성별 칸은 남성
  const maleRole = { ...role, gender: 'male' };
  const asWritten = matchRoleForActor(profile, role, 2026);
  const structured = matchRoleForActor(profile, maleRole, 2026);
  assert.ok(structured.score < asWritten.score);
  assert.ok(!structured.reasons.includes('성별 조건 부합'));
  // '성별 무관'이면 설명 글에서도 성별을 추측하지 않는다
  const anyRole = { ...role, gender: 'any' };
  const any = matchRoleForActor({ ...profile, gender: 'male' }, anyRole, 2026);
  const guessed = matchRoleForActor({ ...profile, gender: 'male' }, role, 2026);
  assert.ok(any.score > guessed.score);
});

test('배역에 적은 연령대가 설명 글의 "20대"보다 우선한다', () => {
  // 2001년생은 2026년 기준 26세(한국 나이)
  const fits = matchRoleForActor(profile, { ...role, ageMin: 25, ageMax: 30 }, 2026);
  const misses = matchRoleForActor(profile, { ...role, ageMin: 35, ageMax: 45 }, 2026);
  assert.ok(fits.reasons.includes('연령 조건 부합'));
  assert.ok(misses.score < fits.score);
  assert.ok(!misses.reasons.some((item) => item.includes('20대')));
});

test('맞춤 공고 알림은 점수 대신 이름과 일치 근거로 말한다', () => {
  const { reasons } = matchRoleForActor(profile, role, 2026);
  const text = matchNotice('김하늘', profile, role, reasons, 2026);
  assert.equal(text, '김하늘배우님께 맞는 20대 여성 배역 공고가 올라왔어요');
  assert.ok(!text.includes('%'));
});

test('성별·연령 조건이 없으면 지역·촬영 가능일로 말한다', () => {
  const plain = { ...role, title: '행인', description: '짧은 장면', requirement: '' };
  const { reasons } = matchRoleForActor(profile, plain, 2026);
  assert.equal(
    matchNotice('김하늘', profile, plain, reasons, 2026),
    '김하늘배우님, 서울·촬영 가능일이 맞는 새 공고가 있어요',
  );
  const busy = { ...plain, location: '부산', shootDate: '2099-01-01' };
  assert.equal(
    matchNotice('', profile, busy, matchRoleForActor(profile, busy, 2026).reasons, 2026),
    '배우님께 맞는 새 공고가 올라왔어요',
  );
});
