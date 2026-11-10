/* eslint-disable @next/next/no-img-element */
// 첫 화면에서 보여 주는 '실제 화면' 미리보기.
// 앱 화면과 같은 전역 클래스(pcard·stage-steps·proposal-card 등)를 그대로 써서 실제 화면과 똑같이 보이게 하고,
// 데이터는 데모 시드(src/lib/db.ts의 '단편영화 〈봄날〉 · 샘플')와 같은 가상의 이름·사진을 쓴다.
// 실제 기능이 있는 화면만 넣는다(없는 기능·검증 안 된 숫자를 그리지 않는다).
import TrustBadges from '@/components/trust-badges';
import { BrandLogo } from '@/components/brand';
import { demoFace } from '@/lib/demo-faces';
import { projectCover } from '@/lib/project-meta';
import s from './landing.module.css';

/** 휴대폰 틀. 안쪽 화면은 340px 너비로 그린 뒤 틀 크기에 맞춰 줄인다. 화면 읽기 프로그램에는 한 장의 그림으로 읽힌다. */
export function Phone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.phone} role="img" aria-label={label}>
      <div className={s.screen}>
        <span className={s.island} aria-hidden />
        <div className={s.statusBar} aria-hidden>
          9:41
        </div>
        <div className={s.ui}>{children}</div>
      </div>
    </div>
  );
}

function Back({ children }: { children: React.ReactNode }) {
  return <p className={s.uiBack}>‹ {children}</p>;
}

function Title({ sub, children }: { sub?: string; children: React.ReactNode }) {
  return (
    <div className={s.uiTitle}>
      {sub && <p className="greet-sub">{sub}</p>}
      <h1 className="page-title">{children}</h1>
    </div>
  );
}

/* ── 제작자 ─────────────────────────────── */

const searchActors = [
  { name: '박서연', face: 7, line: '24세 · 165cm · 서울', tags: ['청순한', '차분한'] },
  { name: '정하은', face: 4, line: '23세 · 162cm · 서울', tags: ['유쾌한', '사랑스러운'] },
  { name: '한지민', face: 14, line: '24세 · 168cm · 경기', tags: ['도시적인', '단단한'] },
  { name: '서예린', face: 13, line: '22세 · 160cm · 서울', tags: ['개성 있는', '밝은'] },
];

