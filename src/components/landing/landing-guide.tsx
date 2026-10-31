'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BrandIcon } from '@/components/brand';
import { DemoEntry } from '@/components/demo-entry';
import {
  ActorHomeScreen,
  ApplicantsScreen,
  BoardScreen,
  CompareScreen,
  Phone,
  ProducerSearchScreen,
  ProfileDraftScreen,
  RolesScreen,
  StatusScreen,
} from './previews';
import s from './landing.module.css';

/** 소개를 볼 역할. 계정 역할이나 가입과는 관계없고, 첫 화면의 안내 내용만 바꾼다. */
export type ViewRole = 'producer' | 'actor';

type Step = {
  title: string;
  desc: string;
  outcome: string;
  label: string;
  tone: 'ice' | 'lime' | 'dark';
  screen: React.ReactNode;
};

type RoleContent = {
  name: string;
  icon: 'clapper' | 'masks';
  browse: string;
  browseSub: string;
  title: string;
  lead: string;
  steps: Step[];
  start: { label: string; href: string };
  alt: { label: string; href: string };
  closing: { title: string; text: string };
};

// 단계는 지금 앱에 있는 기능만으로 쓴다. 사용자 수·후기·성과 같은 검증 안 된 내용은 넣지 않는다.
const CONTENT: Record<ViewRole, RoleContent> = {
  producer: {
    name: '제작자',
    icon: 'clapper',
    browse: '제작자로 둘러보기',
    browseSub: '배우 모집·선발',
    title: '지원자가 많아도\n팀과 함께 빠르게 정해요',
    lead: '공고 등록부터 지원 접수, 팀 검토, 최종 비교까지 한 흐름으로 이어져요.',
    steps: [
      {
        title: '공고를 올리고 링크로 지원 받기',
        desc: '배역과 촬영 일정·출연료·특수 장면 안내까지 정해진 항목을 채워 공고를 올려요. 지원 링크를 필름메이커스나 SNS에 붙이면 접수가 시작돼요.',
        outcome: '전체 지원·미검토·오디션 후보 인원이 숫자로 바로 보여요.',
        label: '지원자 화면 예시: 민수 역 공고의 지원 링크와 지원자 수',
        tone: 'ice',
        screen: <ApplicantsScreen />,
      },
      {
        title: '팀원과 함께 후보 추리기',
        desc: '팀 보드에서 지원자를 서류 검토 → 서류 통과 → 오디션 후보로 옮기고, 팀원과 하트와 메모로 의견을 남겨요.',
        outcome: '누가 어떤 의견인지 한 화면에 모여서, 따로 정리할 필요가 없어요.',
        label: '팀 보드 화면 예시: 단계별 후보와 팀원의 하트·메모',
        tone: 'lime',
        screen: <BoardScreen />,
      },
      {
        title: '두 명씩 비교해 최종 결정',
        desc: '이상형 월드컵으로 후보를 1:1로 붙여 가며 최종 1인을 골라요. 고른 배우와는 메시지로 오디션 시간을 정해요.',
        outcome: '비슷한 후보 사이에서도 한 명씩 비교해 확실하게 고를 수 있어요.',
        label: '이상형 월드컵 화면 예시: 두 후보를 나란히 비교',
        tone: 'dark',
        screen: <CompareScreen />,
      },
    ],
    start: { label: '제작자로 시작하기', href: '/signup/producer' },
    alt: { label: '배우 프로필 먼저 보기', href: '/actors' },
    closing: {
      title: '다음 작품의 배우,\n여기서 찾아보세요',
      text: '파일럿 기간에는 제공 중인 기능을 모두 무료로 쓸 수 있어요.',
    },
  },
  actor: {
    name: '배우',
    icon: 'masks',
    browse: '배우로 둘러보기',
    browseSub: '지원·진행 상황',
    title: '프로필 하나로 지원하고\n결과까지 확인해요',
    lead: '배우는 언제나 무료예요. 조건을 먼저 확인하고 지원한 뒤, 진행 상황을 바로 볼 수 있어요.',
    steps: [
      {
        title: '프로필 하나 만들기',
        desc: '갖고 있던 프로필 PDF를 올리면 이름·키·특기·필모그래피를 읽어 입력칸을 먼저 채워요. 어느 줄에서 읽었는지 보고 고른 항목만 넣어요.',
        outcome: '한 번 만든 프로필로 여러 작품에 지원서를 채워요.',
        label: '프로필 편집 화면 예시: PDF에서 읽은 항목 확인',
        tone: 'ice',
        screen: <ProfileDraftScreen />,
      },
      {
        title: '조건을 먼저 보고 지원하기',
        desc: '공고마다 제작진 인증 여부와 촬영 일정·출연료·특수 장면 안내를 지원 전에 확인해요. 가입하지 않아도 지원할 수 있어요.',
        outcome: '인증되지 않은 팀은 ‘이전 작품 이력이 확인되지 않았어요’로 알려 드려요.',
        label: '모집 중인 배역 화면 예시: 인증 배지와 촬영 조건',
        tone: 'lime',
        screen: <RolesScreen />,
      },
      {
        title: '진행 상황 바로 확인하기',
        desc: '미열람 → 검토 중 → 오디션 대상 → 결과까지 지금 단계와 결과 안내 예정일을 보여 줘요. 제작진이 제안한 오디션 시간도 여기서 골라요.',
        outcome: '결과 안내일이 지나도 소식이 없으면 ‘결과 안내 지연’으로 알려 드려요.',
        label: '지원 현황 화면 예시: 오디션 대상 단계와 결과 안내 예정일',
        tone: 'dark',
        screen: <StatusScreen />,
      },
    ],
    start: { label: '배우로 시작하기', href: '/signup/actor' },
    alt: { label: '가입 없이 배역 보기', href: '/actor' },
    closing: {
      title: '다음 작품을\n여기서 만나 보세요',
      text: '배우는 언제나 무료예요. 가입하면 지원한 작품의 진행 상황을 한곳에서 볼 수 있어요.',
    },
  },
};

