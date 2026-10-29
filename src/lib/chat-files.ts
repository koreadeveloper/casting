// 대화 첨부 파일 규칙. 서버(업로드 검사)와 대화 화면(선택 안내·미리보기)이 함께 쓴다.
// 대본·지정대사(PDF·한글·워드), 프로필 사진, 일정표(엑셀) 정도를 주고받는 용도라 종류를 좁게 둔다.

/** Vercel 함수의 요청 크기 제한(4.5MB)보다 조금 작게 둔다. */
export const CHAT_FILE_MAX_BYTES = 4 * 1024 * 1024;

const IMAGE_EXTS = ['jpg', 'png', 'webp'] as const;
// 워드·엑셀·파워포인트·한글(hwpx)의 새 형식은 모두 ZIP 묶음이라 파일 앞부분이 같다.
const ZIP_EXTS = ['docx', 'xlsx', 'pptx', 'hwpx'] as const;
// 한글(hwp)과 예전 오피스 형식은 OLE 묶음이라 파일 앞부분이 같다.
const OLE_EXTS = ['hwp', 'doc', 'xls', 'ppt'] as const;

export const CHAT_FILE_EXTS = [...IMAGE_EXTS, 'pdf', ...ZIP_EXTS, ...OLE_EXTS] as const;
export type ChatFileExt = (typeof CHAT_FILE_EXTS)[number];

/** 파일 선택 창에 보여 줄 종류 */
export const CHAT_FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,application/pdf,.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

/** 저장소 이름: 무작위 UUID + 확장자. 주소에 이 형식만 받는다. */
export const CHAT_FILE_KEY = new RegExp(`^[a-f0-9-]{36}\\.(${CHAT_FILE_EXTS.join('|')})$`);

const CONTENT_TYPES: Record<ChatFileExt, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  hwpx: 'application/octet-stream',
  hwp: 'application/octet-stream',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
};

export function chatFileContentType(ext: ChatFileExt) {
  return CONTENT_TYPES[ext];
}

export function isImageExt(ext: string) {
  return (IMAGE_EXTS as readonly string[]).includes(ext);
}

/** 브라우저 안에서 바로 열어도 되는 종류(사진·PDF). 나머지는 내려받기로만 준다. */
export function opensInline(ext: string) {
  return isImageExt(ext) || ext === 'pdf';
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, from: number, to: number) {
  return String.fromCharCode(...bytes.slice(from, to));
}

function extOf(name: string) {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  return ext === 'jpeg' ? 'jpg' : ext;
}

/**
 * 파일 내용의 앞부분을 보고 종류를 정한다. 이름의 확장자만 믿지 않는다.
 * ZIP·OLE 묶음은 내용만으로 워드인지 한글인지 가릴 수 없어서, 묶음 종류가 맞을 때만 이름의 확장자를 따른다.
 */
export function detectChatFile(bytes: Uint8Array, fileName: string): ChatFileExt | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 5) === '%PDF-') return 'pdf';
  const ext = extOf(fileName);
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]))
    return (ZIP_EXTS as readonly string[]).includes(ext) ? (ext as ChatFileExt) : null;
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return (OLE_EXTS as readonly string[]).includes(ext) ? (ext as ChatFileExt) : null;
  return null;
}

/** 화면에 보여 줄 원래 파일 이름. 경로·제어 문자를 빼고 길이를 줄인다. */
export function cleanFileName(name: string, ext: string) {
  const base = (name.split(/[\\/]/).pop() || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>]/g, '')
    .trim();
  const cleaned = base.length > 120 ? `${base.slice(0, 100)}….${ext}` : base;
  return cleaned || `첨부파일.${ext}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 대화 목록·알림에 보여 줄 한 줄. 글 없이 파일만 보낸 메시지는 파일 이름으로 대신한다. */
export const MESSAGE_PREVIEW_SQL = (alias: string) =>
  `CASE WHEN ${alias}.body = '' AND ${alias}.file_name <> '' THEN '📎 ' || ${alias}.file_name ELSE ${alias}.body END`;
