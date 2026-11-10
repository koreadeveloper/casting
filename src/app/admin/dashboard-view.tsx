// 화면 그리기만 한다(데이터는 page.tsx가 읽어서 넘긴다). 확인용으로 따로 그려 볼 수 있게 나눠 둔다.
import Link from 'next/link';
import { SIGNUP_DAYS, type dashboardStats } from '@/lib/admin-stats';
import { formatDateTime } from './format';

function Tile({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="admin-tile-label">{label}</span>
      <strong className="admin-tile-value">{value.toLocaleString('ko-KR')}</strong>
      {sub && <span className="admin-tile-sub">{sub}</span>}
    </>
  );
  return href ? (
    <Link href={href} className="admin-tile">
      {body}
    </Link>
  ) : (
    <div className="admin-tile">{body}</div>
  );
}

// 관리자 첫 화면: 회원·공고·지원·문의 숫자와 최근 가입 추이

export default function DashboardView({
  stats,
}: {
  stats: Awaited<ReturnType<typeof dashboardStats>>;
}) {
  const max = Math.max(1, ...stats.signups.map((d) => d.actor + d.producer));
  const total = stats.signups.reduce((sum, d) => sum + d.actor + d.producer, 0);
  return (
    <>
      <section className="admin-body">
        <h1 className="page-title">대시보드</h1>

        <div className="admin-tiles">
          <Tile
            label="전체 회원"
            value={stats.members.total}
            sub={`배우 ${stats.members.actors} · 제작진 ${stats.members.producers}`}
            href="/admin/members"
          />
          <Tile label="최근 7일 가입" value={stats.members.lastWeek} href="/admin/members" />
          <Tile
            label="새 문의"
            value={stats.newInquiries}
            sub={stats.newInquiries ? '확인이 필요해요' : '모두 확인했어요'}
            href="/admin/inquiries"
          />
          <Tile
            label="배우에게 보이는 공고"
            value={stats.listings.openRoles}
            sub={`전체 공고 ${stats.listings.allRoles}${stats.listings.hiddenRoles ? ` · 내린 공고 ${stats.listings.hiddenRoles}` : ''}`}
            href="/admin/roles"
          />
          <Tile
            label="전체 지원서"
            value={stats.listings.applications}
            sub={`최근 7일 ${stats.listings.applicationsWeek}건`}
          />
          <Tile
            label="인증된 제작진"
            value={stats.members.verifiedProducers}
            sub={`제작진 ${stats.members.producers}명 중`}
          />
          <Tile
            label="공개 배우 프로필"
            value={stats.members.publicProfiles}
            sub={`배우 ${stats.members.actors}명 중`}
          />
          <Tile
            label="정지된 계정"
            value={stats.members.suspended}
            sub={`Google 연결 ${stats.members.google}명`}
          />
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <h2>최근 {SIGNUP_DAYS}일 가입자</h2>
            <span className="small-note">
              합계 {total}명 · 막대에 올리면 배우·제작진 수가 보여요
            </span>
          </div>
          <div
            className="admin-bars"
            role="img"
            aria-label={`최근 ${SIGNUP_DAYS}일 하루 가입자 수, 합계 ${total}명`}
          >
            {stats.signups.map((d) => {
              const n = d.actor + d.producer;
              return (
                <div key={d.day} className="admin-bar" tabIndex={0}>
                  <span className="admin-bar-tip">
                    {d.day.slice(5).replace('-', '.')} · {n}명
                    <br />
                    배우 {d.actor} · 제작진 {d.producer}
                  </span>
                  <span className="admin-bar-value">{n > 0 && n === max ? n : ''}</span>
                  <span
                    className="admin-bar-fill"
                    style={{ height: `${n ? Math.max(4, (n / max) * 100) : 0}%` }}
                  />
                  <span className="admin-bar-day">{Number(d.day.slice(8))}</span>
                </div>
              );
            })}
          </div>
          <details className="admin-table-toggle">
            <summary>숫자로 보기</summary>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>배우</th>
                  <th>제작진</th>
                  <th>합계</th>
                </tr>
              </thead>
              <tbody>
                {stats.signups.map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td>{d.actor}</td>
                    <td>{d.producer}</td>
                    <td>{d.actor + d.producer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <h2>최근 가입한 회원</h2>
            <Link href="/admin/members" className="text-button">
              모두 보기
            </Link>
          </div>
          <ul className="admin-mini-list">
            {stats.latest.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/members/${m.id}`}>
                  <strong>{m.name || '(이름 없음)'}</strong>
                  <span className="status-chip">{m.role === 'producer' ? '제작진' : '배우'}</span>
                  <span className="muted">{m.email}</span>
                </Link>
                <span className="small-note">{formatDateTime(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