// 첫 화면 버튼 순서(요청 순서: 배우 → 제작자)
const ORDER: ViewRole[] = ['actor', 'producer'];

export default function LandingGuide({
  initialRole,
  chosenFromUrl,
  home,
  children,
}: {
  initialRole: ViewRole;
  /** 주소에 ?as=가 있어 이미 고른 상태로 들어왔는지 */
  chosenFromUrl: boolean;
  /** 로그인한 사람의 화면 주소. 없으면 로그인 전 방문자. */
  home: string;
  /** 안내와 마지막 시작 버튼 사이에 넣을 서버 화면(요금제) */
  children?: React.ReactNode;
}) {
  const [role, setRole] = useState<ViewRole>(initialRole);
  const [chosen, setChosen] = useState(chosenFromUrl);
  const [armed, setArmed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLElement>(null);
  const content = CONTENT[role];
  const other: ViewRole = role === 'producer' ? 'actor' : 'producer';

  // 스크롤 등장 효과: 아직 안 보인 [data-reveal] 요소를 화면에 들어올 때 표시한다. 역할을 바꾸면 새 내용에 다시 건다.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-in', '');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    root.querySelectorAll('[data-reveal]:not([data-in])').forEach((el) => observer.observe(el));
    setArmed(true);
    return () => observer.disconnect();
  }, [role]);

  /** where: 'guide'는 안내 첫머리로 이동, 'top'은 안내 중간이면 안내 첫머리로, 'stay'는 그대로 */
  function choose(next: ViewRole, where: 'guide' | 'top' | 'stay') {
    setRole(next);
    setChosen(true);
    // 고른 역할을 주소에 남겨 새로고침·공유해도 같은 안내가 보이게 한다(가입·로그인과는 무관).
    const params = new URLSearchParams(window.location.search);
    params.set('as', next);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    const guide = guideRef.current;
    if (!guide) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
    if (where === 'guide' || (where === 'top' && guide.getBoundingClientRect().top < 0))
      guide.scrollIntoView({ behavior, block: 'start' });
  }

  return (
    <div ref={rootRef} className={armed ? s.armed : undefined}>
      <section className={s.hero} id="about">
        <div className={s.heroCopy}>
          <span className="lp-eyebrow">파일럿 운영 중 · 제공 중인 기능 모두 무료</span>
          <h1 className={s.h1}>
            공고부터 합격까지,
            <br />
            <em>한곳에서</em> 캐스팅
          </h1>
          <p className={s.lead}>
            캐스팅플로우는 학생·독립영화 제작팀이 배우를 모집해 팀과 함께 고르고, 신인 배우가 인증된
            공고에 지원해 결과까지 확인하는 캐스팅 플랫폼이에요.
          </p>
          <div className={s.roleButtons} role="group" aria-label="어떤 역할로 둘러볼까요?">
            {ORDER.map((key) => (
              <button
                key={key}
                type="button"
                className={s.roleBtn}
                aria-pressed={chosen && role === key}
                onClick={() => choose(key, 'guide')}
              >
                <BrandIcon name={CONTENT[key].icon} size={30} />
                <span>
                  <strong>{CONTENT[key].browse}</strong>
                  <small>{CONTENT[key].browseSub}</small>
                </span>
              </button>
            ))}
          </div>
          {home ? (
            <Link className={`button button-primary ${s.homeLink}`} href={home}>
              내 화면으로 →
            </Link>
          ) : (
            <>
              <p className={s.heroNote}>
                이미 계정이 있나요? <Link href="/login">로그인</Link>
              </p>
              <DemoEntry />
            </>
          )}
        </div>
        <div>
          <div className={s.heroVisual}>
            <div className={`${s.heroPhone} ${role === 'producer' ? s.front : s.back}`}>
              <Phone label="제작자의 배우 찾기 화면 예시">
                <ProducerSearchScreen />
              </Phone>
            </div>
            <div className={`${s.heroPhone} ${role === 'actor' ? s.front : s.back}`}>
              <Phone label="배우 홈 화면 예시: 프로필 완성도와 받은 캐스팅 제안">
                <ActorHomeScreen />
              </Phone>
            </div>
          </div>
          <p className={s.heroCaption}>실제 서비스 화면 · 이름과 내용은 샘플이에요</p>
        </div>
      </section>

      <section ref={guideRef} className={s.guide} id="guide" aria-label="역할별 사용 방법">
        <div className={s.switchBar}>
          <div className={s.switch} role="group" aria-label="소개를 볼 역할">
            <span className={s.switchLabel}>보는 중</span>
            {ORDER.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={role === key}
                onClick={() => choose(key, 'top')}
              >
                {CONTENT[key].name}
              </button>
            ))}
          </div>
        </div>

        <div key={role} className={`${s.wrap} ${s.swap}`}>
          <div className={s.guideHead}>
            <span className={s.kicker}>
              <BrandIcon name={content.icon} size={22} />
              {content.name}라면 이렇게 써요
            </span>
            <h2>{content.title}</h2>
            <p>{content.lead}</p>
          </div>
          <ol className={s.steps}>
            {content.steps.map((step, index) => (
              <li key={step.title} className={s.step}>
                <div className={s.stepText} data-reveal="">
                  <span className={s.stepNo}>STEP {String(index + 1).padStart(2, '0')}</span>
                  <h3 className={s.stepTitle}>{step.title}</h3>
                  <p className={s.stepDesc}>{step.desc}</p>
                  <p className={s.outcome}>
                    <b>결과</b>
                    <span>{step.outcome}</span>
                  </p>
                </div>
                <div className={`${s.stepVisual} ${s[`tone-${step.tone}`]}`} data-reveal="late">
                  <Phone label={step.label}>{step.screen}</Phone>
                  <span className={s.sample}>화면 예시 · 샘플 데이터</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {children}

      <section className={`${s.wrap} ${s.final}`} id="start">
        <div className={s.finalCard} data-reveal="">
          <span className={s.finalKicker}>
            <BrandIcon name={content.icon} size={22} />
            {content.name}로 보는 중
          </span>
          {home ? (
            <>
              <h2>{'캐스팅을\n이어서 진행해 보세요'}</h2>
              <p>로그인되어 있어요. 내 화면에서 바로 이어갈 수 있어요.</p>
              <div className={s.finalActions}>
                <Link className={`button ${s.ctaMain}`} href={home}>
                  내 화면으로 →
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2>{content.closing.title}</h2>
              <p>{content.closing.text}</p>
              <div className={s.finalActions}>
                <Link className={`button ${s.ctaMain}`} href={content.start.href}>
                  {content.start.label} →
                </Link>
                <Link className={`button button-outline ${s.ctaSub}`} href={content.alt.href}>
                  {content.alt.label}
                </Link>
              </div>
              <p className={s.finalSwitch}>
                <button type="button" onClick={() => choose(other, 'stay')}>
                  {CONTENT[other].name}로 보기
                </button>
                <span aria-hidden>·</span>
                이미 계정이 있나요? <Link href="/login">로그인</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
