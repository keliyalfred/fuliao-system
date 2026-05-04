import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { prisma } from '@/lib/prisma';

const TYPE_LABEL: Record<string, string> = { OUT: '领料', RETURN: '退料', DEFECT: '次品', IN: '入库', RESHELF: '返修上架' };
const TYPE_COLOR: Record<string, string> = { OUT: 'green', RETURN: 'amber', DEFECT: 'red', IN: 'gray', RESHELF: 'green' };

export default async function WorkerRecords() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'WORKER') redirect('/home');

  const issues = await prisma.issue.findMany({
    where: { userId: session.userId },
    include: { material: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="app-shell">
      <TopBar title="我的记录" userName={session.name} roleLabel="师傅" />
      <div className="page">
        <h2>最近 100 条</h2>

        {issues.length === 0 && <div className="empty-state">还没有任何操作</div>}

        {issues.length > 0 && (
          <div className="card">
            {issues.map((i) => (
              <div key={i.id} className="issue-row">
                <div className="left">
                  <div className="name">
                    <span className={`badge ${TYPE_COLOR[i.type]}`}>{TYPE_LABEL[i.type]}</span>
                    {' '}
                    {i.material.name}
                  </div>
                  <div className="meta">
                    {i.styleCode && <>用于 {i.styleCode} · </>}
                    {i.note && <>{i.note}</>}
                  </div>
                </div>
                <div className="right">
                  <div className="qty">{Number(i.quantity)} {i.material.unit}</div>
                  <div className="time">{formatTime(i.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <TabBar role="WORKER" />
    </div>
  );
}

function formatTime(d: Date) {
  const now = Date.now();
  const t = d.getTime();
  const diff = now - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}天前`;
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
