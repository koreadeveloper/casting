import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_FILE_KEY,
  cleanFileName,
  detectChatFile,
  formatFileSize,
  opensInline,
} from '../src/lib/chat-files.ts';

const bytes = (...values) => new Uint8Array([...values, ...Array(16).fill(0)]);
const text = (value) => new Uint8Array([...Buffer.from(value), ...Array(16).fill(0)]);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

test('사진과 PDF는 이름과 상관없이 내용으로 알아본다', () => {
  assert.equal(detectChatFile(bytes(0xff, 0xd8, 0xff), 'photo.png'), 'jpg');
  assert.equal(detectChatFile(bytes(0x89, 0x50, 0x4e, 0x47), 'a'), 'png');
  assert.equal(detectChatFile(text('RIFF\0\0\0\0WEBP'), 'a.webp'), 'webp');
  assert.equal(detectChatFile(text('%PDF-1.7'), '대본.hwp'), 'pdf');
});

test('ZIP·OLE 묶음은 묶음 종류가 맞는 확장자만 받는다', () => {
  assert.equal(detectChatFile(bytes(...ZIP), '대본.hwpx'), 'hwpx');
  assert.equal(detectChatFile(bytes(...ZIP), '일정.XLSX'), 'xlsx');
  assert.equal(detectChatFile(bytes(...ZIP), 'virus.zip'), null);
  assert.equal(detectChatFile(bytes(...OLE), '지정대사.hwp'), 'hwp');
  assert.equal(detectChatFile(bytes(...OLE), '지정대사.docx'), null);
  assert.equal(detectChatFile(bytes(...ZIP), '지정대사.hwp'), null);
});

test('알 수 없는 파일은 거절한다', () => {
  assert.equal(detectChatFile(text('<html><script>'), 'a.pdf'), null);
  assert.equal(detectChatFile(text('MZ'), 'setup.exe'), null);
});

test('저장소 이름은 UUID.허용 확장자만 통과한다', () => {
  assert.ok(CHAT_FILE_KEY.test('0f8fad5b-d9cb-469f-a165-70867728950e.hwp'));
  assert.ok(!CHAT_FILE_KEY.test('../etc/passwd'));
  assert.ok(!CHAT_FILE_KEY.test('0f8fad5b-d9cb-469f-a165-70867728950e.exe'));
});

test('파일 이름 정리와 크기 표시', () => {
  assert.equal(cleanFileName('C:\\Users\\me\\대본 3고.pdf', 'pdf'), '대본 3고.pdf');
  assert.equal(cleanFileName('', 'jpg'), '첨부파일.jpg');
  assert.ok(cleanFileName(`${'가'.repeat(200)}.pdf`, 'pdf').length <= 106);
  assert.equal(formatFileSize(512), '512B');
  assert.equal(formatFileSize(2048), '2KB');
  assert.equal(formatFileSize(3.5 * 1024 * 1024), '3.5MB');
  assert.ok(opensInline('pdf') && opensInline('jpg') && !opensInline('hwp'));
});
