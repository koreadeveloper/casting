import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { FORMATS, isPosterUrl, projectCover } from '../src/lib/project-meta.ts';

const poster = '/api/uploads/869c5683-6fce-40e9-b109-7d798aee4831.png';

test('업로드한 사진 주소만 포스터로 받는다', () => {
  assert.equal(isPosterUrl(poster), true);
  assert.equal(isPosterUrl(poster.replace('.png', '.webp')), true);
  assert.equal(isPosterUrl(poster.replace('.png', '.pdf')), false);
  assert.equal(isPosterUrl('https://example.com/poster.png'), false);
  assert.equal(isPosterUrl('/api/uploads/../secret.png'), false);
  assert.equal(isPosterUrl(''), false);
  assert.equal(isPosterUrl(null), false);
});

test('포스터가 있으면 포스터, 없으면 형식별 기본 커버', () => {
  assert.equal(projectCover('뮤직비디오', poster), poster);
  assert.equal(projectCover('뮤직비디오', ''), '/covers/mv.svg');
  assert.equal(projectCover('뮤직비디오', 'https://example.com/x.png'), '/covers/mv.svg');
  assert.equal(projectCover('독립영화'), '/covers/etc.svg');
  assert.equal(projectCover(''), '/covers/etc.svg');
});

test('모든 형식에 기본 커버 그림이 있다', () => {
  for (const format of FORMATS) {
    const cover = projectCover(format);
    assert.ok(existsSync(new URL(`../public${cover}`, import.meta.url)), `${format}: ${cover}`);
  }
});
