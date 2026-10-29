export type ReviewStatus = 'new' | 'reviewing' | 'hold' | 'interested' | 'excluded';
export type PublicStage = 'received' | 'audition' | 'not_selected' | 'cast';

/** 배역 비중. 빈 값은 미지정. */
export type RoleType = 'lead' | 'supporting' | 'minor' | 'extra' | '';
/** 배역 성별 조건. any는 무관, 빈 값은 미지정. */
export type RoleGender = 'male' | 'female' | 'any' | '';
/** 배역 촬영일 정하는 방식. all = 작품 촬영 일정 일괄 적용(기본), custom = 이 배역만 따로 지정. */
export type ShootMode = 'all' | 'custom';

export type Role = {
  id: string;
  slug: string;
  projectTitle: string;
  title: string;
  description: string;
  /** 첫 촬영일. 예전 화면·추천과의 호환을 위해 shootDates의 첫날로 계속 채운다. */
  shootDate: string;
  /** 이 배역의 실제 촬영일 목록(YYYY-MM-DD). all이면 저장할 때 작품 촬영 기간을 날짜로 펼쳐 둔다. */
  shootDates: string[];
  shootMode: ShootMode;
  roleType: RoleType;
  gender: RoleGender;
  /** 연령대. 0이면 제한 없음. */
  ageMin: number;
  ageMax: number;
  /** 모집 인원 */
  headcount: number;
  /** 특수 장면 안내: SPECIAL_SCENES 키 목록. ['none']이면 '특수 장면 없음', 빈 목록이면 아직 안내 안 함. */
  specialScenes: string[];
  /** 특수 장면에 대한 구체적인 안내(촬영 방식·보호 조치 등) */
  specialNote: string;
  location: string;
  pay: string;
  deadline: string;
  contactName: string;
  announcementDate: string;
  requirement: string;
  isClosed: boolean;
  createdAt: string;
  applicationCount?: number;
  newCount?: number;
  shortlistCount?: number;
  ownerId?: string | null;
  projectId?: string | null;
  /** 작품 이미지: 올린 포스터 또는 형식별 기본 커버(projectCover). */
  coverUrl?: string;
  /** 결과 기준일(결과 안내일, 오디션 종료일이 더 늦으면 그날). 날짜가 아니면 ''. */
  resultDueDate?: string;
  /** 아직 결과 전(received)인 지원자 수와 그중 오디션 후보로 표시한 수 */
  pendingCount?: number;
  pendingShortlistCount?: number;
};

export type Application = {
  id: string;
  roleId: string;
  /** 로그인하고 지원했거나 나중에 계정에 연결된 경우의 배우 id (비로그인 지원은 null) */
  actorId: string | null;
  name: string;
  age: number | null;
  email: string;
  phone: string;
  introduction: string;
  /** 대표 사진 (photoUrls의 첫 장) */
  photoUrl: string;
  /** 이 공고에 내려고 고른 사진 전부 */
  photoUrls: string[];
  videoUrl: string;
  available: string;
  travel: string;
  payAccepted: string;
  skill: string;
  note: string;
  status: ReviewStatus;
  shortlist: boolean;
  chatOpen: boolean;
  publicStage: PublicStage;
  /** 제작진이 지원서를 처음 연 시각. null이면 미열람. */
  viewedAt: string | null;
  /** 결과 기준일이 지나 자동으로 결과를 안내한 시각. 제작진이 직접 정하면 null. */
  resultAutoAt: string | null;
  receiptToken: string;
  createdAt: string;
  updatedAt: string;
  roleTitle?: string;
  projectTitle?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSender?: ChatMessage['sender'];
  unreadCount?: number;
  offerStatus?: ChatMessage['status'] | null;
  confirmedSlot?: string;
};

export type Audition = {
  applicationId: string;
  roleId: string;
  name: string;
  photoUrl: string;
  roleTitle: string;
  projectTitle: string;
  slot: string;
  place: string;
};

export type ChatMessage = {
  id: string;
  applicationId: string;
  sender: 'producer' | 'actor';
  kind: 'text' | 'offer';
  body: string;
  slots: string[];
  place: string;
  preparation: string;
  selectedSlot: string;
  status: 'sent' | 'selected' | 'confirmed' | 'declined' | 'change_requested';
  createdAt: string;
};

export const reviewLabels: Record<ReviewStatus, string> = {
  new: '신규',
  reviewing: '검토 중',
  hold: '보류',
  interested: '관심 있음',
  excluded: '제외',
};

/** 제작자가 배우에게 공개하는 결과. 결과를 정하기 전(received)은 배우에게 '미열람·검토 중'으로 보인다. */
export const publicLabels: Record<PublicStage, string> = {
  received: '검토 중',
  audition: '오디션 대상',
  not_selected: '불합격',
  cast: '합격',
};

/** 배우가 보는 지원 현황 단계(기획서: 미열람 → 검토 중 → 오디션 대상 → 합격·불합격). */
export type ActorStage = 'unread' | 'reviewing' | 'audition' | 'cast' | 'not_selected';

export const actorStageInfo: Record<ActorStage, { label: string; message: string }> = {
  unread: { label: '미열람', message: '제작진이 아직 지원서를 열어 보지 않았어요.' },
  reviewing: { label: '검토 중', message: '제작진이 지원서를 확인했어요. 검토 중이에요.' },
  audition: { label: '오디션 대상', message: '오디션 대상이 되었어요. 일정 안내를 기다려 주세요.' },
  cast: { label: '합격', message: '축하해요! 이 배역에 캐스팅되었어요.' },
  not_selected: { label: '불합격', message: '아쉽지만 이번 배역에는 함께하지 못하게 되었어요.' },
};

/** 지원서의 공개 결과와 열람 여부로 배우에게 보여 줄 단계를 정한다. */
export function actorStageOf(
  application: Pick<Application, 'publicStage' | 'viewedAt'>,
): ActorStage {
  if (application.publicStage !== 'received') return application.publicStage;
  return application.viewedAt ? 'reviewing' : 'unread';
}

/** 결과 기준일이 지나 자동으로 불합격을 안내했을 때 배우에게 보여 줄 말 */
export const AUTO_RESULT_MESSAGE =
  '결과 안내일까지 제작진이 결과를 정하지 않아, 이번 지원은 불합격으로 마감되었어요.';

/** 배우에게 보여 줄 단계 설명. 자동으로 안내된 결과는 그렇다는 걸 알려 준다. */
export function actorStageMessage(
  application: Pick<Application, 'publicStage' | 'viewedAt' | 'resultAutoAt'>,
) {
  const stage = actorStageOf(application);
  if (stage === 'not_selected' && application.resultAutoAt) return AUTO_RESULT_MESSAGE;
  return actorStageInfo[stage].message;
}
