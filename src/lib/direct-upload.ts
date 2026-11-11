// 브라우저에서만 쓴다: 프로필 PDF를 서버(4.5MB 제한)를 거치지 않고 저장소로 바로 올린다(20MB까지).
// 서버가 저장소를 쓰지 않는 환경(로컬 개발 등)이면 'unavailable'을 돌려주고, 부르는 쪽이 예전 길(4MB)로 올린다.

import { readApiJson } from './image-resize';
import { profilePdfTooLarge } from './upload-limits';

export type DirectPurpose = 'document' | 'draft';

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
