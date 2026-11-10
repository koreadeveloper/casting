'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/back-button';
import ProducerNav from '@/components/producer-nav';
import TrustBadges from '@/components/trust-badges';
import { CHAT_FILE_MAX_BYTES } from '@/lib/chat-files';
import type { VerificationRecord } from '@/lib/verifications';

type Slot = { approved?: VerificationRecord; latest?: VerificationRecord };
type Verdict = { approved: boolean; reasons: string[]; orgName: string };

function dateOnly(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
}

async function post(url: string, body: FormData | object) {
  const response = await fetch(url, {
    method: 'POST',
    ...(body instanceof FormData
      ? { body }
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '처리하지 못했어요.');
  return data;
}

/** 서류 한 장을 올려 AI로 바로 판정받는 칸 */
function DocumentUpload({
  kind,
  label,
  hint,
  disabled,
  onVerdict,
}: {
  kind: 'school' | 'business';
  label: string;
  hint: string;
  disabled: boolean;
  onVerdict: (verdict: Verdict) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File | undefined) {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (file.size > CHAT_FILE_MAX_BYTES) {
      setError('파일은 4MB 이하만 올릴 수 있어요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      const data = await post('/api/verify/document', form);
      onVerdict(data.verdict as Verdict);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verify-method">
      <strong>{label}</strong>
      <p>{hint}</p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        hidden
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <button
        className="button button-primary"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? 'AI가 서류를 확인하는 중… (20초 정도)' : '서류 올리기'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** 사업자 정보를 입력해 국세청 진위확인으로 인증하는 칸 */
function BusinessForm({
  disabled,
  orgName,
  onVerdict,
}: {
  disabled: boolean;
  orgName: string;
  onVerdict: (verdict: Verdict) => void;
}) {
  const [businessNumber, setBusinessNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [companyName, setCompanyName] = useState(orgName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await post('/api/verify/business', {
        businessNumber,
        ownerName,
        openDate,
        companyName,
      });
      onVerdict(data.verdict as Verdict);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="verify-method verify-biz" onSubmit={submit}>
      <strong>사업자 정보로 인증 (국세청 조회)</strong>
      <p>
        사업자등록증에 적힌 그대로 입력해 주세요. 국세청 기록과 맞고 계속사업자이면 바로 인증돼요.
        대표자가 아니어도(직원·팀원) 인증할 수 있고, 인증되면 소속명이 상호로 바뀌어 공고에 그대로
        보여요.
      </p>
      <label>
        사업자등록번호
        <input
          inputMode="numeric"
          placeholder="숫자 10자리"
          maxLength={12}
          value={businessNumber}
          onChange={(event) => setBusinessNumber(event.target.value.replace(/[^\d-]/g, ''))}
          required
        />
      </label>
      <label>
        대표자 성명
        <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required />
      </label>
      <label>
        개업일자
        <input
          type="date"
          value={openDate}
          onChange={(event) => setOpenDate(event.target.value)}
          required
        />
      </label>
      <label>
        상호
        <input
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="사업자등록증의 상호(법인명)"
          required
        />
      </label>
      <button className="button button-primary" disabled={disabled || busy}>
        {busy ? '국세청에 조회하는 중…' : '조회하고 인증하기'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/** 학교 이메일로 코드를 받아 인증하는 칸 */
function SchoolEmail({
  disabled,
  onVerdict,
}: {
  disabled: boolean;
  onVerdict: (verdict: Verdict) => void;
}) {
  const [schoolName, setSchoolName] = useState('');
  const [email, setEmail] = useState('');
  const [requestId, setRequestId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  async function send() {
    setBusy(true);
    setError('');
    try {
      const data = await post('/api/verify/school-email', { schoolName, email });
      setRequestId(data.id);
      setSentTo(email);
      setCode('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '보내지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const data = await post('/api/verify/school-email/confirm', { id: requestId, code });
      onVerdict(data.verdict as Verdict);
      setRequestId('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '확인하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verify-method">
      <strong>학교 이메일로 인증</strong>
      <p>학교에서 받은 이메일로 6자리 코드를 보내 드려요. 등록된 대학 메일만 쓸 수 있어요.</p>
      {requestId ? (
        <>
          <p className="verify-sent">{sentTo}로 코드를 보냈어요. 10분 안에 입력해 주세요.</p>
          <input
            className="verify-input"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="6자리 코드"
            aria-label="확인 코드"
          />
          <div className="split-actions">
            <button className="button button-soft" disabled={busy} onClick={() => void send()}>
              다시 보내기
            </button>
            <button
              className="button button-primary"
              disabled={busy || code.length !== 6}
              onClick={() => void confirm()}
            >
              {busy ? '확인 중…' : '인증하기'}
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            className="verify-input"
            value={schoolName}
            onChange={(event) => setSchoolName(event.target.value)}
            placeholder="학교 이름 (예: 한국예술종합학교)"
            aria-label="학교 이름"
          />
          <input
            className="verify-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="학교 이메일 (예: name@karts.ac.kr)"
            aria-label="학교 이메일"
          />
          <button
            className="button button-primary"
            disabled={disabled || busy || !schoolName.trim() || !email.trim()}
            onClick={() => void send()}
          >
            {busy ? '보내는 중…' : '코드 받기'}
          </button>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusLine({ slot, kind }: { slot: Slot; kind: 'school' | 'business' }) {
  if (slot.approved)
    return (
      <p className="verify-status ok">
        인증됨 · {slot.approved.orgName}
        {slot.approved.method !== 'email' && slot.approved.detail
          ? ` ${kind === 'school' ? slot.approved.detail : `(${slot.approved.detail})`}`
          : ''}
        {slot.approved.expiresAt ? ` · ${dateOnly(slot.approved.expiresAt)}까지` : ''}
      </p>
    );
  if (slot.latest?.status === 'rejected')
    return (
      <div className="verify-status no">
        <strong>지난 신청이 승인되지 않았어요</strong>
        <ul>
          {slot.latest.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    );
  return <p className="verify-status">아직 인증하지 않았어요.</p>;
}

/**
 * 카드 제목 옆 표시. 인증됐을 때만 실제 배지를 보이고, 아니면 회색 '미인증'을 보인다.
 * (배우에게 보이는 모습은 화면 위 미리보기에서 따로 보여 준다)
 */
function HeadBadge({ on, kind }: { on: boolean; kind: 'school' | 'business' }) {
  if (!on) return <span className="trust-badge verify-badge-off">미인증</span>;
  return kind === 'school' ? (
    <span className="trust-badge trust-school">학교 인증</span>
  ) : (
    <span className="trust-badge trust-business">제작사 인증됨</span>
  );
}

export default function VerifyClient({
  accountName,
  orgName,
  ready,
  ntsReady,
  businessOpen,
  admin,
  mailReady,
  school,
  business,
}: {
  accountName: string;
  orgName: string;
  ready: boolean;
  ntsReady: boolean;
  /** 제작사 인증을 일반 회원에게 열었는지 */
  businessOpen: boolean;
  /** 관리자는 닫혀 있어도 시험해 볼 수 있다 */
  admin: boolean;
  mailReady: boolean;
  school: Slot;
  business: Slot;
}) {
  const router = useRouter();
  const [result, setResult] = useState<Verdict | null>(null);

  function show(verdict: Verdict) {
    setResult(verdict);
    router.refresh();
  }

  const preview = {
    ...(school.approved ? { school: { name: school.approved.orgName, until: '' } } : {}),
    ...(business.approved ? { business: { name: business.approved.orgName } } : {}),
  };

  return (
    <main className="app-shell wide">
      <ProducerNav active="profile" />
      <div className="screen-pad page-top verify-page">
        <BackButton fallback="/studio?tab=profile" label="뒤로" />
        <h1 className="page-title">제작진 인증</h1>
        <p className="muted verify-lead">
          인증을 받으면 공고 카드에 표시가 붙어 배우가 안심하고 지원할 수 있어요. 학교 인증과 제작사
          인증은 따로 붙고, 둘 다 받으면 둘 다 보여요.
        </p>
        <div className="verify-preview">
          <span>배우에게 보이는 모습</span>
          <TrustBadges badges={preview} withNames />
        </div>

        {!ready && (
          <p className="verify-warn">
            재학증명서 자동 확인(AI)이 아직 설정되지 않았어요. 학교 인증은 학교 메일로 해 주세요.
          </p>
        )}

        {result && (
          <div className={`verify-result ${result.approved ? 'ok' : 'no'}`} role="status">
            {result.approved ? (
              <strong>인증됐어요 · {result.orgName}</strong>
            ) : (
              <>
                <strong>승인되지 않았어요</strong>
                <ul>
                  {result.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <section className="verify-card">
          <div className="verify-head">
            <h2>학교 인증</h2>
            <HeadBadge on={Boolean(school.approved)} kind="school" />
          </div>
          <StatusLine slot={school} kind="school" />
          <p className="small-note">
            대학 영화과·연극과 등 학교 팀용이에요. 1년마다 다시 인증해요.
          </p>
          {!mailReady && (
            <p className="small-note">
              학교 메일 인증은 준비 중이에요. 재학증명서로 인증해 주세요.
            </p>
          )}
          <SchoolEmail disabled={!mailReady} onVerdict={show} />
          <DocumentUpload
            kind="school"
            label="재학증명서로 인증"
            hint={`최근 90일 안에 발급한 재학증명서(사진 또는 PDF). 서류의 이름이 계정 이름(${accountName})과 같아야 해요. 이름이 다르면 ‘내 정보 → 수정’에서 먼저 고쳐 주세요.`}
            disabled={!ready}
            onVerdict={show}
          />
        </section>

        <section className="verify-card">
          <div className="verify-head">
            <h2>제작사 인증</h2>
            <HeadBadge on={Boolean(business.approved)} kind="business" />
          </div>
          <StatusLine slot={business} kind="business" />
          <p className="small-note">인디 제작사·프로덕션용이에요.</p>
          {!businessOpen && !admin ? (
            <p className="verify-warn">
              제작사 인증은 아직 준비 중이에요. 국세청 사업자 조회 연결을 점검하고 있어요. 열리면
              공지로 알려 드릴게요. 그동안 학교 팀은 위의 학교 인증을 이용해 주세요.
            </p>
          ) : (
            <>
              {!businessOpen && (
                <p className="verify-warn">
                  관리자 시험용으로 열려 있어요. 일반 회원에게는 &lsquo;준비 중&rsquo;으로 보여요.
                  조회가 되는지만 볼 때는 일부러 틀린 정보를 넣어 주세요.
                </p>
              )}
              {!ntsReady && (
                <p className="small-note">
                  국세청 사업자 조회를 준비 중이에요. 잠시 뒤에 다시 와 주세요.
                </p>
              )}
              <BusinessForm disabled={!ntsReady} orgName={orgName} onVerdict={show} />
            </>
          )}
        </section>

        <p className="small-note verify-privacy">
          재학증명서는 캐스팅플로우 서버에 저장하지 않아요. 확인을 위해 AI(Anthropic Claude)에 한 번
          보내고, 판정 결과(학교 이름, 승인 여부, 이유)만 남겨요. 사업자 정보는 국세청
          사업자등록정보 진위확인 서비스(공공데이터포털)로 조회하고, 상호와 사업자등록번호 앞 5자리,
          판정 결과만 남겨요. 대표자 성명·개업일자는 저장하지 않아요.
        </p>
      </div>
    </main>
  );
}