/** 배우 찾기(/studio/actors): 조건으로 거르고 관심 배우를 저장한다. */
export function ProducerSearchScreen() {
  return (
    <>
      <Title sub="조건에 맞는 배우를 찾아 직접 제안하세요">배우 찾기</Title>
      <div className={s.uiChips}>
        <span className={s.chipOn}>여성</span>
        <span className={s.chipOn}>20대</span>
        <span className={s.chipOn}>서울·경기</span>
        <span className={s.chipOn}>촬영일 가능</span>
        <span className={s.chip}>특기</span>
      </div>
      <div className="actor-grid">
        {searchActors.map((actor, index) => (
          <div key={actor.name} className="actor-tile">
            <div className="tile-photo">
              <img src={demoFace(actor.face)} alt="" />
            </div>
            <span className={`heart${index === 1 ? ' on' : ''}`}>{index === 1 ? '♥' : '♡'}</span>
            <div className="tile-info">
              <strong>{actor.name}</strong>
              <span>{actor.line}</span>
              <span className="avail-note avail-ok">촬영일 가능</span>
              <div className="tag-row">
                {actor.tags.map((tag) => (
                  <i key={tag}>{tag}</i>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const applicants = [
  {
    name: '김도윤',
    face: 2,
    line: '26세 · 단편 3편, 독립영화 주연 경험',
    chip: ['chip-new', '신규'],
  },
  {
    name: '박서연',
    face: 7,
    line: '24세 · 독립영화 2편, 웹드라마 조연',
    chip: ['chip-reviewing', '검토 중'],
  },
  {
    name: '이준호',
    face: 9,
    line: '25세 · 단편 4편, 연극 무대 경험',
    chip: ['chip-interested', '관심 있음'],
  },
];

/** 프로젝트의 지원자 화면: 지원 링크를 공유하고 접수 현황을 숫자로 본다. */
export function ApplicantsScreen() {
  return (
    <>
      <div className={s.uiLogo}>
        <BrandLogo size={24} />
      </div>
      <Back>프로젝트</Back>
      <Title sub="단편영화 〈봄날〉 · 샘플">지원자</Title>
      <div className={s.uiRoleBox}>
        <div className={s.uiRoleHead}>
          <div>
            <strong>민수 역 · 접수 중</strong>
            <small>촬영 11/9 · 서울 마포구 · 11월 6일 마감</small>
          </div>
          <span className={s.uiLive}>모집 중</span>
        </div>
        <div className={s.uiBtnRow}>
          <span>지원 링크 복사</span>
          <span>지원 화면 보기</span>
          <span>접수 마감</span>
        </div>
      </div>
      <div className={s.uiStats}>
        <div>
          <b>10</b>
          <span>전체 지원</span>
        </div>
        <div>
          <b>7</b>
          <span>미검토</span>
        </div>
        <div>
          <b>0</b>
          <span>오디션 후보</span>
        </div>
      </div>
      <div className={s.uiList}>
        {applicants.map((person) => (
          <div key={person.name} className={s.uiPerson}>
            <img src={demoFace(person.face)} alt="" />
            <div>
              <strong>{person.name}</strong>
              <small>{person.line}</small>
            </div>
            <span className={`status-chip ${person.chip[0]}`}>{person.chip[1]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/** 팀 보드(/studio/board): 단계를 함께 옮기고 하트·메모를 남긴다. */
export function BoardScreen() {
  return (
    <>
      <Back>뒤로</Back>
      <Title sub="팀원과 함께 지원자를 검토하세요">팀 보드</Title>
      <div className={s.uiMembers}>
        <span className={s.uiAvatar}>지현</span>
        <span className={`${s.uiAvatar} ${s.uiAvatarAlt}`}>민지</span>
        <span className={s.uiInvite}>+ 팀원 초대</span>
      </div>
      <div className={s.uiStages}>
        <div className={s.uiStageOn}>
          <small>01</small>
          <span>서류 검토</span>
          <b>3</b>
        </div>
        <div>
          <small>02</small>
          <span>서류 통과</span>
          <b>2</b>
        </div>
        <div>
          <small>03</small>
          <span>오디션 후보</span>
          <b>1</b>
        </div>
      </div>
      <div className={s.uiBoardCard}>
        <img src={demoFace(2)} alt="" />
        <div>
          <strong>김도윤</strong>
          <small>26세 · 단편 3편, 독립영화 주연 경험</small>
          <span className={s.uiHearts}>♥ 2 · 지현, 민지</span>
        </div>
      </div>
      <p className={s.uiMemo}>
        <b>민지</b> 대화 장면 톤이 배역이랑 잘 맞아요. 오디션 때 2장 대사로 보고 싶어요.
      </p>
      <div className={s.uiMoveRow}>
        <span>보류</span>
        <span className={s.uiMoveOn}>서류 통과로 옮기기 →</span>
      </div>
      <div className={s.uiBoardCard}>
        <img src={demoFace(9)} alt="" />
        <div>
          <strong>이준호</strong>
          <small>25세 · 단편 4편, 연극 무대 경험</small>
          <span className={s.uiHearts}>♥ 1 · 지현</span>
        </div>
      </div>
    </>
  );
}

/** 이상형 월드컵(/studio/compare): 두 명씩 붙여 최종 1인을 고른다. */
export function CompareScreen() {
  return (
    <>
      <Back>뒤로</Back>
      <Title sub="두 명씩 골라 최종 1인을 뽑습니다">이상형 월드컵</Title>
      <div className={s.uiRound}>
        <span>8강 · 2/4 경기</span>
        <small>25%</small>
      </div>
      <div className={s.uiProgress}>
        <i style={{ width: '25%' }} />
      </div>
      <div className={s.uiVs}>
        <div className={s.uiPick}>
          <img src={demoFace(2)} alt="" />
          <strong>김도윤</strong>
          <small>26세 · 서울</small>
          <p>단편 3편, 독립영화 주연 경험</p>
        </div>
        <span className={s.uiVsBadge}>VS</span>
        <div className={s.uiPick}>
          <img src={demoFace(9)} alt="" />
          <strong>이준호</strong>
          <small>25세 · 서울</small>
          <p>단편 4편, 연극 무대 경험</p>
        </div>
      </div>
      <p className={s.uiHint}>더 어울리는 후보를 탭해 주세요.</p>
    </>
  );
}

/* ── 배우 ─────────────────────────────── */

/** 배우 홈(/me): 프로필 완성도와 받은 캐스팅 제안. */
export function ActorHomeScreen() {
  return (
    <>
      <Title sub="김도윤님, 안녕하세요.">오늘의 오디션</Title>
      <div className="completion-card">
        <div>
          <strong>프로필 완성도 92%</strong>
          <span>프로필을 채울수록 제작자 검색에 잘 보이고, 지원서가 자동으로 채워져요.</span>
        </div>
        <div className="bar">
          <i style={{ width: '92%' }} />
        </div>
      </div>
      <div className={`section-head ${s.uiSection}`}>
        <h2>받은 캐스팅 제안</h2>
        <span className="muted">1건 대기</span>
      </div>
      <div className="proposal-card">
        <div className="pc-head">
          <span className="status-chip chip-new">새 제안</span>
          <small>2026. 10. 27.</small>
        </div>
        <strong>단편영화 〈봄날〉 · 민수 역</strong>
        <p className="pc-from">이지현 · 한빛대 영화과 졸업작품팀</p>
        <p className="pc-msg">
          프로필을 보고 배역과 잘 어울리실 것 같아 제안드립니다. 대본 일부를 보내드릴 테니 편하게
          확인해 주세요.
        </p>
        <div className="pc-actions">
          <span className="button button-outline sm">거절</span>
          <span className="button button-primary sm">배역 보고 지원하기 →</span>
        </div>
      </div>
    </>
  );
}

const draftRows: [string, string, string][] = [
  ['이름', '김도윤', '이름: 김도윤'],
  ['출생 연도', '2000년', '생년월일 2000.04.12'],
  ['키', '178cm', '신장 178cm / 체중 68kg'],
  ['활동 지역', '서울', '거주지: 서울 마포구'],
  ['특기', '검도, 영어', '특기: 검도, 영어'],
  ['필모그래피', '단편 〈여름의 끝〉 주연 외 2편', '2025 단편 〈여름의 끝〉 주연'],
];

/** 프로필 편집(/me/profile): PDF를 읽어 입력칸을 먼저 채운다. 어느 줄에서 읽었는지 함께 보여 준다. */
export function ProfileDraftScreen() {
  return (
    <>
      <Back>내 프로필</Back>
      <Title>프로필 편집</Title>
      <div className={s.uiCard}>
        <strong className={s.uiCardTitle}>
          프로필 PDF로 먼저 채우기 <small>선택</small>
        </strong>
        <div className={s.uiFile}>
          <span>PDF</span>
          김도윤_프로필.pdf
        </div>
        <div className="draft-result">
          <strong>6개 항목을 읽었어요</strong>
          <p className="muted small">채울 항목을 확인해 주세요.</p>
          {draftRows.map(([label, value, source]) => (
            <div key={label} className="draft-row">
              <span className={s.uiCheck}>✓</span>
              <span className="draft-label">{label}</span>
              <span className="draft-value">{value}</span>
              <small className="draft-source">{source}</small>
            </div>
          ))}
          <span className={`button button-primary sm ${s.uiFull}`}>고른 항목 채우기</span>
        </div>
      </div>
    </>
  );
}

const openRoles = [
  {
    format: '단편영화',
    project: '단편영화 〈봄날〉',
    role: '민수 역',
    org: '한빛대 영화과 졸업작품팀',
    tags: '단편영화 · 주연 · 남성 · 20대',
    meta: '촬영 11월 9일 · 서울 마포구',
    pay: '1일 15만 원 · 교통비 별도',
    deadline: '11월 6일 마감',
    verified: true,
  },
  {
    format: '웹드라마',
    project: '웹드라마 〈다시, 여름〉',
    role: '수아 역',
    org: '독립 제작팀',
    tags: '웹드라마 · 조연 · 여성 · 20대',
    meta: '촬영 11월 15일 · 경기 고양시',
    pay: '회차당 10만 원',
    deadline: '11월 10일 마감',
    verified: false,
  },
];

/** 배역 목록(/actor): 인증 배지와 촬영 조건·출연료를 지원 전에 확인한다. */
export function RolesScreen() {
  return (
    <>
      <Title sub="배우는 언제나 무료 · 가입 없이도 지원할 수 있어요">오늘의 오디션</Title>
      <div className={`section-head ${s.uiSection}`}>
        <h2>모집 중인 배역</h2>
      </div>
      {openRoles.map((role) => (
        <div key={role.project} className="pcard role-link">
          <div className="pcard-top">
            <div className="pcard-img" style={{ width: 88, height: 112 }}>
              <img src={projectCover(role.format)} alt="" />
            </div>
            <div className="pcard-info">
              <span className="badge-soft">{role.deadline}</span>
              <h3>{role.project}</h3>
              <p className="sub">{role.role}</p>
              <p className="org-line">{role.org}</p>
              <TrustBadges
                badges={
                  role.verified
                    ? { school: { name: '한빛대학교', until: '2027-10-31' } }
                    : undefined
                }
              />
              <p className="role-tags">{role.tags}</p>
              <p className="meta">
                {role.meta}
                <br />
                {role.pay}
              </p>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/** 지원 현황(/status/…): 지금 단계와 결과 안내 예정일, 오디션 시간 선택. */
export function StatusScreen() {
  const steps = ['미열람', '검토 중', '오디션 대상', '결과'];
  return (
    <>
      <Back>배역 정보</Back>
      <div className="mini-proj">
        <div className="mp-main">
          <span className="badge-soft mp-badge">모집 중</span>
          <strong>단편영화 〈봄날〉</strong>
          <span>민수 역 · 한빛대 영화과 졸업작품팀</span>
        </div>
        <div className="mp-photo">
          <img src={projectCover('단편영화')} alt="" />
        </div>
      </div>
      <div className="status-card stage-card stage-audition">
        <div className="stage-head">
          <span className="status-orb">✓</span>
          <div>
            <strong>오디션 대상</strong>
            <p>오디션 대상이 되었어요. 일정 안내를 기다려 주세요.</p>
          </div>
        </div>
        <ol className="stage-steps">
          {steps.map((step, index) => (
            <li key={step} className={index < 2 ? 'done' : index === 2 ? 'on' : ''}>
              <b>{index + 1}</b>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="info-panel">
        <div>
          <span>결과 안내 예정</span>
          <strong>11월 7일</strong>
        </div>
        <div>
          <span>촬영</span>
          <strong>11월 9일 · 서울 마포구</strong>
        </div>
      </div>
      <div className={s.uiCard}>
        <strong className={s.uiCardTitle}>오디션 시간 제안</strong>
        <p className={s.uiCardNote}>제작진이 제안한 오디션 시간입니다.</p>
        <div className={s.uiSlots}>
          <span className={s.uiSlotOn}>11/3 14:00</span>
          <span>11/3 16:00</span>
          <span>11/4 11:00</span>
        </div>
      </div>
    </>
  );
}

/* ── 웹(데스크톱) 화면 ─────────────────────── */
// 넓은 화면에서 들어온 방문자에게는 휴대폰 틀 대신 브라우저 창으로 보여 준다.
// 실제 앱처럼 제작자·배우 홈은 왼쪽 메뉴 + 넓은 본문(app-shell wide), 배역 목록·지원 현황은 가운데 좁은 화면(app-shell narrow)이다.

/** 실제 앱 왼쪽 메뉴(ProducerNav·ActorNav)와 같은 항목과 순서 */
const NAV_ITEMS = {
  producer: [
    '프로젝트',
    '배우 찾기',
    '메시지',
    '배우 추천',
    '이상형 월드컵',
    '팀 보드',
    '캘린더',
    '프로젝트 등록',
    '내 정보',
  ],
  actor: ['홈', '프로필 관리', '미리보기', '로그아웃'],
} as const;

export type BrowserLayout =
  | { nav: 'producer'; active: (typeof NAV_ITEMS)['producer'][number] }
  | { nav: 'actor'; active: (typeof NAV_ITEMS)['actor'][number] }
  | { nav: 'none' };

/** 브라우저 창 틀. 안쪽은 880px 너비의 웹 화면으로 그린 뒤 틀 크기에 맞춰 줄인다. 화면 읽기 프로그램에는 한 장의 그림으로 읽힌다. */
export function Browser({
  label,
  path,
  layout,
  children,
}: {
  label: string;
  /** 주소창에 보일 실제 경로. 도메인은 아직 정해지지 않아 넣지 않는다. */
  path: string;
  layout: BrowserLayout;
  children: React.ReactNode;
}) {
  return (
    <div className={s.browser} role="img" aria-label={label}>
      <div className={s.chrome} aria-hidden>
        <span className={s.dots}>
          <i />
          <i />
          <i />
        </span>
        <span className={s.address}>{path}</span>
      </div>
      <div className={s.viewport}>
        <div className={s.desk}>
          {layout.nav === 'none' ? (
            <div className={s.deskNarrow}>
              <div className={s.deskHeader}>
                <BrandLogo size={24} />
              </div>
              <div className={s.deskNarrowBody}>{children}</div>
            </div>
          ) : (
            <>
              <div className={s.deskSide}>
                <div className={s.deskBrand}>
                  <BrandLogo size={24} />
                </div>
                {NAV_ITEMS[layout.nav].map((item) => (
                  <span key={item} className={item === layout.active ? s.deskNavOn : undefined}>
                    <i />
                    {item}
                  </span>
                ))}
              </div>
              <div className={s.deskMain}>{children}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 웹에서 기존 화면을 본문 가운데 알맞은 너비로 둔다. */
export function WebColumn({ children }: { children: React.ReactNode }) {
  return <div className={s.webColumn}>{children}</div>;
}

const webSearchActors = [
  ...searchActors,
  { name: '윤소희', face: 10, line: '23세 · 163cm · 서울', tags: ['따뜻한', '차분한'] },
  { name: '최유나', face: 1, line: '25세 · 167cm · 경기', tags: ['시크한', '단단한'] },
];

/** 배우 찾기(/studio/actors) 웹: 왼쪽 조건 패널 + 3열 배우 목록 */
export function ProducerSearchWeb() {
  const filters: [string, string][] = [
    ['성별', '여성'],
    ['연령', '20대'],
    ['지역', '서울·경기'],
    ['촬영 가능일', '11월 9일'],
    ['특기', '전체'],
  ];
  return (
    <>
      <Title sub="조건에 맞는 배우를 찾아 직접 제안하세요">배우 찾기</Title>
      <div className={s.webSearch}>
        <div className={s.webFilters}>
          <strong>조건</strong>
          {filters.map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <span className={value === '전체' ? undefined : s.webFilterOn}>{value}</span>
            </div>
          ))}
        </div>
        <div className="actor-grid">
          {webSearchActors.map((actor, index) => (
            <div key={actor.name} className="actor-tile">
              <div className="tile-photo">
                <img src={demoFace(actor.face)} alt="" />
              </div>
              <span className={`heart${index === 1 ? ' on' : ''}`}>{index === 1 ? '♥' : '♡'}</span>
              <div className="tile-info">
                <strong>{actor.name}</strong>
                <span>{actor.line}</span>
                <span className="avail-note avail-ok">촬영일 가능</span>
                <div className="tag-row">
                  {actor.tags.map((tag) => (
                    <i key={tag}>{tag}</i>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** 프로젝트 지원자(/studio) 웹: 공고 정보와 숫자를 한 줄에, 지원자는 표처럼 넓게 */
export function ApplicantsWeb() {
  return (
    <>
      <Back>프로젝트</Back>
      <Title sub="단편영화 〈봄날〉 · 샘플">지원자</Title>
      <div className={s.webApplicantsTop}>
        <div className={s.uiRoleBox}>
          <div className={s.uiRoleHead}>
            <div>
              <strong>민수 역 · 접수 중</strong>
              <small>촬영 11/9 · 서울 마포구 · 11월 6일 마감</small>
            </div>
            <span className={s.uiLive}>모집 중</span>
          </div>
          <div className={s.uiBtnRow}>
            <span>지원 링크 복사</span>
            <span>지원 화면 보기</span>
            <span>접수 마감</span>
          </div>
        </div>
        <div className={s.uiStats}>
          <div>
            <b>10</b>
            <span>전체 지원</span>
          </div>
          <div>
            <b>7</b>
            <span>미검토</span>
          </div>
          <div>
            <b>0</b>
            <span>오디션 후보</span>
          </div>
        </div>
      </div>
      <div className={s.uiList}>
        {applicants.map((person) => (
          <div key={person.name} className={s.uiPerson}>
            <img src={demoFace(person.face)} alt="" />
            <div>
              <strong>{person.name}</strong>
              <small>{person.line}</small>
            </div>
            <span className={`status-chip ${person.chip[0]}`}>{person.chip[1]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

type BoardCard = {
  name: string;
  face: number;
  line: string;
  hearts: string;
  memo?: [string, string];
};

const boardColumns: { title: string; cards: BoardCard[] }[] = [
  {
    title: '서류 검토',
    cards: [
      {
        name: '김도윤',
        face: 2,
        line: '26세 · 단편 3편',
        hearts: '♥ 2 · 지현, 민지',
        memo: ['민지', '대화 장면 톤이 배역이랑 잘 맞아요.'],
      },
      { name: '정민재', face: 11, line: '24세 · 웹드라마 2편', hearts: '♥ 0' },
    ],
  },
  {
    title: '서류 통과',
    cards: [{ name: '이준호', face: 9, line: '25세 · 단편 4편', hearts: '♥ 1 · 지현' }],
  },
  {
    title: '오디션 후보',
    cards: [
      {
        name: '한도현',
        face: 16,
        line: '23세 · 단편 2편',
        hearts: '♥ 2 · 지현, 민지',
        memo: ['지현', '오디션 때 2장 대사로 보고 싶어요.'],
      },
    ],
  },
  { title: '보류', cards: [] },
];

/** 팀 보드(/studio/board) 웹: 단계별 칸에 후보 카드를 나란히 */
export function BoardWeb() {
  return (
    <>
      <Title sub="팀원과 함께 지원자를 검토하세요">팀 보드</Title>
      <div className={s.uiMembers}>
        <span className={s.uiAvatar}>지현</span>
        <span className={`${s.uiAvatar} ${s.uiAvatarAlt}`}>민지</span>
        <span className={s.uiInvite}>+ 팀원 초대</span>
      </div>
      <div className={s.webBoard}>
        {boardColumns.map((column, index) => (
          <div key={column.title} className={s.webColumnLane}>
            <div className={s.webLaneHead}>
              <small>{column.title === '보류' ? '—' : String(index + 1).padStart(2, '0')}</small>
              <span>{column.title}</span>
              <b>{column.cards.length}</b>
            </div>
            {column.cards.length === 0 && <p className={s.webLaneEmpty}>카드가 없어요</p>}
            {column.cards.map((card) => (
              <div key={card.name} className={s.webLaneCard}>
                <div className={s.uiBoardCard}>
                  <img src={demoFace(card.face)} alt="" />
                  <div>
                    <strong>{card.name}</strong>
                    <small>{card.line}</small>
                    <span className={s.uiHearts}>{card.hearts}</span>
                  </div>
                </div>
                {card.memo && (
                  <p className={s.uiMemo}>
                    <b>{card.memo[0]}</b> {card.memo[1]}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
