export function requiredText(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function safeUrl(value: unknown) {
  const text = requiredText(value, 1000);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

/** 지원서 한 건에 넣을 수 있는 사진 수 (프로필 사진 보관 한도와 같다) */
export const MAX_APPLICATION_PHOTOS = 8;

/** 배우 프로필 소개글 최대 글자 수. 제작자 화면에서 한눈에 읽히는 길이로 둔다. */
export const PROFILE_INTRO_MAX = 500;
/** 지원서 소개 최대 글자 수. 프로필 소개에 필모그래피가 덧붙어 들어오므로 조금 넉넉하게. */
export const APPLICATION_INTRO_MAX = 1000;

export const UPLOAD_PATTERN = /^\/api\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/;
// 데모용 그림 아바타와 데모 배우 사진(public/actors). 앱 안에 있는 파일이라 그대로 허용한다.
const AVATAR_PATTERN = /^\/(avatars\/p\d{2}\.svg|actors\/actor-\d{2}\.jpg)$/;

export function safeImageRef(value: unknown) {
  const text = requiredText(value, 1000);
  return UPLOAD_PATTERN.test(text) || AVATAR_PATTERN.test(text) ? text : safeUrl(text);
}

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
