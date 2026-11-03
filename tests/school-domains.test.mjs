import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHOOLS,
  emailDomain,
  findSchoolByDomain,
  sameSchoolName,
  schoolDomainRows,
} from '../src/lib/school-domains.ts';

const rows = schoolDomainRows();

test('이메일에서 도메인을 꺼낸다', () => {
  assert.equal(emailDomain('Me@Karts.ac.kr'), 'karts.ac.kr');
  assert.equal(emailDomain('me@mail.hanyang.ac.kr'), 'mail.hanyang.ac.kr');
  assert.equal(emailDomain('not-an-email'), null);
  assert.equal(emailDomain('a b@karts.ac.kr'), null);
});

test('목록의 학교 도메인과 하위 도메인은 그 학교로 찾는다', () => {
  assert.equal(findSchoolByDomain('karts.ac.kr', rows)?.schoolName, '한국예술종합학교');
  assert.equal(findSchoolByDomain('mail.hanyang.ac.kr', rows)?.schoolName, '한양대학교');
  assert.equal(findSchoolByDomain('dongguk.edu', rows)?.schoolName, '동국대학교');
  assert.equal(findSchoolByDomain('dgu.ac.kr', rows)?.schoolName, '동국대학교');
});

test('목록에 없거나 비슷하게 꾸민 도메인은 찾지 못한다', () => {
  assert.equal(findSchoolByDomain('gmail.com', rows), null);
  assert.equal(findSchoolByDomain('karts.ac.kr.evil.com', rows), null);
  assert.equal(findSchoolByDomain('evilkarts.ac.kr', rows), null);
  assert.equal(findSchoolByDomain('ac.kr', rows), null);
});

test('학교 이름은 정식 이름·줄임말·띄어쓰기 차이를 같게 본다', () => {
  const karts = findSchoolByDomain('karts.ac.kr', rows);
  assert.ok(karts);
  assert.equal(sameSchoolName('한국예술종합학교', karts), true);
  assert.equal(sameSchoolName('한예종', karts), true);
  assert.equal(sameSchoolName(' 한국 예술 종합 학교 ', karts), true);
  assert.equal(sameSchoolName('서울대학교', karts), false);
  assert.equal(sameSchoolName('', karts), false);

  const snu = findSchoolByDomain('snu.ac.kr', rows);
  assert.ok(snu);
  assert.equal(sameSchoolName('서울대학교', snu), true);
  assert.equal(sameSchoolName('서울대', snu), true);
  assert.equal(sameSchoolName('서울대학교(관악)', snu), true);
  assert.equal(sameSchoolName('서울시립대학교', snu), false);
});

test('목록에 같은 도메인이 두 번 들어 있지 않다', () => {
  const domains = schoolDomainRows(SCHOOLS).map((row) => row.domain);
  assert.equal(new Set(domains).size, domains.length);
});
