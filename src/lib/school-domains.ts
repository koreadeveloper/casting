// 학교 메일 인증용 '대학교 이름 ↔ 메일 도메인' 목록과 비교 규칙.
//
// AI 없이 목록만으로 판정한다. 목록은 DB(school_domains 표)에 들어가고, 이 파일의 SCHOOLS가 처음 채울 값이다.
// 목록에 없는 학교는 메일 인증을 받을 수 없고 재학증명서 인증으로 안내한다.
// 학교를 늘릴 때는 SCHOOLS에 한 줄 추가하면 다음 시작 때 DB에 들어간다. (도메인은 학교가 직접 쓰는 것만 넣는다)

export type SchoolEntry = {
  name: string;
  /** 학교가 메일에 쓰는 도메인. 하위 도메인(mail.학교.ac.kr 등)은 따로 적지 않아도 같은 학교로 본다. */
  domains: string[];
  /** 줄임말·영문명 */
  aliases?: string[];
};

export const SCHOOLS: SchoolEntry[] = [
  { name: '서울대학교', domains: ['snu.ac.kr'], aliases: ['서울대', 'SNU'] },
  { name: '연세대학교', domains: ['yonsei.ac.kr'], aliases: ['연세대', 'Yonsei'] },
  { name: '고려대학교', domains: ['korea.ac.kr'], aliases: ['고려대', 'Korea University'] },
  { name: '성균관대학교', domains: ['skku.edu'], aliases: ['성균관대', 'SKKU'] },
  { name: '한양대학교', domains: ['hanyang.ac.kr'], aliases: ['한양대', 'Hanyang'] },
  { name: '중앙대학교', domains: ['cau.ac.kr'], aliases: ['중앙대', 'CAU'] },
  { name: '경희대학교', domains: ['khu.ac.kr'], aliases: ['경희대', 'KHU'] },
  { name: '서강대학교', domains: ['sogang.ac.kr'], aliases: ['서강대', 'Sogang'] },
  { name: '이화여자대학교', domains: ['ewha.ac.kr'], aliases: ['이화여대', '이대', 'Ewha'] },
  { name: '한국외국어대학교', domains: ['hufs.ac.kr'], aliases: ['한국외대', '외대', 'HUFS'] },
  { name: '서울시립대학교', domains: ['uos.ac.kr'], aliases: ['서울시립대', '시립대', 'UOS'] },
  { name: '건국대학교', domains: ['konkuk.ac.kr'], aliases: ['건국대', 'Konkuk'] },
  { name: '동국대학교', domains: ['dongguk.edu', 'dgu.ac.kr'], aliases: ['동국대', 'Dongguk'] },
  { name: '홍익대학교', domains: ['hongik.ac.kr'], aliases: ['홍익대', '홍대', 'Hongik'] },
  { name: '국민대학교', domains: ['kookmin.ac.kr'], aliases: ['국민대', 'Kookmin'] },
  { name: '숭실대학교', domains: ['ssu.ac.kr'], aliases: ['숭실대', 'Soongsil'] },
  { name: '세종대학교', domains: ['sejong.ac.kr'], aliases: ['세종대', 'Sejong'] },
  { name: '단국대학교', domains: ['dankook.ac.kr'], aliases: ['단국대', 'Dankook'] },
  { name: '광운대학교', domains: ['kw.ac.kr'], aliases: ['광운대', 'Kwangwoon'] },
  { name: '명지대학교', domains: ['mju.ac.kr'], aliases: ['명지대', 'Myongji'] },
  { name: '상명대학교', domains: ['smu.ac.kr'], aliases: ['상명대', 'Sangmyung'] },
  { name: '가천대학교', domains: ['gachon.ac.kr'], aliases: ['가천대', 'Gachon'] },
  { name: '인하대학교', domains: ['inha.ac.kr', 'inha.edu'], aliases: ['인하대', 'Inha'] },
  { name: '아주대학교', domains: ['ajou.ac.kr'], aliases: ['아주대', 'Ajou'] },
  { name: '경기대학교', domains: ['kyonggi.ac.kr'], aliases: ['경기대', 'Kyonggi'] },
  { name: '용인대학교', domains: ['yongin.ac.kr'], aliases: ['용인대', 'Yongin'] },
  { name: '수원대학교', domains: ['suwon.ac.kr'], aliases: ['수원대', 'Suwon'] },
  { name: '한성대학교', domains: ['hansung.ac.kr'], aliases: ['한성대', 'Hansung'] },
  { name: '서경대학교', domains: ['skuniv.ac.kr'], aliases: ['서경대', 'Seokyeong'] },
  { name: '숙명여자대학교', domains: ['sookmyung.ac.kr'], aliases: ['숙명여대', '숙대'] },
  { name: '성신여자대학교', domains: ['sungshin.ac.kr'], aliases: ['성신여대', '성신'] },
  { name: '덕성여자대학교', domains: ['duksung.ac.kr'], aliases: ['덕성여대', '덕성'] },
  { name: '동덕여자대학교', domains: ['dongduk.ac.kr'], aliases: ['동덕여대', '동덕'] },
  { name: '서울여자대학교', domains: ['swu.ac.kr'], aliases: ['서울여대'] },
  { name: '한국예술종합학교', domains: ['karts.ac.kr'], aliases: ['한예종', 'K-ARTS', 'KARTS'] },
  { name: '서울예술대학교', domains: ['seoularts.ac.kr'], aliases: ['서울예대', '서예대'] },
  { name: '추계예술대학교', domains: ['chugye.ac.kr'], aliases: ['추계예대'] },
  { name: '청주대학교', domains: ['cju.ac.kr'], aliases: ['청주대'] },
  {
    name: '서울과학기술대학교',
    domains: ['seoultech.ac.kr'],
    aliases: ['서울과기대', '서울과학기술대'],
  },
  { name: '한국과학기술원', domains: ['kaist.ac.kr'], aliases: ['KAIST', '카이스트'] },
  {
    name: '포항공과대학교',
    domains: ['postech.ac.kr'],
    aliases: ['POSTECH', '포스텍', '포항공대'],
  },
  { name: '부산대학교', domains: ['pusan.ac.kr'], aliases: ['부산대', 'PNU'] },
  { name: '경북대학교', domains: ['knu.ac.kr'], aliases: ['경북대', 'KNU'] },
  { name: '전남대학교', domains: ['jnu.ac.kr'], aliases: ['전남대', 'JNU'] },
  { name: '전북대학교', domains: ['jbnu.ac.kr'], aliases: ['전북대', 'JBNU'] },
  { name: '충남대학교', domains: ['cnu.ac.kr'], aliases: ['충남대', 'CNU'] },
  { name: '충북대학교', domains: ['chungbuk.ac.kr'], aliases: ['충북대'] },
  { name: '강원대학교', domains: ['kangwon.ac.kr'], aliases: ['강원대'] },
  { name: '제주대학교', domains: ['jejunu.ac.kr'], aliases: ['제주대'] },
  { name: '영남대학교', domains: ['ynu.ac.kr'], aliases: ['영남대'] },
  { name: '동아대학교', domains: ['donga.ac.kr'], aliases: ['동아대'] },
  { name: '동서대학교', domains: ['dongseo.ac.kr'], aliases: ['동서대'] },
];

