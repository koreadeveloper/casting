import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultPick,
  fieldText,
  newFilmography,
  parseEdit,
  sameAsCurrent,
} from '../src/lib/draft-merge.ts';

const profile = {
  name: '김배우',
  gender: 'female',
  birthYear: 1999,
  birthDate: '1999-05-17',
  height: null,
  weight: null,
  region: '',
  agency: '',
  intro: '',
  tags: [],
  skills: ['노래'],
  filmography: [{ year: '2024', title: '여름', role: '주연' }],
};

test('비어 있는 칸만 기본으로 고르고, 이미 넣은 값은 덮어쓰지 않는다', () => {
  assert.equal(defaultPick(profile, 'height', 165), true);
  assert.equal(defaultPick(profile, 'region', '서울'), true);
  assert.equal(defaultPick(profile, 'name', '홍길동'), false);
  assert.equal(defaultPick(profile, 'birthYear', 1998), false);
  assert.equal(defaultPick(profile, 'skills', ['댄스']), false);
});

test('지금과 같은 값은 같음으로 보고 고르지 않는다', () => {
  assert.equal(sameAsCurrent(profile, 'name', '김배우'), true);
  assert.equal(sameAsCurrent(profile, 'skills', ['노래']), true);
  assert.equal(defaultPick(profile, 'name', '김배우'), false);
});

test('필모그래피는 이미 있는 작품을 빼고 새 작품만 덧붙인다', () => {
  const draft = [
    { year: '2024', title: '여름', role: '조연' },
    { year: '2025', title: '가을', role: '단역' },
  ];
  assert.deepEqual(newFilmography(profile.filmography, draft), [draft[1]]);
  assert.equal(defaultPick(profile, 'filmography', draft), true);
  assert.equal(defaultPick(profile, 'filmography', [draft[0]]), false);
});

test('고친 값은 서버와 같은 범위로 검사한다', () => {
  assert.equal(parseEdit('height', ' 168 '), 168);
  assert.equal(parseEdit('height', '68'), undefined);
  assert.equal(parseEdit('birthYear', '1899'), undefined);
  assert.equal(parseEdit('gender', 'male'), 'male');
  assert.equal(parseEdit('gender', '남'), undefined);
  assert.equal(parseEdit('region', '부산'), '부산');
  assert.equal(parseEdit('region', '부산광역시'), undefined);
  assert.equal(parseEdit('name', '  '), undefined);
});

test('값을 한 줄 글자로 보여 준다', () => {
  assert.equal(fieldText('height', 165), '165cm');
  assert.equal(fieldText('gender', 'female'), '여성');
  assert.equal(fieldText('region', ''), '');
  assert.equal(fieldText('filmography', profile.filmography), '2024 여름 (주연)');
});
