'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Application, Audition, PublicStage, ReviewStatus, Role } from '@/lib/types';
import { publicLabels, reviewLabels } from '@/lib/types';
import ChatThread from '@/components/chat-thread';
import { NotifBell } from '@/components/notif-bell';
import { BrandLogo } from '@/components/brand';
import PhotoLightbox from '@/components/photo-lightbox';
import ProducerNav from '@/components/producer-nav';
import type { Project } from '@/lib/accounts';
import { dDayLabel, daysUntilResult, isResultDueSoon, kstToday } from '@/lib/result-deadline';
import { formatDates } from '@/lib/schedule';
import { useBackClose } from '@/lib/use-back-close';
import { projectCover } from '@/lib/project-meta';

type Tab = 'home' | 'applicants' | 'messages' | 'profile';
const TABS: Tab[] = ['home', 'applicants', 'messages', 'profile'];
type Filter = 'all' | 'new' | 'unknown' | 'interested' | 'hold' | 'shortlist';
type Sort = 'newest' | 'oldest' | 'name';

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  if (!navigator.onLine) throw new Error('연결이 끊겼습니다. 다시 연결한 뒤 시도해 주세요.');
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청을 완료하지 못했습니다.');
  return data as T;
}

const Icon = {
  clapper: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.2 5.6 4.9 3.4l.5-1.8a1 1 0 0 1 1.2-.7l14.6 2.2a1 1 0 0 1 .8 1.2l-.4 1.6a1 1 0 0 1-1.4.3Zm.3 2.9H3.5A1.5 1.5 0 0 0 2 10v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9a1.5 1.5 0 0 0-1.5-1.5ZM4 20v-8.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1 1Z" />
    </svg>
  ),
  bell: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 7.5-3 9.5h18c0-2-3-2.5-3-9.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 20.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  ),
  folder: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  users: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" strokeLinecap="round" />
      <path d="M15.5 5.5a3.2 3.2 0 0 1 0 5.6M17.8 14.9c1.6.6 2.6 2 3 4" strokeLinecap="round" />
    </svg>
  ),
  chat: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M21 12a8 8 0 0 1-8 8H4l1.5-3A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
    </svg>
  ),
  user: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.8 3.7-6 7-6s6.2 2.2 7 6" strokeLinecap="round" />
    </svg>
  ),
  calendar: (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.6 12 21 12 21Z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.3" r="2.2" />
    </svg>
  ),
  doc: (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M6 3h8l4 4v14H6V3Z" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 12h6M9 16h6" strokeLinecap="round" />
    </svg>
  ),
  upload: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  out: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l-4 4 4 4M6 12h10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  sparkle: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  vs: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3" y="6" width="8" height="12" rx="2" />
      <rect x="13" y="6" width="8" height="12" rx="2" />
    </svg>
  ),
  columns: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3.5" y="4.5" width="5" height="15" rx="1.6" />
      <rect x="9.7" y="4.5" width="5" height="10" rx="1.6" />
      <rect x="15.9" y="4.5" width="5" height="7" rx="1.6" />
    </svg>
  ),
};

