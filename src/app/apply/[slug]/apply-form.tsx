'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandIcon, BrandLogo } from '@/components/brand';
import type { ProducerIntro, Project } from '@/lib/accounts';
import {
  PERKS,
  PRODUCTION_TYPES,
  RELEASE_CHANNELS,
  ROLE_GENDERS,
  ROLE_TYPES,
  NO_SPECIAL_SCENE,
  ageRangeLabel,
  specialScenesLabel,
} from '@/lib/project-meta';
import { formatDates, formatPeriod } from '@/lib/schedule';
import type { Role } from '@/lib/types';
import { saveReceipt } from '@/lib/receipts';
import { pushRecent, RECENT_ROLES } from '@/lib/recent';
import { MAX_APPLICATION_PHOTOS } from '@/lib/validation';

export type Prefill = {
  name: string;
  email: string;
  phone: string;
  age: number | null;
  introduction: string;
  photoUrl: string;
  photos: string[];
  videoUrl: string;
  skill: string;
  unavailable: boolean;
};

/** 값이 있는 줄만 보여 준다. 칸이 생기기 전 공고는 예전처럼 기본 정보만 나온다. */
function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ApplyForm({
  role,
  project,
  prefill,
  producer,
  proposalId,
}: {
  role: Role;
  project: Project | null;
  prefill: Prefill | null;
  producer: ProducerIntro | null;
  proposalId: string;
}) {
  const [step, setStep] = useState<'brief' | 'form'>('brief');
  const home = prefill ? '/me' : '/actor';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(true);
  // 프로필 사진 중 이 공고에 낼 사진. 첫 번째가 대표 사진이 된다.
  const [picked, setPicked] = useState<string[]>(prefill?.photos.slice(0, 1) ?? []);
  const closed = role.isClosed || role.deadline < new Date().toISOString().slice(0, 10);

  /** 고르면 뒤에 붙고, 이미 고른 사진을 누르면 빠진다. 남은 첫 장이 대표 사진이 된다. */
  function togglePhoto(url: string) {
    setPicked((current) =>
      current.includes(url)
        ? current.filter((item) => item !== url)
        : current.length >= MAX_APPLICATION_PHOTOS
          ? current
          : [...current, url],
    );
  }

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // 본 공고를 '최근 본 공고'에 남긴다 (지원하지 않고 닫아도 다시 찾아갈 수 있게).
  useEffect(() => {
    pushRecent(RECENT_ROLES, {
      id: role.id,
      name: role.projectTitle,
      sub: `${role.title} · ${role.location}`,
      photo: role.posterUrl || '',
      href: `/apply/${role.slug}`,
    });
  }, [role.id, role.projectTitle, role.title, role.location, role.slug, role.posterUrl]);

  function begin() {
    setStep('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void fetch('/api/applications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleSlug: role.slug }),
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!navigator.onLine) {
      setError(
        '연결이 끊겼습니다. 입력 내용은 화면에 남아 있습니다. 다시 연결한 뒤 제출해 주세요.',
      );
      return;
    }
    setBusy(true);
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          // 프로필에서 고른 사진이 있으면 그걸 쓰고, 없으면 직접 넣은 사진 링크를 쓴다.
          photoUrls: picked.length > 0 ? picked : [body.photoUrl].filter(Boolean),
          roleSlug: role.slug,
          proposalId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '접수하지 못했습니다.');
      saveReceipt({
        token: data.receiptToken,
        name: String(body.name || ''),
        projectTitle: role.projectTitle,
        roleTitle: role.title,
        submittedAt: new Date().toISOString(),
      });
      location.href = `/status/${data.receiptToken}`;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '접수하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell applicant-shell">
      <header className="apply-header">
        <Link href={home} className="apply-brand" style={{ color: 'inherit' }}>
          <BrandLogo size={26} />
        </Link>
        <Link href={home} className="text-button">
          {prefill ? '내 홈' : '배역 목록'}
        </Link>
      </header>
      {!online && (
        <div className="offline-banner" role="status">
          오프라인 상태입니다. 지원서를 제출할 수 없습니다.
        </div>
      )}
      {step === 'brief' ? (
        <div className="apply-content">
          <div className={`apply-cover${role.posterUrl ? ' has-poster' : ''}`}>
            <span className="cover-kicker">CASTING CALL</span>
            {role.posterUrl ? (
              // 제작진이 올린 작품 포스터
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="cover-poster"
                src={role.posterUrl}
                alt={`${role.projectTitle} 포스터`}
              />
            ) : (
              <span className="cover-star">
                <BrandIcon name="sparkle" size={64} />
              </span>
            )}
            <div>
              <p>{role.projectTitle}</p>
              <h1>{role.title}</h1>
            </div>
          </div>
          <div className="apply-intro">
            <span className="role-state">{closed ? '지원 마감' : '지원 접수 중'}</span>
            <h2>
              이 배역에
              <br />
              함께해 주세요
            </h2>
            {project?.logline && <p className="apply-logline">“{project.logline}”</p>}
            <p>{role.description}</p>
          </div>
          {/* 특수 장면 안내는 공고 필수 항목이라 항상 보여 준다. 안내 전 공고는 그렇다고 알린다. */}
          <section
            className={`brief-card scene-card${
              role.specialScenes.length && !role.specialScenes.includes(NO_SPECIAL_SCENE)
                ? ' has-scenes'
                : ''
            }`}
          >
            <h3>특수 장면 안내</h3>
            {role.specialScenes.length === 0 ? (
              <p className="scene-empty">
                제작진이 아직 안내하지 않았어요. 지원 전에 담당자에게 꼭 확인해 주세요.
              </p>
            ) : (
              <>
                <div>
                  <span>해당 장면</span>
                  <strong>{specialScenesLabel(role.specialScenes)}</strong>
                </div>
                {role.specialNote && <p className="scene-note">{role.specialNote}</p>}
              </>
            )}
          </section>
          {(role.roleType || role.gender || role.ageMin > 0 || role.ageMax > 0) && (
            <section className="brief-card">
              <h3>배역 조건</h3>
              <Row label="비중" value={ROLE_TYPES[role.roleType] ?? ''} />
              <Row label="성별" value={ROLE_GENDERS[role.gender] ?? ''} />
              <Row label="연령대" value={ageRangeLabel(role.ageMin, role.ageMax)} />
              <Row label="모집 인원" value={role.headcount > 1 ? `${role.headcount}명` : ''} />
            </section>
          )}
          {project && (
            <section className="brief-card">
              <h3>작품 정보</h3>
              <Row
                label="형식·장르"
                value={[project.genre, project.genres.join('·')].filter(Boolean).join(' · ')}
              />
              <Row label="제작 구분" value={PRODUCTION_TYPES[project.productionType] ?? ''} />
              <Row label="분량" value={project.runtime} />
              <Row
                label="공개"
                value={[
                  project.releaseChannels.map((value) => RELEASE_CHANNELS[value]).join('·'),
                  project.releasePeriod,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <Row
                label="제작진"
                value={[
                  project.company,
                  project.director && `연출 ${project.director}`,
                  project.producerName && `PD ${project.producerName}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <Row
                label="오디션"
                value={formatPeriod(project.auditionStart, project.auditionEnd)}
              />
              <Row label="리딩·리허설" value={formatPeriod(project.prepStart, project.prepEnd)} />
            </section>
          )}
          <section className="brief-card">
            <h3>촬영과 지원 조건</h3>
            <div>
              <span>촬영일</span>
              <strong>
                {formatDates(role.shootDates, 4) || role.shootDate}
                {project?.shootSessions ? ` · 총 ${project.shootSessions}회차` : ''}
              </strong>
            </div>
            <div>
              <span>촬영 지역</span>
              <strong>{role.location}</strong>
            </div>
            <div>
              <span>출연료</span>
              <strong>{role.pay}</strong>
            </div>
            <Row
              label="제공"
              value={(project?.perks ?? []).map((value) => PERKS[value]).join('·')}
            />
            <div>
              <span>필수 조건</span>
              <strong>{role.requirement || '별도 조건 없음'}</strong>
            </div>
            <div>
              <span>지원 마감</span>
              <strong>{role.deadline}</strong>
            </div>
            <div>
              <span>결과 안내 예정</span>
              <strong>{role.announcementDate}</strong>
            </div>
          </section>
          <section className="brief-card producer-card">
            <h3>이 공고를 올린 제작진</h3>
            <div>
              <span>담당</span>
              <strong>{role.contactName || '미기재'}</strong>
            </div>
            {producer ? (
              <>
                <div>
                  <span>등록자</span>
                  <strong>
                    {producer.name}
                    {producer.orgName ? ` · ${producer.orgName}` : ''}
                  </strong>
                </div>
                <div>
                  <span>소속 유형</span>
                  <strong>{producer.orgType || '미기재'}</strong>
                </div>
                <div>
                  <span>올린 공고</span>
                  <strong>
                    {producer.totalRoles}개
                    {producer.totalRoles > 1 && ` · 모집 중 ${producer.openRoles}개`}
                  </strong>
                </div>
                <div>
                  <span>가입</span>
                  <strong>
                    {producer.memberSince.slice(0, 4)}년 {Number(producer.memberSince.slice(5, 7))}
                    월
                  </strong>
                </div>
                <p className="producer-note">
                  위 내용은 제작자가 직접 등록한 정보입니다. 재학·사업자 확인 절차는 아직 없어서
                  인증 표시는 붙이지 않습니다. 출연료·촬영 조건은 꼭 담당자와 직접 확인해 주세요.
                </p>
              </>
            ) : (
              <p className="producer-note">
                이 공고는 계정에 연결되지 않은 공고입니다. 제작진 정보를 담당자에게 직접 확인해
                주세요.
              </p>
            )}
          </section>
          <p className="small-note">지원 후 접수 상태를 확인할 수 있습니다.</p>
          <button
            className="button button-primary full sticky-action"
            onClick={begin}
            disabled={closed}
          >
            {closed ? '지원이 마감되었습니다' : '이 배역에 지원하기'}
          </button>
        </div>
      ) : (
        <div className="apply-content">
          <button className="back-link" onClick={() => setStep('brief')}>
            ← 배역 정보
          </button>
          <p className="eyebrow">
            {role.projectTitle} · {role.title}
          </p>
          <h1 className="form-heading">지원서 작성</h1>
          <p className="muted">
            {prefill
              ? '프로필 정보로 미리 채워 두었어요. 이 배역에 맞게 수정한 뒤 참여 조건만 답해 주세요.'
              : '연락 가능한 정보와 연기 자료를 남겨 주세요. 제출 후 수정이 필요하면 제작팀에 문의해 주세요.'}
          </p>
          <form className="application-form" onSubmit={submit}>
            <div className="form-section-title">
              기본 정보 <span>01 / 03</span>
            </div>
            <label>
              이름 <em>필수</em>
              <input
                name="name"
                required
                maxLength={80}
                autoComplete="name"
                defaultValue={prefill?.name}
                placeholder="본명을 입력해 주세요"
              />
            </label>
            <div className="form-two">
              <label>
                나이
                <input
                  name="age"
                  type="number"
                  min="1"
                  max="120"
                  inputMode="numeric"
                  defaultValue={prefill?.age ?? undefined}
                  placeholder="선택"
                />
              </label>
              <label>
                연락처 <em>필수</em>
                <input
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  defaultValue={prefill?.phone}
                  placeholder="010-0000-0000"
                />
              </label>
            </div>
            <label>
              이메일 <em>필수</em>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={prefill?.email}
                placeholder="example@email.com"
              />
            </label>
            <div className="form-section-title">
              프로필과 자료 <span>02 / 03</span>
            </div>
            <label>
              소개와 연기 경험 <em>필수</em>
              <textarea
                name="introduction"
                required
                rows={5}
                maxLength={2000}
                defaultValue={prefill?.introduction}
                placeholder="출연작, 연기 경험, 이 배역에 전하고 싶은 내용을 적어 주세요"
              />
            </label>
            {prefill && prefill.photos.length > 0 ? (
              <div className="apply-photos">
                <span className="apply-photos-head">
                  이 공고에 낼 사진
                  <small>
                    {picked.length > 0
                      ? `${picked.length}장 선택 · 첫 번째가 대표 사진`
                      : '한 장 이상 골라 주세요'}
                  </small>
                </span>
                <div className="photo-pick">
                  {prefill.photos.map((url) => {
                    const order = picked.indexOf(url);
                    return (
                      <button
                        key={url}
                        type="button"
                        aria-pressed={order >= 0}
                        className={order >= 0 ? 'on' : ''}
                        onClick={() => togglePhoto(url)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" />
                        {order === 0 && <b className="pp-main">대표</b>}
                        {order > 0 && <b className="pp-order">{order + 1}</b>}
                      </button>
                    );
                  })}
                </div>
                <small className="muted">
                  프로필에 올려 둔 사진이에요. 배역 느낌에 맞는 사진을 골라 공고마다 다르게 낼 수
                  있어요.{' '}
                  <Link href="/me/profile#photos" className="text-button">
                    사진 추가·수정
                  </Link>
                </small>
              </div>
            ) : (
              <label>
                사진 링크
                <input
                  name="photoUrl"
                  inputMode="url"
                  defaultValue={prefill?.photoUrl}
                  placeholder="https://... (선택)"
                />
                <small>
                  공유 가능한 프로필 사진 링크를 넣어 주세요. 회원으로 로그인하면 프로필에 올린
                  사진에서 바로 고를 수 있어요.
                </small>
              </label>
            )}
            <label>
              연기 영상 링크 <em>필수</em>
              <input
                name="videoUrl"
                type="url"
                inputMode="url"
                required
                defaultValue={prefill?.videoUrl}
                placeholder="https://..."
              />
              <small>유튜브, 비메오 또는 공유 가능한 영상 링크</small>
            </label>
            <label>
              필수 역량 또는 특기
              <input
                name="skill"
                maxLength={300}
                defaultValue={prefill?.skill}
                placeholder="예: 자연스러운 대화 연기"
              />
            </label>
            <div className="form-section-title">
              참여 조건 <span>03 / 03</span>
            </div>
            <label>
              촬영일에 참여할 수 있나요? <em>필수</em>
              {prefill?.unavailable && (
                <small className="warn">프로필에 이 촬영일을 출연 불가로 등록해 두셨어요.</small>
              )}
              <select name="available" required defaultValue="">
                <option value="" disabled>
                  선택해 주세요
                </option>
                <option value="yes">가능</option>
                <option value="no">불가</option>
                <option value="unsure">일정 조율 필요</option>
              </select>
            </label>
            <label>
              촬영 지역으로 이동할 수 있나요? <em>필수</em>
              <select name="travel" required defaultValue="">
                <option value="" disabled>
                  선택해 주세요
                </option>
                <option value="yes">가능</option>
                <option value="no">불가</option>
                <option value="unsure">확인 필요</option>
              </select>
            </label>
            <label>
              출연료 조건을 확인했나요? <em>필수</em>
              <select name="payAccepted" required defaultValue="">
                <option value="" disabled>
                  선택해 주세요
                </option>
                <option value="yes">확인하고 수용함</option>
                <option value="no">조건이 맞지 않음</option>
                <option value="unsure">문의가 필요함</option>
              </select>
            </label>
            <p className="small-note">
              지원 내용은 해당 배역의 제작진이 검토합니다. 접수 링크는 제출 후 이 기기에서 보관해
              주세요.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary full" type="submit" disabled={busy || !online}>
              {busy ? '접수 중…' : '지원서 제출하기'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
