'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import FindSwitch from '@/components/find-switch';
import ProducerNav from '@/components/producer-nav';
import { IMAGE_TAG_GROUPS, IMAGE_TAGS, REGIONS, SKILL_GROUPS, SKILLS } from '@/lib/profile';
import { formatDates } from '@/lib/schedule';
import styles from './recommend.module.css';

type RecoActor = {
  id: string;
  name: string;
  age: number | null;
  gender: string;
  height: number | null;
  region: string;
  photo: string;
  tags: string[];
};

type RecoResult = { actor: RecoActor; score: number; reasons: string[] };

type AppliedBrief = {
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  region?: string;
  tags?: string[];
  skills?: string[];
  keywords?: string[];
  shootDate?: string;
  shootDates?: string[];
};

type RoleOption = { id: string; label: string };

function briefSummary(brief: AppliedBrief) {
  const items: string[] = [];
  if (brief.gender) items.push(brief.gender === 'female' ? '여성' : '남성');
  if (brief.ageMin !== undefined || brief.ageMax !== undefined)
    items.push(`${brief.ageMin ?? ''}~${brief.ageMax ?? ''}세`);
  if (brief.region) items.push(brief.region);
  if (brief.tags?.length) items.push(...brief.tags);
  if (brief.skills?.length) items.push(...brief.skills);
  if (brief.shootDates?.length) items.push(`촬영일 ${formatDates(brief.shootDates)}`);
  else if (brief.shootDate) items.push(`촬영일 ${brief.shootDate}`);
  return items;
}

function toNum(value: string) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : undefined;
}