function initials(name: string) {
  return name.slice(-2);
}
/** 같은 작품의 배역을 묶는 기준. 예전 배역은 project_id가 없을 수 있어 작품명으로 대신한다. */
function projectKeyOf(role: Role) {
  return role.projectId || role.projectTitle;
}
/** 탭과 고른 배역을 주소에 담는다. 뒤로가기·새로 고침에도 같은 화면이 열린다. */
function studioUrl(tab: Tab, roleId: string) {
  const params = new URLSearchParams();
  if (tab !== 'home') params.set('tab', tab);
  if (tab === 'applicants' && roleId) params.set('role', roleId);
  const query = params.toString();
  return query ? `/studio?${query}` : '/studio';
}
function conditionLabel(value: string) {
  return value === 'yes' ? '가능' : value === 'no' ? '불가' : '미확인';
}
function formattedDate(date: string) {
  return date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '';
}
function slotLabel(slot: string) {
  const date = new Date(`${slot}:00+09:00`);
  if (Number.isNaN(date.valueOf())) return slot;
  const day = date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  });
  const dow = date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' });
  const time = date.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} (${dow}) ${time}`;
}
function chatTimeLabel(iso: string) {
  const now = new Date();
  const date = new Date(iso);
  const sameDay = (d: Date) =>
    d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) ===
    now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (sameDay(date))
    return date.toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  if (
    date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) ===
    yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  )
    return '어제';
  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  });
}

function Avatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className={className}>
      {photoUrl && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={`${name} 프로필 사진`} onError={() => setImageFailed(true)} />
      ) : (
        initials(name)
      )}
    </div>
  );
}

type ProjectGroup = {
  title: string;
  roles: Role[];
  applications: number;
  newCount: number;
  shortlistCount: number;
  closed: boolean;
};

export default function Studio({
  initialTab,
  userName,
  orgName,
  email,
}: {
  initialTab: Tab;
  userName: string;
  orgName: string;
  email: string;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [recent, setRecent] = useState<Application[]>([]);
  const [auditions, setAuditions] = useState<Audition[]>([]);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [search, setSearch] = useState('');
  const [msgSearch, setMsgSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [auth, setAuth] = useState<'loading' | 'error' | 'ready'>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [online, setOnline] = useState(true);
  const [note, setNote] = useState('');
  const [pendingPublicStage, setPendingPublicStage] = useState<PublicStage | null>(null);
  const [photoAt, setPhotoAt] = useState<number | null>(null);
  // 보관(숨김)한 프로젝트. 홈 맨 아래 '보관한 프로젝트'에서 다시 꺼낼 수 있다.
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const role = roles.find((item) => item.id === roleId);
  const selected = applications.find((item) => item.id === selectedId);
  // 결과 자동 안내 기준(한국 날짜). 배역의 결과 기준일과 비교한다.
  const today = kstToday();
  const chatTarget =
    applications.find((item) => item.id === chatId) || recent.find((item) => item.id === chatId);

  const loadRoles = useCallback(async () => {
    try {
      const result = await api<{ roles: Role[] }>('/api/roles');
      setRoles(result.roles);
      // 주소에 배역이 있으면(뒤로가기·새로 고침·알림 링크) 그 배역을 먼저 연다.
      const fromUrl = new URLSearchParams(location.search).get('role');
      const known = result.roles.some((item) => item.id === fromUrl) ? fromUrl : null;
      setRoleId((current) => current || known || result.roles[0]?.id || '');
      setAuth('ready');
    } catch (error) {
      if (String(error).includes('인증')) {
        location.href = '/login?next=/studio';
        return;
      }
      setAuth('error');
      setMessage(error instanceof Error ? error.message : '제작자 화면을 열지 못했습니다.');
    }
  }, []);

  const loadApplications = useCallback(async (id: string) => {
    if (!id) {
      setApplications([]);
      return;
    }
    try {
      const result = await api<{ applications: Application[] }>(
        `/api/applications?roleId=${encodeURIComponent(id)}`,
      );
      setApplications(result.applications);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.');
    }
  }, []);

  const loadExtras = useCallback(async () => {
    try {
      const [recentResult, auditionResult] = await Promise.all([
        api<{ applications: Application[] }>('/api/applications'),
        api<{ auditions: Audition[] }>('/api/auditions'),
      ]);
      setRecent(recentResult.applications);
      setAuditions(auditionResult.auditions);
    } catch {
      /* 홈 보조 정보는 실패해도 핵심 화면을 막지 않는다 */
    }
  }, []);

  const loadArchived = useCallback(async () => {
    try {
      const result = await api<{ projects: Project[] }>('/api/projects');
      setArchivedProjects(result.projects.filter((project) => project.archivedAt));
    } catch {
      /* 보관함은 실패해도 핵심 화면을 막지 않는다 */
    }
  }, []);

  async function restoreProject(id: string) {
    setBusy(true);
    setMessage('');
    try {
      await api<{ project: Project }>('/api/projects', {
        method: 'PATCH',
        body: JSON.stringify({ id, archived: false }),
      });
      await Promise.all([loadRoles(), loadArchived()]);
      setMessage('프로젝트를 다시 꺼냈습니다. 배역 접수는 마감 상태라 수정 화면에서 열 수 있어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '다시 꺼내지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);
  useEffect(() => {
    if (auth === 'ready') void loadArchived();
  }, [auth, loadArchived]);
  useEffect(() => {
    if (auth === 'ready') {
      void loadApplications(roleId);
      void loadExtras();
    }
  }, [auth, roleId, loadApplications, loadExtras]);
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
  useEffect(() => {
    setNote(selected?.note || '');
    setPendingPublicStage(null);
    setPhotoAt(null);
  }, [selectedId, selected?.note]);
  // 지원자 상세를 처음 열면 '열람'으로 남긴다. 배우 화면에서는 '미열람 → 검토 중'으로 바뀐다.
  const unviewedId = selected && !selected.viewedAt ? selected.id : null;
  useEffect(() => {
    if (!unviewedId) return;
    void api<{ application: Application }>(`/api/applications/${unviewedId}`, {
      method: 'PATCH',
      body: JSON.stringify({ viewed: true }),
    })
      .then((result) =>
        setApplications((current) =>
          current.map((item) =>
            item.id === unviewedId ? { ...item, viewedAt: result.application.viewedAt } : item,
          ),
        ),
      )
      .catch(() => undefined); // 열람 기록이 실패해도 상세 보기는 막지 않는다
  }, [unviewedId]);
  // 뒤로가기·앞으로가기로 주소가 바뀌면 그 주소의 탭과 배역으로 화면을 맞춘다.
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(location.search);
      setTab(TABS.find((item) => item === params.get('tab')) ?? 'home');
      const fromUrl = params.get('role');
      if (fromUrl) setRoleId(fromUrl);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  // 지원자 상세·대화 시트는 뒤로가기로 닫힌다. (사진 크게 보기는 PhotoLightbox 안에서 처리)
  useBackClose(Boolean(selected), () => setSelectedId(null));
  useBackClose(Boolean(chatId), closeChat);

  async function updateApplication(id: string, patch: Partial<Application>) {
    setBusy(true);
    setMessage('');
    try {
      const result = await api<{ application: Application }>(`/api/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setApplications((current) =>
        current.map((item) => (item.id === id ? { ...item, ...result.application } : item)),
      );
      setMessage('저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  // 탭 이동을 브라우저 기록에 남겨 휴대폰·브라우저 뒤로가기로 이전 화면에 돌아갈 수 있게 한다.
  function goTab(next: Tab, nextRoleId?: string) {
    const target = nextRoleId ?? roleId;
    if (nextRoleId) setRoleId(nextRoleId);
    setTab(next);
    const url = studioUrl(next, target);
    if (url !== `${location.pathname}${location.search}`)
      history.pushState({ __csTab: true }, '', url);
    window.scrollTo({ top: 0 });
  }

  // 지원자 화면의 '‹ 프로젝트'. 프로젝트 목록에서 들어왔으면 뒤로, 알림 링크 등으로 바로 왔으면 목록으로.
  function backToProjects() {
    if ((history.state as { __csTab?: boolean } | null)?.__csTab) history.back();
    else goTab('home');
  }

  function closeChat() {
    setChatId(null);
    void loadApplications(roleId);
    void loadExtras();
  }

  async function toggleClosed(target: Role) {
    setBusy(true);
    setMessage('');
    try {
      const result = await api<{ role: Role }>(`/api/roles/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isClosed: !target.isClosed }),
      });
      setRoles((current) => current.map((item) => (item.id === target.id ? result.role : item)));
      setMessage(
        result.role.isClosed ? '지원 접수를 마감했습니다.' : '지원 접수를 다시 열었습니다.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '변경하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function shareRole(target: Role) {
    const url = `${location.origin}/apply/${target.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage('지원 링크를 복사했습니다.');
    } catch {
      setMessage(url);
    }
  }

  const projects = useMemo<ProjectGroup[]>(() => {
    const groups = new Map<string, ProjectGroup>();
    for (const item of roles) {
      const group =
        groups.get(item.projectTitle) ||
        ({
          title: item.projectTitle,
          roles: [],
          applications: 0,
          newCount: 0,
          shortlistCount: 0,
          closed: true,
        } satisfies ProjectGroup);
      group.roles.push(item);
      group.applications += item.applicationCount || 0;
      group.newCount += item.newCount || 0;
      group.shortlistCount += item.shortlistCount || 0;
      if (!item.isClosed) group.closed = false;
      groups.set(item.projectTitle, group);
    }
    return [...groups.values()];
  }, [roles]);

  const filtered = useMemo(() => {
    const matches = applications.filter((item) => {
      if (filter === 'shortlist' && !item.shortlist) return false;
      if (filter === 'new' && item.status !== 'new') return false;
      if (
        filter === 'unknown' &&
        item.available !== 'unsure' &&
        item.travel !== 'unsure' &&
        item.payAccepted !== 'unsure'
      )
        return false;
      if (filter === 'interested' && item.status !== 'interested') return false;
      if (filter === 'hold' && item.status !== 'hold') return false;
      return (
        !search || `${item.name} ${item.introduction}`.toLowerCase().includes(search.toLowerCase())
      );
    });
    return matches.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'ko')
        : sort === 'oldest'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
    );
  }, [applications, filter, search, sort]);

  const threads = useMemo(() => {
    const open = applications.filter(
      (item) =>
        (item.chatOpen || item.lastMessageAt) &&
        (!msgSearch || item.name.toLowerCase().includes(msgSearch.toLowerCase())),
    );
    return open.sort((a, b) =>
      (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt),
    );
  }, [applications, msgSearch]);

  const newContacts = useMemo(
    () =>
      applications.filter(
        (item) =>
          !item.chatOpen &&
          !item.lastMessageAt &&
          (!msgSearch || item.name.toLowerCase().includes(msgSearch.toLowerCase())),
      ),
    [applications, msgSearch],
  );

  const unreadTotal = applications.reduce((sum, item) => sum + (item.unreadCount || 0), 0);
  // 지원자 화면은 '그 작품의 지원자'만 다룬다. 배역 선택도 같은 작품 안에서만.
  const projectRoles = role
    ? roles.filter((item) => projectKeyOf(item) === projectKeyOf(role))
    : [];

  if (auth === 'loading')
    return (
      <main className="app-shell center-screen">
        <div className="loading-mark">CS</div>
        <p>캐스팅 화면을 여는 중…</p>
      </main>
    );
  if (auth === 'error')
    return (
      <main className="app-shell narrow center-screen">
        <div className="login-panel">
          <div className="brand-mark">CS</div>
          <h1>화면을 열지 못했습니다</h1>
          <p className="form-error" role="alert">
            {message}
          </p>
          <button className="button button-primary full" onClick={() => void loadRoles()}>
            다시 시도
          </button>
          <a className="link-center" href="/">
            처음으로
          </a>
        </div>
      </main>
    );

  return (
    <main className="app-shell wide">
      {!online && (
        <div className="offline-banner" role="status">
          인터넷 연결이 끊겼습니다. 변경 사항을 저장할 수 없습니다.
        </div>
      )}
      <header className="home-header">
        <Link href="/" className="brand-word mobile-only" aria-label="캐스팅플로우 첫 화면으로">
          <BrandLogo />
        </Link>
        <span className="desk-only" />
        <NotifBell />
      </header>
      <div className="screen-pad">
        {tab === 'home' && (
          <>
            <p className="greet-sub">{userName}님, 안녕하세요.</p>
            <h1 className="page-title">오늘의 캐스팅</h1>
            <div className="section-head" style={{ marginTop: 0 }}>
              <h2>진행 중인 프로젝트</h2>
              {/* 이 화면이 이미 프로젝트 전체 목록이다. 예전에는 '전체 보기'가 지원자 탭으로 넘어가 혼란스러웠다. */}
              <span className="muted" style={{ fontSize: 12 }}>
                {projects.length}개
              </span>
            </div>
            {projects.length === 0 ? (
              <div className="empty-card">
                프로젝트를 등록하고
                <br />
                지원 링크를 공고에 붙여 보세요.
              </div>
            ) : (
              projects.map((project) => {
                const first = project.roles[0];
                // 여러 날 촬영하는 배역도 있어서 첫날만이 아니라 모든 촬영일로 기간을 잡는다.
                const dates = project.roles
                  .flatMap((item) => (item.shootDates.length ? item.shootDates : [item.shootDate]))
                  .sort();
                const range =
                  dates[0] === dates[dates.length - 1]
                    ? formattedDate(dates[0])
                    : `${formattedDate(dates[0])} – ${formattedDate(dates[dates.length - 1])}`;
                // 결과 기준일이 3일 안으로 다가왔는데 결과 전 지원자가 남은 배역. 가장 이른 기준일을 알린다.
                const dueSoon = project.roles
                  .filter(
                    (item) =>
                      (item.pendingCount ?? 0) > 0 &&
                      isResultDueSoon(item.resultDueDate ?? '', today),
                  )
                  .sort((a, b) => (a.resultDueDate ?? '').localeCompare(b.resultDueDate ?? ''));
                const pending = dueSoon.reduce((sum, item) => sum + (item.pendingCount ?? 0), 0);
                const pendingShortlist = dueSoon.reduce(
                  (sum, item) => sum + (item.pendingShortlistCount ?? 0),
                  0,
                );
                const firstDue = dueSoon[0];
                const dueDays = firstDue
                  ? daysUntilResult(firstDue.resultDueDate ?? '', today)
                  : null;
                return (
                  <section className="pcard" key={project.title}>
                    <div className="pcard-top">
                      <div className="pcard-img">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={first.coverUrl || projectCover('')} alt="" loading="lazy" />
                      </div>
                      <div className="pcard-info">
                        <span className={`badge-soft${project.closed ? ' state-off' : ''}`}>
                          {project.closed ? '마감' : '모집 중'} · 배역 {project.roles.length}개
                        </span>
                        <h3>{project.title}</h3>
                        <p className="sub">{project.roles.map((item) => item.title).join(' · ')}</p>
                        <p className="meta">
                          촬영 {range} · {first.location}
                        </p>
                      </div>
                    </div>
                    <div className="pcard-stats">
                      <div>
                        <span>지원자</span>
                        <strong>{project.applications}</strong>
                      </div>
                      <div>
                        <span>검토 필요</span>
                        <strong className="accent">{project.newCount}</strong>
                      </div>
                      <div>
                        <span>오디션 후보</span>
                        <strong>{project.shortlistCount}</strong>
                      </div>
                    </div>
                    {firstDue && dueDays !== null && (
                      <button
                        type="button"
                        className="result-warn"
                        onClick={() => {
                          setFilter('all');
                          setSelectedId(null);
                          goTab('applicants', firstDue.id);
                        }}
                      >
                        <strong>
                          결과 안내 {dDayLabel(dueDays)} ·{' '}
                          {formattedDate(firstDue.resultDueDate ?? '')}
                        </strong>
                        <span>
                          결과 전 지원자 {pending}명
                          {pendingShortlist > 0 ? `(오디션 후보 ${pendingShortlist}명 포함)` : ''}은
                          기준일 다음 날 자동으로 &lsquo;불합격&rsquo; 안내돼요. 결과 정하기 ›
                        </span>
                      </button>
                    )}
                    <button
                      className="button button-primary full"
                      onClick={() => {
                        setFilter('all');
                        setSelectedId(null);
                        goTab('applicants', first.id);
                      }}
                    >
                      지원자 검토하기 ›
                    </button>
                    <button className="share-row" onClick={() => void shareRole(first)}>
                      {Icon.upload} 지원 링크 공유
                    </button>
                    {first.projectId && (
                      <a className="share-row" href={`/studio/projects/${first.projectId}/edit`}>
                        {Icon.doc} 프로젝트 수정
                      </a>
                    )}
                  </section>
                );
              })
            )}
            {archivedProjects.length > 0 && (
              <div className="archived-box">
                <button
                  type="button"
                  className="share-row"
                  aria-expanded={showArchived}
                  onClick={() => setShowArchived((value) => !value)}
                >
                  보관한 프로젝트 {archivedProjects.length}개 {showArchived ? '▴' : '▾'}
                </button>
                {showArchived &&
                  archivedProjects.map((project) => (
                    <div key={project.id} className="archived-row">
                      <span>
                        <strong>{project.title}</strong>
                        <small>
                          {new Date(project.archivedAt!).toLocaleDateString('ko-KR', {
                            timeZone: 'Asia/Seoul',
                          })}{' '}
                          보관 · 배우의 지원 현황은 그대로 보여요
                        </small>
                      </span>
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={busy}
                        onClick={() => void restoreProject(project.id)}
                      >
                        다시 꺼내기
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {/* 배역 추가·수정은 각 프로젝트의 '프로젝트 수정'에서 한다. */}
            <div className="split-actions">
              <a className="button button-primary" href="/studio/projects/new">
                {Icon.plus} 프로젝트 등록
              </a>
            </div>
            <div className="section-head">
              <h2>새로 지원한 배우</h2>
            </div>
            {recent.length === 0 ? (
              <div className="empty-card">아직 지원자가 없습니다.</div>
            ) : (
              <div className="actor-strip">
                {recent.map((item) => (
                  <button
                    key={item.id}
                    className="actor-card"
                    onClick={() => {
                      setRoleId(item.roleId);
                      setSelectedId(item.id);
                    }}
                  >
                    <div className="photo">
                      {item.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photoUrl} alt={item.name} loading="lazy" />
                      ) : (
                        initials(item.name)
                      )}
                    </div>
                    <strong>{item.name}</strong>
                    <span>{item.roleTitle || '배역'}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="section-head">
              <h2>다가오는 오디션</h2>
            </div>
            {auditions.length === 0 ? (
              <div className="empty-card">확정된 오디션 일정이 없습니다.</div>
            ) : (
              auditions.map((item) => (
                <button
                  key={item.applicationId}
                  className="audition-card"
                  onClick={() => {
                    setRoleId(item.roleId);
                    setChatId(item.applicationId);
                  }}
                >
                  <span className="icon-tile">{Icon.calendar}</span>
                  <span className="txt">
                    {slotLabel(item.slot)} · {item.name}
                    <small>
                      {item.projectTitle} · {item.roleTitle} · {item.place}
                    </small>
                  </span>
                  <span className="chevron">›</span>
                </button>
              ))
            )}
          </>
        )}

        {tab === 'applicants' && (
          <>
            <button type="button" className="back-link applicants-back" onClick={backToProjects}>
              ‹ 프로젝트
            </button>
            <p className="greet-sub">{role ? role.projectTitle : '프로젝트'}</p>
            <h1 className="page-title">지원자</h1>
            {role ? (
              <>
                <div className="role-pick">
                  {Icon.clapper}
                  {projectRoles.length > 1 ? (
                    <>
                      <select
                        aria-label="배역 선택"
                        value={roleId}
                        onChange={(event) => {
                          setRoleId(event.target.value);
                          setFilter('all');
                          setSelectedId(null);
                          // 같은 작품 안에서 배역만 바꾼 것이라 기록을 새로 쌓지 않고 주소만 맞춘다.
                          history.replaceState(
                            {
                              __csTab: Boolean(
                                (history.state as { __csTab?: boolean } | null)?.__csTab,
                              ),
                            },
                            '',
                            studioUrl('applicants', event.target.value),
                          );
                        }}
                      >
                        {projectRoles.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                      <span className="chevron" style={{ fontSize: 14 }}>
                        ⌄
                      </span>
                    </>
                  ) : (
                    <span>{role.title}</span>
                  )}
                </div>
                <div className="role-banner" style={{ marginTop: 10 }}>
                  <div className="rb-top">
                    <div className="t">
                      <strong>
                        {role.title} <small>{role.isClosed ? '· 지원 마감' : '· 접수 중'}</small>
                      </strong>
                      <span>
                        촬영 {formatDates(role.shootDates, 2) || formattedDate(role.shootDate)} ·{' '}
                        {role.location} · {formattedDate(role.deadline)} 마감
                      </span>
                    </div>
                    <span className={`status-chip ${role.isClosed ? '' : 'chip-new'}`}>
                      {role.isClosed ? '마감' : '모집 중'}
                    </span>
                  </div>
                  <div className="rb-actions">
                    <button onClick={() => void shareRole(role)}>지원 링크 복사</button>
                    <button onClick={() => window.open(`/apply/${role.slug}`, '_blank')}>
                      지원 화면 보기
                    </button>
                    {/* 배역 정보 수정은 '프로젝트 수정'에서 한다. */}
                    <button onClick={() => void toggleClosed(role)} disabled={busy}>
                      {role.isClosed ? '다시 열기' : '접수 마감'}
                    </button>
                  </div>
                </div>
                <section className="stats-grid">
                  <div>
                    <strong>{applications.length}</strong>
                    <span>전체 지원</span>
                  </div>
                  <div>
                    <strong className="accent">
                      {applications.filter((item) => item.status === 'new').length}
                    </strong>
                    <span>미검토</span>
                  </div>
                  <div>
                    <strong>{applications.filter((item) => item.shortlist).length}</strong>
                    <span>오디션 후보</span>
                  </div>
                </section>
                {/*
                  이상형 월드컵식 1:1 비교(후보 비교 화면)로 바로 간다. 이 배역이 골라진 채로 열리고 후보도 바로 불러온다.
                  '후보' 필터를 보고 있으면 오디션 후보끼리, 아니면 제외하지 않은 지원자 전체로 비교한다.
                */}
                {(() => {
                  const finalsOnly = filter === 'shortlist';
                  const count = finalsOnly
                    ? applications.filter((item) => item.shortlist).length
                    : applications.filter((item) => item.status !== 'excluded').length;
                  const href = `/studio/compare?roleId=${encodeURIComponent(role.id)}&source=${finalsOnly ? 'final' : 'role'}`;
                  return count >= 2 ? (
                    <Link className="compare-entry" href={href}>
                      <span className="compare-entry-icon" aria-hidden>
                        {Icon.vs}
                      </span>
                      <span className="txt">
                        월드컵으로 비교
                        <small>
                          {finalsOnly ? '오디션 후보' : '지원자'} {count}명을 두 명씩 붙여 최종 1인
                          뽑기
                        </small>
                      </span>
                      <span className="chevron">›</span>
                    </Link>
                  ) : (
                    <div className="compare-entry is-off" aria-disabled="true">
                      <span className="compare-entry-icon" aria-hidden>
                        {Icon.vs}
                      </span>
                      <span className="txt">
                        월드컵으로 비교
                        <small>
                          {finalsOnly ? '오디션 후보가' : '지원자가'} 2명 이상이면 비교할 수 있어요
                        </small>
                      </span>
                    </div>
                  );
                })()}
                <section>
                  <div className="section-head" style={{ marginTop: 22 }}>
                    <h2>{filter === 'shortlist' ? '오디션 후보' : '지원자 목록'}</h2>
                    <div className="list-tools">
                      <button
                        className="sort-label"
                        onClick={() => {
                          setFilter('all');
                          setSearch('');
                          setSort('newest');
                        }}
                      >
                        초기화
                      </button>
                      <select
                        aria-label="지원자 정렬"
                        value={sort}
                        onChange={(event) => setSort(event.target.value as Sort)}
                      >
                        <option value="newest">최신순</option>
                        <option value="oldest">오래된순</option>
                        <option value="name">이름순</option>
                      </select>
                    </div>
                  </div>
                  <div className="search-box">
                    {Icon.search}
                    <input
                      aria-label="지원자 검색"
                      placeholder="이름 또는 소개 검색"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="filter-row" role="group" aria-label="지원자 필터">
                    {(
                      [
                        ['all', '전체'],
                        ['new', '미검토'],
                        ['unknown', '조건 미확인'],
                        ['interested', '관심'],
                        ['hold', '보류'],
                        ['shortlist', '후보'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        className={filter === value ? 'filter active' : 'filter'}
                        onClick={() => setFilter(value)}
                      >
                        {label}
                        {value === 'new' && (
                          <b>{applications.filter((item) => item.status === 'new').length}</b>
                        )}
                      </button>
                    ))}
                  </div>
                  {filtered.length === 0 ? (
                    <div className="empty-card">
                      {filter === 'shortlist'
                        ? '아직 저장된 후보가 없습니다.'
                        : '이 조건의 지원자가 없습니다.'}
                    </div>
                  ) : (
                    <div className="candidate-list">
                      {filtered.map((item) => (
                        <button
                          key={item.id}
                          className="candidate-row"
                          onClick={() => setSelectedId(item.id)}
                        >
                          <Avatar name={item.name} photoUrl={item.photoUrl} className="avatar sq" />
                          <div className="candidate-main">
                            <div className="candidate-head">
                              <strong>
                                {item.name} <small>{item.age ? `(${item.age})` : ''}</small>
                              </strong>
                              <span className={`status-chip chip-${item.status}`}>
                                {reviewLabels[item.status]}
                              </span>
                            </div>
                            <p>{item.introduction}</p>
                            <div className="candidate-meta">
                              <span className={item.available === 'yes' ? 'positive' : 'uncertain'}>
                                {item.available === 'yes' ? '●' : '◷'} 촬영{' '}
                                {conditionLabel(item.available)}
                              </span>
                              <span>▣ {item.videoUrl ? '영상 있음' : '영상 없음'}</span>
                              {item.shortlist && <span className="positive">★ 후보</span>}
                            </div>
                          </div>
                          <span className="chevron">›</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className="empty-card">
                프로젝트를 등록하면
                <br />
                배역별 지원자가 여기에 모여요.
              </div>
            )}
          </>
        )}

        {tab === 'messages' && (
          <>
            <h1 className="page-title" style={{ marginTop: 14 }}>
              메시지
            </h1>
            <div className="role-pick">
              {Icon.clapper}
              <select
                aria-label="프로젝트 선택"
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
              >
                {roles.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.projectTitle} · {item.title}
                  </option>
                ))}
              </select>
              <span className="chevron" style={{ fontSize: 14 }}>
                ⌄
              </span>
            </div>
            <div className="search-box" style={{ marginTop: 12 }}>
              {Icon.search}
              <input
                aria-label="배우 또는 대화 검색"
                placeholder="배우 또는 대화 검색"
                value={msgSearch}
                onChange={(event) => setMsgSearch(event.target.value)}
              />
            </div>
            {newContacts.length > 0 && (
              <>
                <div className="section-head">
                  <h2>새로운 연락</h2>
                </div>
                <div className="actor-strip">
                  {newContacts.map((item) => (
                    <button
                      key={item.id}
                      className="new-contact"
                      onClick={() => setChatId(item.id)}
                    >
                      <Avatar name={item.name} photoUrl={item.photoUrl} className="avatar" />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="section-head">
              <h2>대화</h2>
              <span className="muted" style={{ fontSize: 11 }}>
                최신순
              </span>
            </div>
            {threads.length === 0 ? (
              <div className="empty-card">
                지원자가 접수되면
                <br />
                여기에서 연락을 시작할 수 있습니다.
              </div>
            ) : (
              <div className="thread-list">
                {threads.map((item) => (
                  <button key={item.id} className="thread-row" onClick={() => setChatId(item.id)}>
                    <Avatar name={item.name} photoUrl={item.photoUrl} className="avatar" />
                    <div className="thread-main">
                      <div className="thread-name">
                        <strong>{item.name}</strong>
                        {item.offerStatus && item.offerStatus !== 'confirmed' && (
                          <span className="thread-badge">오디션 조율</span>
                        )}
                        {item.offerStatus === 'confirmed' && (
                          <span className="thread-badge done">오디션 확정</span>
                        )}
                      </div>
                      <p>{item.lastMessage || '대화를 시작해 보세요.'}</p>
                    </div>
                    <div className="thread-side">
                      <time>{chatTimeLabel(item.lastMessageAt || item.updatedAt)}</time>
                      {(item.unreadCount || 0) > 0 && (
                        <span className="unread-dot">{item.unreadCount}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'profile' && (
          <>
            <h1 className="page-title" style={{ marginTop: 14 }}>
              내 정보
            </h1>
            <div className="profile-card">
              <div className="avatar">{userName.slice(-2)}</div>
              <div>
                <strong>{userName}</strong>
                <span>
                  {orgName ? `${orgName} · ` : ''}
                  {email}
                </span>
              </div>
            </div>
            <a className="verify-entry" href="/studio/verify">
              <strong>제작진 인증</strong>
              <span>학교·제작사 인증을 받으면 공고에 인증 표시가 붙어요 ›</span>
            </a>
            {/*
              추천·비교·보드·캘린더는 하단 탭에 자리가 없어 데스크톱 메뉴에만 있다.
              링크 자체는 전부터 여기 있었지만 계정 항목과 한 줄로 섞여 있어서
              '모바일에는 그런 기능이 없다'고 느껴졌다. 묶음과 한 줄 설명을 붙여 찾을 수 있게 한다.
            */}
            <div className="section-head">
              <h2>제작 도구</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                큰 화면에서 더 편해요
              </span>
            </div>
            <div className="menu-list tool-list">
              <a href="/studio/recommend">
                {Icon.sparkle}
                <span>
                  배우 추천<small>배역 조건에 맞는 배우를 적합도 순으로</small>
                </span>
              </a>
              <a href="/studio/compare">
                {Icon.vs}
                <span>
                  이상형 월드컵<small>두 명씩 겨뤄 최종 1인 뽑기</small>
                </span>
              </a>
              <a href="/studio/board">
                {Icon.columns}
                <span>
                  팀 보드<small>팀원과 함께 단계별로 후보 정리</small>
                </span>
              </a>
              <a href="/studio/calendar">
                {Icon.calendar}
                <span>
                  오디션 캘린더<small>확정된 오디션 일정 한눈에</small>
                </span>
              </a>
            </div>

            <div className="section-head">
              <h2>공고 관리</h2>
            </div>
            <div className="menu-list">
              <a href="/studio/projects/new">{Icon.folder} 프로젝트 등록</a>
              <a href="/studio/actors">{Icon.search} 배우 찾기</a>
              <button onClick={() => role && void shareRole(role)} disabled={!role}>
                {Icon.upload} 지원 링크 공유
              </button>
              <button
                onClick={async () => {
                  await api('/api/auth', { method: 'DELETE' });
                  location.href = '/';
                }}
              >
                {Icon.out} 로그아웃
              </button>
            </div>
            <p className="version-note">캐스팅플로우 MVP 0.2</p>
          </>
        )}
      </div>

      {/* 지원자 화면은 프로젝트 아래 화면이라 하단바에서는 [프로젝트]가 켜진다. */}
      <ProducerNav
        active={tab === 'applicants' ? 'home' : tab}
        onTab={(next) => goTab(next)}
        badge={{ messages: unreadTotal > 0 }}
      />

      {message && (
        <div className="toast" role="status" onClick={() => setMessage('')}>
          {message}
          <button aria-label="닫기">×</button>
        </div>
      )}

      {selected && (
        <div className="sheet-backdrop" onClick={() => setSelectedId(null)}>
          <section
            className="detail-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} 지원서`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-title">
              <span>지원자 상세</span>
              <button onClick={() => setSelectedId(null)} aria-label="닫기">
                ×
              </button>
            </div>
            <div className="detail-profile">
              {selected.photoUrls.length > 0 ? (
                <button
                  className="avatar-open"
                  onClick={() => setPhotoAt(0)}
                  aria-label={`${selected.name} 사진 크게 보기`}
                >
                  <Avatar
                    name={selected.name}
                    photoUrl={selected.photoUrl}
                    className="avatar avatar-large"
                  />
                </button>
              ) : (
                <Avatar
                  name={selected.name}
                  photoUrl={selected.photoUrl}
                  className="avatar avatar-large"
                />
              )}
              <div>
                <h2>
                  {selected.name} <small>{selected.age ? `(${selected.age})` : ''}</small>
                </h2>
                <p>{selected.introduction}</p>
                <span>
                  지원일{' '}
                  {new Date(selected.createdAt).toLocaleDateString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                  })}
                </span>
              </div>
            </div>
            <div className="detail-grid">
              <div>
                <span>촬영 가능</span>
                <strong className={selected.available === 'yes' ? 'positive' : 'uncertain'}>
                  {conditionLabel(selected.available)}
                </strong>
              </div>
              <div>
                <span>지역 이동</span>
                <strong>{conditionLabel(selected.travel)}</strong>
              </div>
              <div>
                <span>출연료 수용</span>
                <strong>{conditionLabel(selected.payAccepted)}</strong>
              </div>
            </div>
            <div className="detail-block">
              <h3>자료와 연락처</h3>
              <p>필수 역량: {selected.skill || '미입력'}</p>
              <p>
                연락처: {selected.phone} · {selected.email}
              </p>
              {selected.photoUrls.length > 0 && (
                <button className="text-button" onClick={() => setPhotoAt(0)}>
                  사진 크게 보기
                  {selected.photoUrls.length > 1 && ` (${selected.photoUrls.length}장)`}
                </button>
              )}
              {selected.videoUrl && (
                <a href={selected.videoUrl} target="_blank" rel="noreferrer">
                  연기 영상 열기 ↗
                </a>
              )}
            </div>
            <button
              className="button button-outline full"
              style={{ marginBottom: 12 }}
              onClick={() => {
                setChatId(selected.id);
                setSelectedId(null);
              }}
            >
              연락하기 · 오디션 일정 제안
            </button>
            {/* 메모와 결과 공개는 자주 쓰지 않아 접어 둔다. 분류 버튼은 시트 아래에 고정. */}
            <details className="detail-fold">
              <summary>
                팀 내부 메모
                <span>{selected.note ? '메모 있음' : '없음'}</span>
              </summary>
              <textarea
                id="review-note"
                aria-label="팀 내부 메모"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="공개되지 않는 메모입니다"
              />
              <button
                className="text-button"
                disabled={busy || note === selected.note}
                onClick={() => void updateApplication(selected.id, { note })}
              >
                메모 저장
              </button>
            </details>
            <details className="detail-fold public-block">
              <summary>
                배우에게 공개할 결과
                <span>
                  {selected.publicStage === 'received'
                    ? selected.viewedAt
                      ? '검토 중'
                      : '미열람'
                    : publicLabels[selected.publicStage]}
                </span>
              </summary>
              <p>
                선택 후 저장하면 배우의 지원 현황에 표시됩니다. 결과를 정하기 전에는 배우에게{' '}
                <strong>{selected.viewedAt ? '검토 중' : '미열람'}</strong>으로 보여요.
              </p>
              <select
                aria-label="배우 공개 상태"
                value={pendingPublicStage ?? selected.publicStage}
                onChange={(event) => setPendingPublicStage(event.target.value as PublicStage)}
              >
                <option value="received">결과 정하기 전 (검토 중)</option>
                <option value="audition">오디션 대상</option>
                <option value="not_selected">불합격</option>
                <option value="cast">합격</option>
              </select>
              {selected.resultAutoAt && selected.publicStage === 'not_selected' ? (
                <p className="auto-result-note">
                  <b>자동 안내</b> 결과 기준일이 지나 자동으로 불합격이 안내됐어요. 결과를 바꾸면
                  배우의 지원 현황에 바로 반영돼요.
                </p>
              ) : (
                selected.publicStage === 'received' &&
                role?.resultDueDate && (
                  <p className="auto-result-note">
                    결과 기준일 {formattedDate(role.resultDueDate)}이 지나도록 결과를 정하지 않으면
                    다음 날 자동으로 불합격이 안내돼요.
                  </p>
                )
              )}
              {pendingPublicStage && pendingPublicStage !== selected.publicStage && (
                <div className="public-confirm">
                  <p>
                    <strong>{publicLabels[pendingPublicStage]}</strong> 상태를 배우의 현황 페이지에
                    공개합니다.
                  </p>
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() => {
                      void updateApplication(selected.id, { publicStage: pendingPublicStage });
                      setPendingPublicStage(null);
                    }}
                  >
                    결과 공개
                  </button>
                  <button
                    className="button button-outline"
                    onClick={() => setPendingPublicStage(null)}
                  >
                    취소
                  </button>
                </div>
              )}
            </details>
            <p className="review-hint">
              {selected.status === 'excluded' ? (
                <>
                  제외로 분류했어요.{' '}
                  <button
                    className="text-button inline"
                    disabled={busy}
                    onClick={() => void updateApplication(selected.id, { status: 'new' })}
                  >
                    제외 풀기
                  </button>
                </>
              ) : (
                <>
                  조건이 맞지 않으면{' '}
                  <button
                    className="text-button inline"
                    disabled={busy}
                    onClick={() => void updateApplication(selected.id, { status: 'excluded' })}
                  >
                    제외로 분류
                  </button>
                </>
              )}
              <br />
              분류는 팀 전체가 함께 보는 값이라 팀 보드의 단계도 같이 바뀝니다.
            </p>
            {/* 시트를 끝까지 내리지 않아도 바로 분류할 수 있게 아래에 고정한다. 다시 누르면 선택이 풀린다. */}
            <div className="detail-actions" role="group" aria-label="지원자 분류">
              {(
                [
                  ['hold', '보류'],
                  ['interested', '관심'],
                ] as [ReviewStatus, string][]
              ).map(([status, label]) => {
                const picked = selected.status === status;
                return (
                  <button
                    key={status}
                    disabled={busy}
                    aria-pressed={picked}
                    className={picked ? 'selected' : ''}
                    title={picked ? '다시 누르면 선택이 풀려요' : undefined}
                    onClick={() =>
                      void updateApplication(selected.id, { status: picked ? 'new' : status })
                    }
                  >
                    {picked && '✓ '}
                    {label}
                  </button>
                );
              })}
              <button
                disabled={busy}
                aria-pressed={selected.shortlist}
                className={`short${selected.shortlist ? ' selected' : ''}`}
                title={selected.shortlist ? '다시 누르면 후보에서 빠져요' : undefined}
                onClick={() =>
                  void updateApplication(selected.id, {
                    shortlist: !selected.shortlist,
                    status: !selected.shortlist ? 'interested' : selected.status,
                  })
                }
              >
                {selected.shortlist ? '★ 오디션 후보' : '☆ 오디션 후보'}
              </button>
            </div>
          </section>
        </div>
      )}

      {selected && photoAt !== null && (
        <PhotoLightbox
          photos={selected.photoUrls}
          startAt={photoAt}
          name={selected.name}
          onClose={() => setPhotoAt(null)}
        />
      )}

      {chatId && (
        <div className="sheet-backdrop" onClick={closeChat}>
          <section
            className="detail-sheet chat-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="지원자 대화"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            {chatTarget && (
              <ChatThread
                applicationId={chatId}
                mode="producer"
                peerName={chatTarget.name}
                peerPhoto={chatTarget.photoUrl}
                peerSub={`${role?.projectTitle || ''} · ${role?.title || ''}`}
                projectTitle={role?.projectTitle || ''}
                roleTitle={role?.title || ''}
                projectImage={role?.coverUrl || projectCover('')}
                onViewProfile={() => {
                  setSelectedId(chatId);
                  setChatId(null);
                }}
                onClose={closeChat}
              />
            )}
          </section>
        </div>
      )}
    </main>
  );
}
