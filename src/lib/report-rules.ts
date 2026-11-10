// 신고하기(/report)의 대상·사유·처리 상태와 입력 검사. DB를 쓰지 않는 리프 모듈이라 화면과 테스트에서도 쓴다.

import { requiredText, validEmail } from './validation.ts';

/** 신고 대상 종류. role: 공고, actor: 배우 프로필, chat: 지원서 대화(상대방) */
export const REPORT_TARGETS = {
  role: '공고',
  actor: '배우',
  chat: '대화 상대',
} as const;

export type ReportTarget = keyof typeof REPORT_TARGETS;

export function isReportTarget(value: unknown): value is ReportTarget {
  return typeof value === 'string' && Object.hasOwn(REPORT_TARGETS, value);
}

/** 신고 사유 */
export const REPORT_REASONS = {
  fake_role: '허위·과장 공고',
  pay: '출연료·촬영 조건 문제',
  inappropriate_request: '부적절한 요구 (노출·금전·만남 등)',
  no_show: '무단 불참',
  fake_profile: '허위 정보·사칭',
  inappropriate_content: '부적절한 사진·내용',
  abusive: '욕설·괴롭힘·차별',
  spam: '광고·스팸',
  other: '기타',
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

/** 누가 신고하는지: guest(로그인 안 함), actor(배우), producer(제작진) */
export type ReporterSide = 'guest' | 'actor' | 'producer';

/**
 * 대상·신고하는 쪽마다 고를 수 있는 사유.
 * 대화는 신고하는 쪽에 따라 상대가 다르다(배우 → 제작진, 제작진 → 배우).
 * 무단 불참은 제작진이 배우를 신고할 때만 고를 수 있다.
 */
export function reportReasons(target: ReportTarget, side: ReporterSide): ReportReason[] {
  if (target === 'role')
    return ['fake_role', 'pay', 'inappropriate_request', 'abusive', 'spam', 'other'];
  if (target === 'actor')
    return ['fake_profile', 'inappropriate_content', 'abusive', 'spam', 'other'];
  return side === 'producer'
    ? ['no_show', 'abusive', 'fake_profile', 'spam', 'other']
    : ['inappropriate_request', 'pay', 'abusive', 'fake_role', 'spam', 'other'];
}

export const REPORT_BODY_MIN = 10;
export const REPORT_BODY_MAX = 2000;
/** 신고 보관 기간. 지나면 새 신고가 들어올 때 지운다(개인정보처리방침과 맞춘다). */
export const REPORT_KEEP_DAYS = 365;

export type ReportInput = { reason: ReportReason; body: string; email: string };

/**
 * 보낸 값을 정리해서 돌려주거나, 문제가 있으면 안내 문구를 돌려준다.
 * 로그인한 사람·지원 현황 토큰으로 들어온 배우는 이메일을 계정(지원서)에서 쓰므로 accountEmail을 넘긴다.
 */
export function parseReport(
  raw: Record<string, unknown>,
  target: ReportTarget,
  side: ReporterSide,
  accountEmail = '',
): ReportInput | { error: string } {
  const reason = raw.reason;
  if (typeof reason !== 'string' || !reportReasons(target, side).includes(reason as ReportReason))
    return { error: '신고 사유를 골라 주세요.' };
  const body = requiredText(raw.body, REPORT_BODY_MAX);
  if (body.length < REPORT_BODY_MIN)
    return { error: `무슨 일이 있었는지 ${REPORT_BODY_MIN}자 이상 적어 주세요.` };
  const email = (accountEmail || requiredText(raw.email, 254)).toLowerCase();
  if (!validEmail(email)) return { error: '답장 받을 이메일을 확인해 주세요.' };
  if (raw.agree !== true) return { error: '개인정보 수집·이용에 동의해 주세요.' };
  return { reason: reason as ReportReason, body, email };
}

/** 관리자 신고 처리함(/admin/reports)의 처리 상태 */
export const REPORT_STATUS = {
  new: '새 신고',
  reviewing: '확인 중',
  actioned: '조치함',
  dismissed: '문제 없음',
} as const;

export type ReportStatus = keyof typeof REPORT_STATUS;

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === 'string' && Object.hasOwn(REPORT_STATUS, value);
}

/** 처리가 끝난 상태(조치함·문제 없음) */
export function isReportClosed(status: ReportStatus) {
  return status === 'actioned' || status === 'dismissed';
}

export const REPORT_NOTE_MAX = 2000;
