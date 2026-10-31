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
