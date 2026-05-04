import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function WorkerHome() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'WORKER') redirect('/home');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await prisma.issue.count({
    where: { userId: session.userId, createdAt: { gte: todayStart } },
  });

  return (
    <div className="app-shell">
      <TopBar title="工厂管理" userName={session.name} roleLabel="师傅" />

      <div className="page">
        <h2>今天要做什么？</h2>

        <Link href="/worker/action/OUT">
          <div className="big-btn green">
            <div>领料<span className="sub">从仓库领取良品辅料（可选款号/裁床号/扎号）</span></div>
            <span className="arrow">→</span>
          </div>
        </Link>

        <Link href="/worker/action/SPECIAL">
          <div className="big-btn amber">
            <div>专机辅料领取<span className="sub">专机用辅料，关联到款号</span></div>
            <span className="arrow">→</span>
          </div>
        </Link>

        <Link href="/worker/action/RETURN">
          <div className="big-btn blue">
            <div>退料<span className="sub">未用完的辅料退回仓库</span></div>
            <span className="arrow">→</span>
          </div>
        </Link>

        <Link href="/worker/action/DEFECT">
          <div className="big-btn amber" style={{ background: '#FAEEDA' }}>
            <div>报次品<span className="sub">良品转为次品</span></div>
            <span className="arrow">→</span>
          </div>
        </Link>

        <Link href="/worker/action/WASTE">
          <div className="big-btn red">
            <div>报废品<span className="sub">良品转为废品</span></div>
            <span className="arrow">→</span>
          </div>
        </Link>

        <p style={{ fontSize: 13, color: '#888', marginTop: 10, marginBottom: 8 }}>次品处理</p>

        <Link href="/worker/action/DEFECT_TO_WASTE">
          <div className="big-btn red" style={{ padding: 16, fontSize: 16 }}>
            <div>次品 → 废品<span className="sub">次品无法修复</span></div>
            <span className="arrow">→</span>
          </div>
        </Link>

        <Link href="/worker/action/DEFECT_RETURN_SUPPLIER">
          <div className="big-btn blue" style={{ padding: 16, fontSize: 16 }}>
            <div>次品 → 退供应商<span className="sub">次品退回供应商</span></div>
            <span className="arrow">→</span>
          </div>
        </Link>

        <div className="card" style={{ marginTop: 10 }}>
          <p style={{ fontSize: 13, color: '#666' }}>
            今天已操作 <span style={{ fontWeight: 600, color: '#1D9E75' }}>{todayCount}</span> 次
          </p>
        </div>
      </div>

      <TabBar role="WORKER" />
    </div>
  );
}
