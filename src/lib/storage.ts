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
    headers: (key.startsWith('eyJ')
      ? { apikey: key, Authorization: `Bearer ${key}` }
      : { apikey: key }) as Record<string, string>,
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

// ── 브라우저가 저장소로 바로 올리기(프로필 PDF, 20MB) ─────────────────────────────
// Vercel 함수는 요청·응답이 4.5MB를 넘으면 받지 못해서, 큰 파일은 서버를 거치지 않게 한다.
// 서버는 한 번만 쓸 수 있는 올리기 주소를 만들어 주고, 다 올린 뒤 크기·형식을 확인한다.

/** 바로 올리기를 쓸 수 있는지(Supabase 저장소가 설정돼 있을 때만). 없으면 예전처럼 서버를 거친다. */
export function directUploadAvailable() {
  return Boolean(supabase());
}

/** path(예: 'UUID.pdf', 'tmp/UUID.pdf')에 한 번만 쓸 수 있는 올리기 주소. 저장소가 없으면 null. */
export async function createSignedUpload(path: string) {
  const remote = supabase();
  if (!remote) return null;
  const response = await fetch(`${remote.base}/object/upload/sign/${remote.bucket}/${path}`, {
    method: 'POST',
    headers: remote.headers,
  });
  const data = (await response.json().catch(() => null)) as { url?: string } | null;
  if (!response.ok || !data?.url)
    throw new Error(`올리기 주소를 만들지 못했어요 (${response.status})`);
  return `${remote.base}${data.url}`;
}

/** 올라간 파일의 크기·형식. 없으면 null. */
export async function storedFileInfo(path: string) {
  const remote = supabase();
  if (!remote) return null;
  const response = await fetch(`${remote.base}/object/info/${remote.bucket}/${path}`, {
    headers: remote.headers,
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as {
    size?: number;
    content_type?: string;
  } | null;
  return data
    ? { size: Number(data.size ?? 0), contentType: String(data.content_type ?? '') }
    : null;
}

/** 올라간 파일 전체를 읽는다(maxBytes를 넘으면 null). */
export async function readStoredBytes(path: string, maxBytes: number) {
  const remote = supabase();
  if (!remote) return null;
  const response = await fetch(`${remote.base}/object/${remote.bucket}/${path}`, {
    headers: remote.headers,
  });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.byteLength > maxBytes ? null : bytes;
}

/** 잠깐만 쓸 수 있는 내려받기 주소(큰 PDF를 서버를 거치지 않고 보여 줄 때). */
export async function signedDownloadUrl(path: string, seconds = 300) {
  const remote = supabase();
  if (!remote) return null;
  const response = await fetch(`${remote.base}/object/sign/${remote.bucket}/${path}`, {
    method: 'POST',
    headers: { ...remote.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: seconds }),
  });
  const data = (await response.json().catch(() => null)) as { signedURL?: string } | null;
  return response.ok && data?.signedURL ? `${remote.base}${data.signedURL}` : null;
}

/** 저장소 경로들을 지운다. 실패해도 본 작업은 막지 않는다. */
export async function deleteStoredPaths(paths: string[]) {
  const remote = supabase();
  if (!remote || !paths.length) return;
  try {
    const response = await fetch(`${remote.base}/object/${remote.bucket}`, {
      method: 'DELETE',
      headers: { ...remote.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!response.ok) throw new Error(`Supabase Storage 삭제 실패 (${response.status})`);
  } catch (error) {
    console.error('저장소 파일 삭제 실패', error);
  }
}

/**
 * 자동 채우기용 임시 파일(tmp/) 중 한 시간이 지난 것을 지운다.
 * 보통은 읽은 직후 지우지만, 올리고 나서 화면을 닫으면 남을 수 있어 새로 올릴 때마다 한 번 치운다.
 */
export async function cleanupTemporaryUploads(olderThanMs = 60 * 60 * 1000) {
  const remote = supabase();
  if (!remote) return;
  try {
    const response = await fetch(`${remote.base}/object/list/${remote.bucket}`, {
      method: 'POST',
      headers: { ...remote.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix: 'tmp',
        limit: 100,
        sortBy: { column: 'created_at', order: 'asc' },
      }),
    });
    if (!response.ok) return;
    const items = (await response.json()) as { name: string; created_at?: string }[];
    const cutoff = Date.now() - olderThanMs;
    const old = items
      .filter((item) => item.created_at && new Date(item.created_at).getTime() < cutoff)
      .map((item) => `tmp/${item.name}`);
    await deleteStoredPaths(old);
  } catch (error) {
    console.error('임시 업로드 정리 실패', error);
  }
}

/** 올라간 파일의 앞부분만 읽는다(파일 형식 확인용). */
export async function readStoredHead(path: string, length = 8) {
  const remote = supabase();
  if (!remote) return null;
  const response = await fetch(`${remote.base}/object/${remote.bucket}/${path}`, {
    headers: { ...remote.headers, Range: `bytes=0-${length - 1}` },
  });
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer()).slice(0, length);
}
