import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPdfFile,
  isStoredPdfName,
  PROFILE_PDF_MAX_BYTES,
  profilePdfTooLarge,
  SERVER_UPLOAD_MAX_BYTES,
} from '../src/lib/upload-limits.ts';

test('한도: 서버를 거치면 4MB, 프로필 PDF는 20MB', () => {
  assert.equal(SERVER_UPLOAD_MAX_BYTES, 4 * 1024 * 1024);
  assert.equal(PROFILE_PDF_MAX_BYTES, 20 * 1024 * 1024);
  // AI가 PDF를 읽는 요청 한도(32MB)는 파일을 글자로 바꾸면 1.33배가 되므로 그보다 작아야 한다.
  assert.ok((PROFILE_PDF_MAX_BYTES * 4) / 3 < 32 * 1024 * 1024);
});

test('20MB를 넘으면 크기와 함께 안내한다', () => {
  assert.equal(profilePdfTooLarge(PROFILE_PDF_MAX_BYTES), '');
  assert.match(profilePdfTooLarge(PROFILE_PDF_MAX_BYTES + 1), /20MB까지.*20\.0MB/);
  assert.match(profilePdfTooLarge(25 * 1024 * 1024), /25\.0MB/);
});

test('PDF 판별과 저장소 파일 이름', () => {
  assert.equal(isPdfFile({ name: 'a.PDF', type: '' }), true);
  assert.equal(isPdfFile({ name: 'a', type: 'application/pdf' }), true);
  assert.equal(isPdfFile({ name: 'a.jpg', type: 'image/jpeg' }), false);
  assert.equal(isStoredPdfName('3f2b1c9e-1111-4222-8333-444455556666.pdf'), true);
  assert.equal(isStoredPdfName('tmp/3f2b1c9e-1111-4222-8333-444455556666.pdf'), false);
  assert.equal(isStoredPdfName('../x.pdf'), false);
});
