// 사진·PDF 업로드 저장소.
// Vercel에 Blob이 연결돼 있으면(BLOB_STORE_ID) 비공개 Blob 스토어에, 아니면 로컬 data/uploads/에 둔다.
// 어느 쪽이든 읽기는 /api/uploads/[name] 라우트를 거치므로 URL 형태는 같다.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { del, get, put } from '@vercel/blob';
import { dataDirectory } from './data-directory';

function useBlob() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

export async function saveUpload(name: string, bytes: Uint8Array, contentType: string) {
  if (useBlob()) {
    await put(`uploads/${name}`, Buffer.from(bytes), {
      access: 'private',
      contentType,
      addRandomSuffix: false,
    });
    return;
  }
  const dir = join(dataDirectory(), 'uploads');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);
}

export async function readUpload(name: string): Promise<BodyInit | null> {
  if (useBlob()) {
    const result = await get(`uploads/${name}`, { access: 'private' });
    return result && result.statusCode === 200 ? result.stream : null;
  }
  try {
    return new Uint8Array(await readFile(join(dataDirectory(), 'uploads', name)));
  } catch {
    return null;
  }
}

/** /api/uploads/<name> 형태의 URL들을 지운다. 실패해도 탈퇴 같은 본 작업은 막지 않는다. */
export async function deleteUploads(urls: string[]) {
  const names = urls
    .map(
      (url) =>
        // 뒤의 문서 확장자들은 대화 첨부 파일(lib/chat-files.ts)용
        /^\/api\/uploads\/([a-f0-9-]{36}\.(?:jpg|png|webp|pdf|hwpx?|docx?|xlsx?|pptx?))$/.exec(
          url,
        )?.[1],
    )
    .filter((name): name is string => Boolean(name));
  if (!names.length) return;
  try {
    if (useBlob()) await del(names.map((name) => `uploads/${name}`));
    else
      await Promise.all(
        names.map((name) => rm(join(dataDirectory(), 'uploads', name), { force: true })),
      );
  } catch (error) {
    console.error('업로드 파일 삭제 실패', error);
  }
}
