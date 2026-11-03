import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftFromFacts, draftFromText, draftSize } from '../src/lib/profile-draft.ts';

const RESUME = `
배우 프로필
이름: 김도윤
성별: 남
생년월일: 1999-04-12
키: 178cm
몸무게: 68kg
지역: 서울
소속: 봄날 필름
특기: 자연스러운 대화 연기, 노래, 경상도 사투리
이미지: 차분한, 지적인
소개: 단편과 독립영화를 중심으로 활동하고 있습니다. 대화 장면에서 상대 배우의 호흡을 따라가는 연기를 좋아합니다.
2024 밤의 끝 | 주연
2023 여름의 문 | 조연
`;

test('이름표가 붙은 프로필에서 기본 항목을 읽는다', () => {
  const draft = draftFromText(RESUME);
  assert.equal(draft.name?.value, '김도윤');
  assert.equal(draft.gender?.value, 'male');
  // 날짜까지 적혀 있으면 출생 연도 대신 생년월일로 읽는다.
  assert.equal(draft.birthDate?.value, '1999-04-12');
  assert.equal(draft.height?.value, 178);
  assert.equal(draft.weight?.value, 68);
  assert.equal(draft.region?.value, '서울');
  assert.equal(draft.agency?.value, '봄날 필름');
});

test('특기와 이미지 키워드는 정해진 목록에 있는 것만 읽는다', () => {
  const draft = draftFromText(RESUME);
  assert.deepEqual(draft.skills?.value.includes('자연스러운 대화 연기'), true);
  assert.deepEqual(draft.skills?.value.includes('경상도 사투리'), true);
  assert.deepEqual(draft.tags?.value.includes('차분한'), true);
  // 목록에 없는 말은 들어가지 않는다
  assert.equal(draftFromText('특기: 서핑, 패러글라이딩').skills, undefined);
});

test('필모그래피는 연도로 시작하는 줄에서 읽는다', () => {
  const draft = draftFromText(RESUME);
  assert.equal(draft.filmography?.value.length, 2);
  assert.deepEqual(draft.filmography?.value[0], {
    year: '2024',
    title: '밤의 끝',
    role: '주연',
  });
});

test('출생 연도 줄은 필모그래피로 읽지 않는다', () => {
  const draft = draftFromText('이름: 박서연\n1999년생\n2024 밤의 끝 | 주연');
  assert.equal(draft.birthYear?.value, 1999);
  assert.equal(draft.filmography?.value.length, 1);
  assert.equal(draft.filmography?.value[0].title, '밤의 끝');
  // '2024년 작품명'처럼 연도 뒤에 '년'이 붙은 줄은 그대로 읽는다
  assert.equal(draftFromText('2024년 여름의 문 | 조연').filmography?.value[0].title, '여름의 문');
});

test('모든 값에 어디서 읽었는지가 함께 온다', () => {
  const draft = draftFromText(RESUME);
  for (const field of Object.values(draft)) {
    assert.equal(typeof field.source, 'string');
    assert.ok(field.source.length > 0);
  }
});

test('나이만 적힌 프로필은 올해를 기준으로 출생 연도를 환산한다', () => {
  const year = new Date().getFullYear();
  const draft = draftFromText('이름: 박서연\n나이: 26');
  assert.equal(draft.birthYear?.value, year - 26 + 1);
  assert.match(draft.birthYear.source, /환산/);
});

test('이름표가 없어도 짧은 한글 줄을 이름으로 본다', () => {
  assert.equal(draftFromText('이준호\n단편 4편 출연').name?.value, '이준호');
});

test('읽을 내용이 없으면 빈 초안이다', () => {
  assert.equal(draftSize(draftFromText('')), 0);
  assert.equal(draftSize(draftFromText('   \n  \n ')), 0);
});

test('같은 글자를 넣으면 늘 같은 초안이 나온다', () => {
  assert.deepEqual(draftFromText(RESUME), draftFromText(RESUME));
});

test('AI 결과에서 허용된 값만 초안이 된다', () => {
  const draft = draftFromFacts({
    name: '  김도윤 ',
    gender: 'male',
    birth_year: 1999,
    height: 178,
    weight: 68,
    region: '서울특별시 마포구',
    agency: '',
    intro: '',
    tags: ['시크한', '없는키워드'],
    skills: ['노래', '없는특기'],
    filmography: [
      { year: '2024', title: '밤의 끝', role: '주연' },
      { year: '작년', title: '연도 오류', role: '' },
      { year: '2023', title: '', role: '조연' },
    ],
    sources: { name: '이름: 김도윤' },
  });
  assert.equal(draft.name?.value, '김도윤');
  assert.equal(draft.name?.source, '이름: 김도윤');
  assert.equal(draft.gender?.value, 'male');
  assert.equal(draft.birthYear?.value, 1999);
  assert.equal(draft.height?.value, 178);
  assert.equal(draft.region?.value, '서울');
  assert.equal(draft.agency, undefined);
  assert.deepEqual(draft.tags?.value, ['시크한']);
  assert.deepEqual(draft.skills?.value, ['노래']);
  assert.deepEqual(draft.filmography?.value, [{ year: '2024', title: '밤의 끝', role: '주연' }]);
});

test('AI 결과가 이상하면 범위를 벗어난 값은 버린다', () => {
  assert.deepEqual(draftFromFacts(null), {});
  assert.deepEqual(draftFromFacts('text'), {});
  const draft = draftFromFacts({
    height: 17,
    weight: 900,
    birth_year: 1800,
    gender: 'robot',
    tags: 'x',
  });
  assert.equal(draftSize(draft), 0);
});

test('생년월일이 날짜까지 적혀 있으면 생년월일로 읽는다', async () => {
  const { draftFromText, draftFromFacts, birthDateFrom } =
    await import('../src/lib/profile-draft.ts');
  assert.equal(birthDateFrom('1999.5.17'), '1999-05-17');
  assert.equal(birthDateFrom('1999년 5월 17일생'), '1999-05-17');
  assert.equal(birthDateFrom('1999-02-30'), '');
  const draft = draftFromText('이름: 홍길동\n생년월일: 1999.05.17\n키 165cm');
  assert.equal(draft.birthDate?.value, '1999-05-17');
  assert.equal(draft.birthYear, undefined);
  // 연도만 있으면 예전처럼 출생 연도
  assert.equal(draftFromText('이름: 홍길동\n1999년생\n키 165cm').birthYear?.value, 1999);
  assert.equal(
    draftFromFacts({ birth_year: 1999, birth_date: '1999-05-17' }).birthDate?.value,
    '1999-05-17',
  );
  assert.equal(draftFromFacts({ birth_year: 1999, birth_date: '' }).birthYear?.value, 1999);
});
