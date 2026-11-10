// 문의하기의 종류와 입력 검사. DB를 쓰지 않는 리프 모듈이라 화면에서도 가져다 쓴다.

import { requiredText, safeUrl, validEmail } from './validation.ts';

export const INQUIRY_KINDS = {
  general: '일반 문의',
  bug: '오류 제보',
  privacy: '개인정보·탈퇴 요청',
  report: '신고 (허위 공고·부적절한 요구)',
} as const;

export type InquiryKind = keyof typeof INQUIRY_KINDS;

export const INQUIRY_BODY_MIN = 10;
export const INQUIRY_BODY_MAX = 2000;
/** 문의 보관 기간. 지나면 새 문의가 들어올 때 지운다(개인정보처리방침과 맞춘다). */
export const INQUIRY_KEEP_DAYS = 365;

export function isInquiryKind(value: unknown): value is InquiryKind {
  return typeof value === 'string' && Object.hasOwn(INQUIRY_KINDS, value);
}

export type InquiryInput = { kind: InquiryKind; email: string; body: string; link: string };

/** 보낸 값을 정리해서 돌려주거나, 문제가 있으면 안내 문구를 돌려준다. */
export function parseInquiry(raw: Record<string, unknown>): InquiryInput | { error: string } {
  if (!isInquiryKind(raw.kind)) return { error: '문의 종류를 골라 주세요.' };
  const email = requiredText(raw.email, 254).toLowerCase();
  if (!validEmail(email)) return { error: '답장 받을 이메일을 확인해 주세요.' };
  const body = requiredText(raw.body, INQUIRY_BODY_MAX);
  if (body.length < INQUIRY_BODY_MIN)
    return { error: `내용을 ${INQUIRY_BODY_MIN}자 이상 적어 주세요.` };
  const linkText = requiredText(raw.link, 1000);
  // 앱 안 주소(/apply/...)는 그대로, 바깥 주소는 http(s)만 받는다.
  const link = /^\/[\w\-/?=&.%]*$/.test(linkText) ? linkText : safeUrl(linkText);
  if (linkText && !link) return { error: '관련 링크 주소를 확인해 주세요.' };
  if (raw.agree !== true) return { error: '개인정보 수집·이용에 동의해 주세요.' };
  return { kind: raw.kind, email, body, link };
}

/** 관리자 문의 처리함(/admin/inquiries)의 처리 상태 */
export const INQUIRY_STATUS = {
  new: '새 문의',
  doing: '처리 중',
  done: '완료',
} as const;

export type InquiryStatus = keyof typeof INQUIRY_STATUS;

export function isInquiryStatus(value: unknown): value is InquiryStatus {
  return typeof value === 'string' && Object.hasOwn(INQUIRY_STATUS, value);
}

export const INQUIRY_NOTE_MAX = 2000;