export type SchoolDomainRow = { domain: string; schoolName: string; aliases: string[] };

/** 학교 목록을 도메인 한 줄씩 펼친다. DB에 넣을 때와 테스트에서 쓴다. */
export function schoolDomainRows(schools: SchoolEntry[] = SCHOOLS): SchoolDomainRow[] {
  return schools.flatMap((school) =>
    school.domains.map((domain) => ({
      domain: domain.toLowerCase(),
      schoolName: school.name,
      aliases: school.aliases ?? [],
    })),
  );
}

/** 이메일에서 도메인 부분만 꺼낸다. 형식이 이상하면 null. */
export function emailDomain(email: string) {
  const match = /^[^\s@]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i.exec(email.trim());
  return match ? match[1].toLowerCase() : null;
}

/**
 * 메일 도메인이 목록의 어느 학교 것인지 찾는다.
 * 목록 도메인과 같거나 그 하위 도메인(mail.hanyang.ac.kr)이면 같은 학교다.
 * 'hanyang.ac.kr.evil.com'처럼 뒤에 다른 주소가 붙은 것은 걸러진다.
 */
export function findSchoolByDomain(domain: string, rows: SchoolDomainRow[]) {
  const target = domain.toLowerCase();
  let best: SchoolDomainRow | undefined;
  for (const row of rows) {
    if (target !== row.domain && !target.endsWith(`.${row.domain}`)) continue;
    if (!best || row.domain.length > best.domain.length) best = row;
  }
  return best ?? null;
}

/** 이름 비교용: 공백·괄호·대소문자를 없애고 '대학교'/'대학'을 '대'로 줄인다. */
function normalizeName(name: string) {
  return name
    .replace(/[(（][^)）]*[)）]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/대학교$/, '대')
    .replace(/대학$/, '대');
}

/** 사용자가 적은 학교 이름이 그 학교(정식 이름·줄임말)와 같은지 본다. */
export function sameSchoolName(input: string, school: { schoolName: string; aliases: string[] }) {
  const wanted = normalizeName(input);
  if (!wanted) return false;
  return [school.schoolName, ...school.aliases].some((name) => normalizeName(name) === wanted);
}
