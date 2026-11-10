import test from 'node:test';
import assert from 'node:assert/strict';
import { nameChanged, readAccountEdit } from '../src/lib/account-edit.ts';

test('계정 정보: 이름·소속 유형을 받아 다듬는다', () => {
  assert.deepEqual(
    readAccountEdit({ name: ' 김용환 ', orgType: '영화 제작사', orgName: ' 세종마켓 ' }),
    {
      value: { name: '김용환', orgType: '영화 제작사', orgName: '세종마켓' },
    },
  );
  assert.deepEqual(readAccountEdit({ name: '김용환', orgType: '기타' }), {
    value: { name: '김용환', orgType: '기타', orgName: '' },
  });
});

test('계정 정보: 이름이 비었거나 소속 유형이 목록에 없으면 거절', () => {
  assert.ok('error' in readAccountEdit({ name: '  ', orgType: '기타' }));
  assert.ok('error' in readAccountEdit({ name: '김용환', orgType: '아무거나' }));
  assert.ok('error' in readAccountEdit(null));
});

test('계정 정보: 목록에 없는 예전 소속 유형도 지금 값이면 그대로 둔다', () => {
  assert.ok('value' in readAccountEdit({ name: '김용환', orgType: '예전유형' }, '예전유형'));
  assert.ok('error' in readAccountEdit({ name: '김용환', orgType: '' }, ''));
});

test('이름 바뀜 판단: 띄어쓰기만 다르면 같은 이름', () => {
  assert.equal(nameChanged('김용환', '김 용환'), false);
  assert.equal(nameChanged('세종마켓', '김용환'), true);
});
