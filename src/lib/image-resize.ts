// 브라우저에서 사진을 올리기 전에 줄인다. 휴대폰 사진(5MB 이상)이 서버리스 요청 크기 제한(4.5MB)에
// 걸려 올라가지 않는 문제를 막고, PNG·WEBP도 JPEG로 맞춰 용량을 줄인다. PDF는 그대로 둔다.

const MAX_SIDE = 2000;
const SKIP_UNDER = 1.2 * 1024 * 1024;

/** 사진이면 긴 변 2000px 이하 JPEG로 줄인 새 File을, 아니거나 줄이지 못하면 원본을 돌려준다. */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SKIP_UNDER) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    // PNG의 투명한 부분이 검게 나오지 않도록 흰 바탕을 깐다.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** 응답이 JSON이 아니어도(서버 오류·용량 초과 페이지) 알아볼 수 있는 메시지로 바꿔 돌려준다. */
export async function readApiJson<T = Record<string, unknown>>(response: Response) {
  const data = (await response.json().catch(() => null)) as T | null;
  if (data) return data;
  const error =
    response.status === 413
      ? '파일이 너무 커요. 더 작은 파일로 올려 주세요.'
      : '서버가 응답하지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
  return { error } as T;
}
