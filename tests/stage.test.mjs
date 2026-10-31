import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_SPECIAL_SCENE,
  normalizeSpecialScenes,
  projectRemovalMode,
  specialScenesLabel,
} from '../src/lib/project-meta.ts';
import {
  AUTO_RESULT_MESSAGE,
  RESULT_DELAYED_LABEL,
  RESULT_DELAYED_MESSAGE,
  actorStageInfo,
  actorStageMessage,
  actorStageOf,
} from '../src/lib/types.ts';

test('특수 장면: 종류를 고르면 "없음"은 빠지고, 모르는 값은 버린다', () => {
  assert.deepEqual(normalizeSpecialScenes(['none', 'nudity', 'hack', 'nudity']), ['nudity']);
  assert.deepEqual(normalizeSpecialScenes(['none']), [NO_SPECIAL_SCENE]);
  // 아무것도 안 고르면 '아직 안내 안 함'(빈 목록)
  assert.deepEqual(normalizeSpecialScenes([]), []);
  assert.deepEqual(normalizeSpecialScenes('nudity'), []);
});

test('특수 장면 표시', () => {
  assert.equal(specialScenesLabel(['none']), '특수 장면 없음');
  assert.equal(specialScenesLabel(['nudity', 'smoking']), '노출·흡연·음주');
  assert.equal(specialScenesLabel([]), '');
});

test('지원 현황: 결과 전에는 열람 여부로 미열람·검토 중을 나눈다', () => {
  assert.equal(actorStageOf({ publicStage: 'received', viewedAt: null }), 'unread');
  assert.equal(
    actorStageOf({ publicStage: 'received', viewedAt: '2026-10-27T10:00:00Z' }),
    'reviewing',
  );
  assert.equal(actorStageInfo.unread.label, '미열람');
  assert.equal(actorStageInfo.reviewing.label, '검토 중');
});

test('지원 현황: 결과가 정해지면 열람 여부와 상관없이 그 결과를 보여 준다', () => {
  assert.equal(actorStageOf({ publicStage: 'audition', viewedAt: null }), 'audition');
  assert.equal(actorStageOf({ publicStage: 'cast', viewedAt: 'x' }), 'cast');
  assert.equal(actorStageOf({ publicStage: 'not_selected', viewedAt: 'x' }), 'not_selected');
  assert.equal(actorStageInfo.cast.label, '합격');
  assert.equal(actorStageInfo.not_selected.label, '불합격');
});

test('지원 현황: 자동으로 안내된 불합격은 그렇다는 걸 알려 준다', () => {
  assert.equal(
    actorStageMessage({ publicStage: 'not_selected', viewedAt: null, resultAutoAt: '2026-11-21' }),
    AUTO_RESULT_MESSAGE,
  );
  // 제작진이 직접 정한 불합격은 기존 문구
  assert.equal(
    actorStageMessage({ publicStage: 'not_selected', viewedAt: 'x', resultAutoAt: null }),
    actorStageInfo.not_selected.message,
  );
  // 자동 안내 뒤 제작진이 합격으로 바꾸면 합격 문구
  assert.equal(
    actorStageMessage({ publicStage: 'cast', viewedAt: 'x', resultAutoAt: '2026-11-21' }),
    actorStageInfo.cast.message,
  );
  assert.equal(
    actorStageMessage({ publicStage: 'received', viewedAt: null, resultAutoAt: null }),
    actorStageInfo.unread.message,
  );
});

test('지원 현황: 기준일이 지나도 결과 전이면 불합격이 아니라 결과 안내 지연', () => {
  const pending = { publicStage: 'received', viewedAt: 'x', resultAutoAt: null };
  // 단계는 여전히 결과 전(검토 중)이다 — 날짜만으로 불합격이 되지 않는다
  assert.equal(actorStageOf(pending), 'reviewing');
  assert.equal(actorStageMessage(pending, true), RESULT_DELAYED_MESSAGE);
  assert.notEqual(actorStageMessage(pending, true), actorStageInfo.not_selected.message);
  assert.equal(actorStageMessage(pending, false), actorStageInfo.reviewing.message);
  // 제작진이 정한 결과는 지연 여부와 상관없이 그대로 보인다
  assert.equal(
    actorStageMessage({ publicStage: 'cast', viewedAt: 'x', resultAutoAt: null }, true),
    actorStageInfo.cast.message,
  );
  assert.equal(
    actorStageMessage({ publicStage: 'not_selected', viewedAt: 'x', resultAutoAt: null }, true),
    actorStageInfo.not_selected.message,
  );
  assert.equal(RESULT_DELAYED_LABEL, '결과 안내 지연');
});

test('프로젝트 정리: 지원서나 제안이 있으면 보관만, 없으면 삭제', () => {
  assert.equal(projectRemovalMode({ applications: 0, proposals: 0 }), 'delete');
  assert.equal(projectRemovalMode({ applications: 3, proposals: 0 }), 'archive');
  assert.equal(projectRemovalMode({ applications: 0, proposals: 1 }), 'archive');
});
