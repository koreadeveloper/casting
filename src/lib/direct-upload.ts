// 브라우저에서만 쓴다: 프로필 PDF를 서버(4.5MB 제한)를 거치지 않고 저장소로 바로 올린다(20MB까지).
// 서버가 저장소를 쓰지 않는 환경(로컬 개발 등)이면 'unavailable'을 돌려주고, 부르는 쪽이 예전 길(4MB)로 올린다.

import { readApiJson } from './image-resize';
import { formatMegabytes, PROFILE_PDF_MAX_BYTES, profilePdfTooLarge } from './upload-limits';

export type DirectPurpose = 'document' | 'draft';

/** 자동 채우기용은 이보다 크면 줄여서 보낸다(AI가 더 빨리·안정적으로 읽는다). */
const DRAFT_SHRINK_OVER = 10 * 1024 * 1024;

/**
 * 프로필 PDF가 너무 크면 브라우저에서 줄인다(사진 압축 → 그래도 크면 페이지를 그림으로).
 * 자료실 PDF는 한도(20MB)를 넘을 때만, 자동 채우기용은 10MB를 넘으면 줄인다.
 * 줄여도 한도를 넘으면 안내 문구로 던진다.
 */
export async function shrinkProfilePdf(
  file: File,
  purpose: DirectPurpose,
  onStatus?: (message: string) => void,
) {
  const goal = purpose === 'draft' ? DRAFT_SHRINK_OVER : PROFILE_PDF_MAX_BYTES;
  if (file.size <= goal) return file;
  const { shrinkPdf } = await import('./pdf-compress');
  const shrunk = await shrinkPdf(file, { goal, limit: PROFILE_PDF_MAX_BYTES }, onStatus);
  if (shrunk.size > PROFILE_PDF_MAX_BYTES)
    throw new Error(
      shrunk === file
        ? profilePdfTooLarge(file.size)
        : `자동으로 줄여 봤지만 ${formatMegabytes(shrunk.size)}라 올릴 수 없어요(한도 ${formatMegabytes(PROFILE_PDF_MAX_BYTES)}). 페이지 수를 줄여 다시 올려 주세요.`,
    );
  return shrunk;
}

/** 성공하면 저장소 파일 이름('UUID.pdf'), 바로 올리기를 못 쓰면 'unavailable'. 실패하면 던진다. */
export async function uploadPdfDirect(file: File, purpose: DirectPurpose) {
  const tooLarge = profilePdfTooLarge(file.size);
  if (tooLarge) throw new Error(tooLarge);
  const signResponse = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose, size: file.size }),
  });
  const sign = await readApiJson<{
    direct?: boolean;
    name?: string;
    uploadUrl?: string;
    error?: string;
  }>(signResponse);
  if (!signResponse.ok) throw new Error(sign.error || 'PDF를 올리지 못했어요.');
  if (!sign.direct || !sign.uploadUrl || !sign.name) return 'unavailable' as const;
  const put = await fetch(sign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
  }).catch(() => null);
  if (!put?.ok)
    throw new Error(
      put?.status === 413
        ? profilePdfTooLarge(file.size) || 'PDF가 너무 커요.'
        : 'PDF를 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
    );
  return sign.name;
}
