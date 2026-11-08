import assert from 'node:assert/strict';
import test from 'node:test';
import { isHiddenActor } from '../src/lib/hidden-actors.ts';

test('팀 시험용 배우 이름과 [테스트]로 시작하는 이름은 숨긴다', () => {
  for (const name of [
    '캐스팅플로우',
    '김용환',
    '이서윤',
    '테스트배우',
    ' 이 서윤 ',
    '[테스트] 홍길동',
    '[TEST]배우',
  ])
    assert.equal(isHiddenActor(name), true, name);
  for (const name of ['김민지', '이서윤아', '테스트 드라이버', ''])
    assert.equal(isHiddenActor(name), false, name);
});
