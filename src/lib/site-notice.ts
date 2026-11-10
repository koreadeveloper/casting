// 사이트 공지 띠(관리자가 /admin/notice에서 켜고 끈다). app_meta의 'site_notice'에 JSON으로 둔다.

import { db } from './db';
import { safeUrl } from './validation';

export type NoticeTone = 'info' | 'warn';

export type SiteNotice = {
  on: boolean;
  text: string;
  tone: NoticeTone;
  /** 앱 안 주소(/contact 등) 또는 http(s) 주소. 비어 있으면 링크 없음 */
  link: string;
  linkLabel: string;
  updatedAt: string;
};

export const NOTICE_TEXT_MAX = 200;
const KEY = 'site_notice';

export const EMPTY_NOTICE: SiteNotice = {
  on: false,
  text: '',
  tone: 'info',
  link: '',
  linkLabel: '',
  updatedAt: '',
};

/** 관리자가 보낸 값을 정리한다. 문제가 있으면 안내 문구를 돌려준다. */
export function parseNotice(raw: Record<string, unknown>): SiteNotice | { error: string } {
  const text = String(raw.text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, NOTICE_TEXT_MAX);
  const on = raw.on === true;
  if (on && !text) return { error: '공지 내용을 적어 주세요.' };
  const linkText = String(raw.link ?? '').trim();
  const link = /^\/[\w\-/?=&.%#]*$/.test(linkText) ? linkText : safeUrl(linkText);
  if (linkText && !link)
    return { error: '링크 주소를 확인해 주세요(/로 시작하는 앱 주소나 https 주소).' };
  return {
    on,
    text,
    tone: raw.tone === 'warn' ? 'warn' : 'info',
    link,
    linkLabel:
      String(raw.linkLabel ?? '')
        .trim()
        .slice(0, 30) || (link ? '자세히 보기' : ''),
    updatedAt: new Date().toISOString(),
  };
}

export async function getNotice(): Promise<SiteNotice> {
  const row = (await db().prepare('SELECT value FROM app_meta WHERE key=?').get(KEY)) as
    { value: string } | undefined;
  if (!row) return EMPTY_NOTICE;
  try {
    return { ...EMPTY_NOTICE, ...(JSON.parse(row.value) as Partial<SiteNotice>) };
  } catch {
    return EMPTY_NOTICE;
  }
}

export async function saveNotice(notice: SiteNotice) {
  await db()
    .prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    )
    .run(KEY, JSON.stringify(notice));
}
