// 사진·PDF 업로드 저장소.
// SUPABASE_URL과 SUPABASE_SECRET_KEY가 있으면 Supabase Storage의 비공개 버킷에, 아니면 로컬 data/uploads/에 둔다.
// 어느 쪽이든 읽기는 /api/uploads/[name] 라우트를 거치므로 URL 형태는 같다.
// 시크릿 키는 서버에서만 쓴다. 브라우저에 내보내지 않는다.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataDirectory } from './data-directory';

function supabase() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return {
    base: `${url}/storage/v1`,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'uploads',
    // 새 형식 키(sb_secret_…)는 apikey 머리글만, 예전 service_role 키(JWT, eyJ…)는 Authorization도 있어야 한다.
    // sb_secret_ 키를 Authorization에 넣으면 거절되므로 키 모양에 따라 나눈다.
    headers: key.startsWith('eyJ')
      ? { apikey: key, Authorization: `Bearer ${key}` }
      : { apikey: key },
  };
}

export async function saveUpload(name: string, bytes: Uint8Array, contentType: string) {
  const remote = supabase();
  if (remote) {
    const response = await fetch(`${remote.base}/object/${remote.bucket}/${name}`, {
      method: 'POST',
      headers: { ...remote.headers, 'Content-Type': contentType, 'x-upsert': 'true' },
      body: Buffer.from(bytes),
    });
    if (!response.ok) throw new Error(`Supabase Storage 업로드 실패 (${response.status})`);
    return;
  }
  const dir = join(dataDirectory(), 'uploads');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);
}

export async function readUpload(name: string): Promise<BodyInit | null> {
  const remote = supabase();
  if (remote) {
    const response = await fetch(`${remote.base}/object/${remote.bucket}/${name}`, {
      headers: remote.headers,
    });
    return response.ok ? response.body : null;
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
    const remote = supabase();
    if (remote) {
      const response = await fetch(`${remote.base}/object/${remote.bucket}`, {
        method: 'DELETE',
        headers: { ...remote.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: names }),
      });
      if (!response.ok) throw new Error(`Supabase Storage 삭제 실패 (${response.status})`);
    } else
      await Promise.all(
        names.map((name) => rm(join(dataDirectory(), 'uploads', name), { force: true })),
      );
  } catch (error) {
    console.error('업로드 파일 삭제 실패', error);
  }
}
