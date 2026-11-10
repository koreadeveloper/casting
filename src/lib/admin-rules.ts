// 관리자 회원 관리(/admin/members)의 순수 규칙. DB 없이 테스트할 수 있게 따로 둔다.

export type LoginMethod = 'email' | 'google' | 'kakao';
export const LOGIN_METHODS: LoginMethod[] = ['email', 'google', 'kakao'];
export const METHOD_LABEL: Record<LoginMethod, string> = {
  email: '이메일',
  google: 'Google',
  kakao: 'Kakao',
};

/** ADMIN_EMAILS가 없을 때의 관리자: 팀 공식 계정(구글 로그인). */
export const DEFAULT_ADMIN_EMAILS = 'castingflowofficial@gmail.com';

/**
 * 관리자 이메일 목록. 환경 변수 ADMIN_EMAILS에 쉼표로 적는다(대소문자 무시).
 * 설정하면 기본값(DEFAULT_ADMIN_EMAILS)을 대신한다. 메일이 확인된 계정만 관리자가 된다(isAdminAccount).
 */
export function adminEmailList(env: Record<string, string | undefined> = process.env) {
  return (env.ADMIN_EMAILS?.trim() || DEFAULT_ADMIN_EMAILS)
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes('@'));
}

/**
 * 이 회원이 관리자인지. 메일 주인임을 확인한 계정(구글 로그인·메일 인증번호)만 인정한다.
 * 확인 안 된 예전 가입 계정은 남이 관리자 주소로 먼저 만들어 둔 계정일 수 있어서다.
 */
export function isAdminAccount(
  user: { email: string; emailVerified: boolean; suspendedAt?: string | null },
  env: Record<string, string | undefined> = process.env,
) {
  if (!user.emailVerified || user.suspendedAt) return false;
  return adminEmailList(env).includes(user.email.toLowerCase());
}

/**
 * 로그인할 수 있는 방법. 비밀번호가 있으면 이메일, 연결된 소셜 계정마다 그 제공자.
 * 예전 이메일 가입 계정에 구글을 붙이면 비밀번호가 지워질 수 있어(linkExistingAccount) 'Google'만 남기도 한다.
 */
export function loginMethods(hasPassword: boolean, providers: string[]): LoginMethod[] {
  const set = new Set<LoginMethod>();
  if (hasPassword) set.add('email');
  for (const provider of providers)
    if (provider === 'google' || provider === 'kakao') set.add(provider);
  return LOGIN_METHODS.filter((method) => set.has(method));
}

export type MemberFilter = {
  query: string;
  /** '' = 전체 */
  method: LoginMethod | 'none' | '';
  role: 'producer' | 'actor' | '';
  status: 'active' | 'suspended' | '';
};

export function matchesMember(
  member: {
    email: string;
    name: string;
    phone: string;
    orgName: string;
    role: string;
    methods: LoginMethod[];
    suspendedAt: string | null;
  },
  filter: MemberFilter,
) {
  const query = filter.query.trim().toLowerCase();
  if (
    query &&
    ![member.email, member.name, member.phone, member.orgName].some((text) =>
      text.toLowerCase().includes(query),
    )
  )
    return false;
  if (filter.method === 'none' && member.methods.length) return false;
  if (filter.method && filter.method !== 'none' && !member.methods.includes(filter.method))
    return false;
  if (filter.role && member.role !== filter.role) return false;
  if (filter.status === 'active' && member.suspendedAt) return false;
  if (filter.status === 'suspended' && !member.suspendedAt) return false;
  return true;
}

/** CSV 한 칸. 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다. 엑셀이 수식으로 읽지 않게 =,+,-,@로 시작하면 앞에 '를 붙인다. */
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 엑셀에서 한글이 깨지지 않도록 맨 앞에 BOM을 붙인 CSV */
export function toCsv(rows: unknown[][]) {
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
