// 화면 그리기만 한다(데이터는 page.tsx가 읽어서 넘긴다). 확인용으로 따로 그려 볼 수 있게 나눠 둔다.
import Link from 'next/link';
import { ADMIN_ACTIONS, type AdminLog } from '@/lib/admin-log';
import { formatDateTime } from '../format';

const TARGET_LABEL: Record<string, string> = {
  member: '회원',
  inquiry: '문의',
  role: '공고',
  notice: '공지',
};

/** 기록 대상으로 가는 링크(회원은 상세 화면). 지워진 대상이면 글자만 보인다. */
function TargetCell({ log }: { log: AdminLog }) {
  const text = log.targetLabel || log.targetId || '-';
  if (log.targetType === 'member' && log.targetId && log.action !== 'delete')
    return <Link href={`/admin/members/${log.targetId}`}>{text}</Link>;
  return <>{text}</>;
}

// 관리자 작업 기록: 최근 300건. 지우거나 고칠 수 없다(근거로 남기는 기록이라서).

export default function LogsView({ logs }: { logs: AdminLog[] }) {
  return (
    <>
      <section className="admin-body">
        <h1 className="page-title">작업 기록</h1>
        <p className="muted admin-lead">
          관리자가 회원·문의·공고·공지에 한 작업이 최근 순으로 남아요(최근 300건). 기록은 고치거나
          지울 수 없어요.
        </p>
        {logs.length === 0 ? (
          <div className="empty-card">아직 남은 기록이 없어요.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>시각</th>
                  <th>관리자</th>
                  <th>작업</th>
                  <th>대상</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="nowrap">{formatDateTime(log.createdAt)}</td>
                    <td>{log.adminEmail}</td>
                    <td className="nowrap">
                      <strong>
                        {ADMIN_ACTIONS[log.action as keyof typeof ADMIN_ACTIONS] ?? log.action}
                      </strong>
                    </td>
                    <td>
                      <span className="status-chip">
                        {TARGET_LABEL[log.targetType] ?? log.targetType}
                      </span>{' '}
                      <TargetCell log={log} />
                    </td>
                    <td>{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
