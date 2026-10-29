import Link from 'next/link';
import {
  closeOverdueResults,
  getApplicationByReceipt,
  getLatestOffer,
  getRoleById,
} from '@/lib/db';
import { kstToday } from '@/lib/result-deadline';
import { actorStageInfo, actorStageMessage, actorStageOf, type ActorStage } from '@/lib/types';
import ChatThread from '@/components/chat-thread';
import OfferResponse from '@/components/offer-response';
import { projectCover } from '@/lib/project-meta';

export const dynamic = 'force-dynamic';

/**
 * 접수 링크를 찾을 수 없을 때. 예전에는 통째로 404가 떠서 미완성 화면처럼 보였다.
 * 데모 환경은 저장소가 임시 폴더라 서버가 새로 뜨면 접수 기록이 사라질 수 있는데,
 * 링크는 브라우저에 남아 있어서 이 상황이 실제로 자주 생긴다.
 */
function ReceiptNotFound() {
  return (
    <main className="app-shell narrow">
      <header className="sub-header">
        <Link className="sh-back" href="/actor" aria-label="배역 목록으로">
          ‹
        </Link>
        <h1>지원 현황</h1>
        <span className="sh-more" />
      </header>
      <div className="status-wrap">
        <div className="empty-card">
          <strong>이 접수 기록을 찾을 수 없습니다.</strong>
          <p style={{ marginTop: 10, lineHeight: 1.75 }}>
            링크가 잘못되었거나, 체험용 데모 서버가 다시 시작되면서 접수 기록이 초기화된 경우입니다.
            데모에서는 지원 내용이 오래 보관되지 않습니다.
          </p>
        </div>
        <div className="split-actions" style={{ marginTop: 14 }}>
          <Link className="button button-primary" href="/actor">
            모집 중인 배역 보기
          </Link>
          <Link className="button button-soft" href="/me">
            내 지원 현황
          </Link>
        </div>
        <p className="small-note">
          회원으로 로그인해 지원하면 접수 내역이 계정에 남아 &lsquo;내 지원 현황&rsquo;에서 다시 볼
          수 있습니다.
        </p>
      </div>
    </main>
  );
}

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getApplicationByReceipt(token);
  if (!found) return <ReceiptNotFound />;
  // 결과 기준일이 지났는데 아직 결과 전이면 여기서 자동으로 결과를 안내한다.
  const closed = await closeOverdueResults({ applicationId: found.id }, kstToday());
  const application = closed ? ((await getApplicationByReceipt(token)) ?? found) : found;
  const role = await getRoleById(application.roleId);
  if (!role) return <ReceiptNotFound />;
  const resultDue = role.resultDueDate || role.announcementDate;
  const offer = await getLatestOffer(application.id);
  return (
    <main className="app-shell narrow">
      <header className="sub-header">
        <Link className="sh-back" href={`/apply/${role.slug}`} aria-label="배역 정보로">
          ‹
        </Link>
        <h1>{offer ? '오디션 일정' : '지원 현황'}</h1>
        <span className="sh-more" />
      </header>
      <div className="status-wrap">
        <div className="mini-proj">
          <div className="mp-main">
            <span className="badge-soft mp-badge">{role.isClosed ? '지원 마감' : '모집 중'}</span>
            <strong>{role.projectTitle}</strong>
            <span>
              {role.title} · {application.name}
            </span>
          </div>
          <div className="mp-photo">
            {application.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={application.photoUrl} alt={`${application.name} 프로필 사진`} />
            ) : (
              application.name.slice(-2)
            )}
          </div>
        </div>
        <div className="pd-card">
          <div className="avatar">{role.contactName.slice(-2)}</div>
          <div className="pd-main">
            <strong>{role.contactName}</strong>
            <p>프로젝트 관련 문의는 언제든지 대화로 남겨주세요.</p>
          </div>
          {application.chatOpen && <a href="#chat">대화 보기 ›</a>}
        </div>
        <StageProgress
          stage={actorStageOf(application)}
          message={actorStageMessage(application)}
          auto={Boolean(application.resultAutoAt) && application.publicStage === 'not_selected'}
        />
        {offer && <OfferResponse applicationId={application.id} receipt={token} offer={offer} />}
        <div className="info-panel">
          <div>
            <span>접수일</span>
            <strong>
              {new Date(application.createdAt).toLocaleDateString('ko-KR', {
                timeZone: 'Asia/Seoul',
              })}
            </strong>
          </div>
          <div>
            <span>결과 안내 예정</span>
            <strong>{resultDue}</strong>
          </div>
        </div>
        <p className="small-note">
          {application.publicStage === 'received' && role.resultDueDate && (
            <>
              결과 안내 예정일이 지나도록 결과가 정해지지 않으면 다음 날 자동으로 결과가 안내돼요.
              무작정 기다리지 않아도 돼요.
              <br />
            </>
          )}
          이 페이지 주소를 보관하면 공개된 진행 상태를 다시 확인할 수 있습니다. 제작진의 내부 검토
          상태와 메모는 공개되지 않습니다.
        </p>
        {application.chatOpen && (
          <section id="chat" className="actor-chat">
            <ChatThread
              applicationId={application.id}
              mode="actor"
              receipt={token}
              peerName={role.contactName}
              peerSub={`${role.projectTitle} · ${role.title}`}
              projectTitle={role.projectTitle}
              roleTitle={role.title}
              projectImage={role.coverUrl || projectCover('')}
              profileHref={`/apply/${role.slug}`}
            />
          </section>
        )}
      </div>
    </main>
  );
}

// 지원 현황 단계: 미열람 → 검토 중 → 오디션 대상 → 결과(합격·불합격).
const STAGE_STEPS: { key: ActorStage | 'result'; label: string }[] = [
  { key: 'unread', label: '미열람' },
  { key: 'reviewing', label: '검토 중' },
  { key: 'audition', label: '오디션 대상' },
  { key: 'result', label: '결과' },
];

function StageProgress({
  stage,
  message,
  auto,
}: {
  stage: ActorStage;
  message: string;
  /** 결과 기준일이 지나 자동으로 안내된 결과인지 */
  auto: boolean;
}) {
  const done = stage === 'cast' || stage === 'not_selected';
  const current = done ? 3 : STAGE_STEPS.findIndex((step) => step.key === stage);
  const info = actorStageInfo[stage];
  return (
    <div className={`status-card stage-card stage-${stage}`} style={{ marginTop: 14 }}>
      <div className="stage-head">
        <span className="status-orb">{stage === 'not_selected' ? '·' : '✓'}</span>
        <div>
          <strong>
            {info.label}
            {auto && <small className="auto-tag">자동 안내</small>}
          </strong>
          <p>{message}</p>
        </div>
      </div>
      <ol className="stage-steps" aria-label="지원 진행 단계">
        {STAGE_STEPS.map((step, index) => (
          <li
            key={step.key}
            className={index < current ? 'done' : index === current ? 'on' : ''}
            aria-current={index === current ? 'step' : undefined}
          >
            <b>{index + 1}</b>
            <span>{step.key === 'result' && done ? info.label : step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
