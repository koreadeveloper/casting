import assert from 'node:assert/strict';
import test from 'node:test';
import { roleShareDescription, roleShareTitle } from '../src/lib/share-preview.ts';

const role = {
  projectTitle: '봄날의 기억',
  title: '지민 역',
  roleType: 'lead',
  gender: 'female',
  ageMin: 20,
  ageMax: 29,
  shootDate: '2026-11-16',
  shootDates: ['2026-11-16', '2026-11-17', '2026-11-18'],
  location: '서울 마포구',
  pay: '회차당 10만원',
  deadline: '2026-11-15',
  isClosed: false,
};

test('공유 미리보기: 제목은 작품·배역 이름과 서비스 이름', () => {
  assert.equal(roleShareTitle(role), '봄날의 기억 · 지민 역 배우 모집 · 캐스팅플로우');
});

test('공유 미리보기: 설명은 배역 조건 | 촬영 정보 | 마감일', () => {
  assert.equal(
    roleShareDescription(role),
    '주연 · 여성 · 20~29세 | 촬영 11/16–11/18 · 서울 마포구 · 회차당 10만원 | 11월 15일 마감',
  );
});

test('공유 미리보기: 빈 값은 빼고, 마감된 공고는 마감이라고 쓴다', () => {
  assert.equal(
    roleShareDescription({
      ...role,
      gender: 'any',
      ageMin: 0,
      ageMax: 0,
      shootDates: [],
      pay: '',
      deadline: '',
      isClosed: true,
    }),
    '주연 · 성별 무관 | 촬영 11/16 · 서울 마포구 | 모집 마감',
  );
});
