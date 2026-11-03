// 공고(배역) 지원 링크를 카카오톡 등에 공유할 때 미리보기에 나오는 제목·설명.
// (리프 모듈: node --test에서 바로 불러온다)

import { ROLE_GENDERS, ROLE_TYPES, ageRangeLabel } from './project-meta.ts';
import { formatDates } from './schedule.ts';
import type { Role } from './types.ts';

type ShareRole = Pick<
  Role,
  | 'projectTitle'
  | 'title'
  | 'roleType'
  | 'gender'
  | 'ageMin'
  | 'ageMax'
  | 'shootDate'
  | 'shootDates'
  | 'location'
  | 'pay'
  | 'deadline'
  | 'isClosed'
>;

/** 예: "봄날의 기억 · 지민 역 배우 모집 · 캐스팅플로우" */
export function roleShareTitle(role: Pick<Role, 'projectTitle' | 'title'>) {
  return `${role.projectTitle} · ${role.title} 배우 모집 · 캐스팅플로우`;
}

/** 예: "주연 · 여성 · 20~29세 | 촬영 11/16–11/18 · 서울 마포구 · 회차당 10만원 | 11월 15일 마감" */
export function roleShareDescription(role: ShareRole) {
  const who = [
    ROLE_TYPES[role.roleType],
    ROLE_GENDERS[role.gender],
    ageRangeLabel(role.ageMin, role.ageMax),
  ]
    .filter(Boolean)
    .join(' · ');
  const dates = formatDates(role.shootDates, 2) || formatDates([role.shootDate]);
  const shoot = [dates && `촬영 ${dates}`, role.location, role.pay].filter(Boolean).join(' · ');
  const due = monthDay(role.deadline);
  const deadline = role.isClosed ? '모집 마감' : due ? `${due} 마감` : '';
  return [who, shoot, deadline].filter(Boolean).join(' | ');
}

/** 'YYYY-MM-DD' → '11월 15일'. 날짜가 아니면 ''. */
function monthDay(iso: string) {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${Number(match[1])}월 ${Number(match[2])}일` : '';
}