export default function RecommendClient() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [roleId, setRoleId] = useState('');
  const [desc, setDesc] = useState('');
  const [gender, setGender] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [region, setRegion] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const [pickedSkills, setPickedSkills] = useState<string[]>([]);
  const [results, setResults] = useState<RecoResult[]>([]);
  const [applied, setApplied] = useState<AppliedBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/roles', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { roles: [] }))
      .then((data) =>
        setRoles(
          (data.roles || []).map((role: { id: string; projectTitle: string; title: string }) => ({
            id: role.id,
            label: `${role.projectTitle} · ${role.title}`,
          })),
        ),
      )
      .catch(() => {});
    fetch('/api/actors?favorites=1', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { actors: [] }))
      .then((data) =>
        setSaved(new Set((data.actors || []).map((a: { userId: string }) => a.userId))),
      )
      .catch(() => {});
  }, []);

  const apply = useCallback(async (input: { roleId?: string; brief?: AppliedBrief }) => {
    setLoading(true);
    setRequested(true);
    setError('');
    try {
      const response = input.roleId
        ? await fetch(`/api/recommendations?roleId=${input.roleId}`, { cache: 'no-store' })
        : await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brief: input.brief }),
          });
      if (response.status === 401) {
        location.href = '/login?next=/studio/recommend';
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '추천을 불러오지 못했습니다.');
      setApplied(data.brief || null);
      setResults(data.results || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '추천을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  function pickRole(value: string) {
    setRoleId(value);
    if (value) void apply({ roleId: value });
  }

  /** 직접 입력한 조건을 모두 비우고, 추천 결과도 처음 상태로 돌린다. */
  function resetManual() {
    setDesc('');
    setGender('');
    setAgeMin('');
    setAgeMax('');
    setRegion('');
    setShootDate('');
    setPickedTags([]);
    setPickedSkills([]);
    setRoleId('');
    setResults([]);
    setApplied(null);
    setRequested(false);
    setError('');
  }

  function submitManual() {
    setRoleId('');
    const found = [...new Set(desc.split(/[\s,·/]+/).filter((word) => word.length >= 2))].slice(
      0,
      8,
    );
    void apply({
      brief: {
        gender: gender || undefined,
        ageMin: toNum(ageMin),
        ageMax: toNum(ageMax),
        region: region || undefined,
        shootDate: shootDate || undefined,
        tags: [...new Set([...pickedTags, ...IMAGE_TAGS.filter((tag) => desc.includes(tag))])],
        skills: [...new Set([...pickedSkills, ...SKILLS.filter((skill) => desc.includes(skill))])],
        keywords: found,
      },
    });
  }

  function toggle(list: string[], setList: (next: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]);
  }

  async function toggleFavorite(actorId: string) {
    const on = !saved.has(actorId);
    setSaved((current) => {
      const next = new Set(current);
      if (on) next.add(actorId);
      else next.delete(actorId);
      return next;
    });
    const response = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId, favorite: on }),
    });
    if (!response.ok)
      setSaved((current) => {
        const next = new Set(current);
        if (on) next.delete(actorId);
        else next.add(actorId);
        return next;
      });
  }

  const summary = applied ? briefSummary(applied) : [];

  return (
    <main className="app-shell wide">
      <ProducerNav active="recommend" />
      <div className="screen-pad page-top">
        <p className="greet-sub">
          배역 조건과 배우 프로필을 비교해 적합도 순으로 제안합니다 (조건 기반 분석)
        </p>
        <h1 className="page-title">배우 추천</h1>
        <FindSwitch active="recommend" />

        <section className={styles.panel}>
          <label className={styles.field}>
            <span className={styles.label}>내 배역에서 추천 받기</span>
            <select
              value={roleId}
              onChange={(event) => pickRole(event.target.value)}
              aria-label="내 배역 선택"
            >
              <option value="">배역 선택…</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.divider}>
            <span>또는 직접 조건 입력</span>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>배역 설명</span>
            <textarea
              rows={3}
              placeholder="예: 20대 여성, 카페 사장 역할. 따뜻한 이미지와 자연스러운 연기"
              value={desc}
              onChange={(event) => setDesc(event.target.value)}
            />
          </label>
          <div className={styles.row}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>성별</legend>
              <div className={styles.radioRow}>
                {[
                  ['', '무관'],
                  ['female', '여성'],
                  ['male', '남성'],
                ].map(([value, label]) => (
                  <label key={value} className="radio">
                    <input
                      type="radio"
                      name="reco-gender"
                      checked={gender === value}
                      onChange={() => setGender(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>연령</legend>
              <div className={styles.rangeRow}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="최소"
                  value={ageMin}
                  onChange={(event) => setAgeMin(event.target.value)}
                />
                <span>~</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="최대"
                  value={ageMax}
                  onChange={(event) => setAgeMax(event.target.value)}
                />
              </div>
            </fieldset>
          </div>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>지역</span>
              <select value={region} onChange={(event) => setRegion(event.target.value)}>
                <option value="">무관</option>
                {REGIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>촬영일</span>
              <input
                type="date"
                value={shootDate}
                onChange={(event) => setShootDate(event.target.value)}
              />
            </label>
          </div>
          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>원하는 이미지 키워드</legend>
            {IMAGE_TAG_GROUPS.map((group) => (
              <div key={group.title} className="chip-group">
                <p className="chip-group-label">{group.title}</p>
                <div className="chip-pick">
                  {group.items.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={pickedTags.includes(tag)}
                      className={pickedTags.includes(tag) ? 'on' : ''}
                      onClick={() => toggle(pickedTags, setPickedTags, tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>
          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>필요한 특기</legend>
            {SKILL_GROUPS.map((group) => (
              <div key={group.title} className="chip-group">
                <p className="chip-group-label">{group.title}</p>
                <div className="chip-pick">
                  {group.items.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      aria-pressed={pickedSkills.includes(skill)}
                      className={pickedSkills.includes(skill) ? 'on' : ''}
                      onClick={() => toggle(pickedSkills, setPickedSkills, skill)}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>
          <div className="split-actions">
            <button
              type="button"
              className="button button-soft"
              onClick={resetManual}
              disabled={loading}
            >
              조건 초기화
            </button>
            <button className="button button-primary" onClick={submitManual} disabled={loading}>
              {loading ? '분석 중…' : '추천 받기'}
            </button>
          </div>
        </section>

        {summary.length > 0 && (
          <div className={styles.summary} aria-label="적용된 조건">
            <span>적용 조건</span>
            {summary.map((item) => (
              <i key={item}>{item}</i>
            ))}
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <div className={styles.grid}>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={`${styles.card} ${styles.skeleton}`}>
                <div className={styles.skPhoto} />
                <div className={styles.skLines}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </div>
        ) : requested && results.length === 0 ? (
          <div className={styles.empty}>
            조건에 맞는 배우가 없습니다.
            <br />
            조건을 조정해 보세요.
          </div>
        ) : !requested ? (
          <div className={styles.empty}>
            내 배역을 선택하거나 조건을 입력한 뒤
            <br />
            추천 받기를 눌러 보세요.
          </div>
        ) : (
          <div className={styles.grid}>
            {results.map(({ actor, score, reasons }) => (
              <article key={actor.id} className={styles.card}>
                <div className={styles.score}>
                  <b>{score}</b>
                  <span>%</span>
                </div>
                <Link href={`/actors/${actor.id}`} className={styles.photo}>
                  {actor.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={actor.photo} alt={`${actor.name} 프로필 사진`} loading="lazy" />
                  ) : (
                    <span>{actor.name.slice(-2)}</span>
                  )}
                </Link>
                <div className={styles.info}>
                  <strong>{actor.name}</strong>
                  <span className={styles.meta}>
                    {[
                      actor.age !== null ? `${actor.age}세` : '',
                      actor.height ? `${actor.height}cm` : '',
                      actor.region,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <div className={styles.reasons}>
                    {reasons.slice(0, 4).map((reason) => (
                      <i key={reason}>{reason}</i>
                    ))}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${styles.save}${saved.has(actor.id) ? ` ${styles.on}` : ''}`}
                    aria-pressed={saved.has(actor.id)}
                    onClick={() => void toggleFavorite(actor.id)}
                  >
                    {saved.has(actor.id) ? '♥ 저장됨' : '♡ 후보 저장'}
                  </button>
                  <Link href={`/actors/${actor.id}`} className={styles.linkBtn}>
                    프로필
                  </Link>
                  <Link href={`/actors/${actor.id}`} className={styles.propose}>
                    캐스팅 제안
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
