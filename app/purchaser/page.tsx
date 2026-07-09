import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function PurchaserHome() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'PURCHASER') redirect('/home');

  const all = await prisma.material.findMany({ where: { active: true } });
  const lowStock = all.filter((m) => Number(m.stock) < Number(m.minStock));
  const outOfStock = all.filter((m) => Number(m.stock) <= 0);

  return (
    <div className="app-shell">
      <TopBar title="采购管理" userName={session.name} roleLabel="采购" />
      <div className="page">
        <div className="stat-grid">
          <div className="stat">
            <div className="label">需要补货</div>
            <div className="value red">{lowStock.length}</div>
          </div>
          <div className="stat">
            <div className="label">已缺货</div>
            <div className="value red">{outOfStock.length}</div>
          </div>
        </div>

        {lowStock.length > 0 && (
          <div className="card">
            <h3>建议采购清单</h3>
            {lowStock.slice(0, 10).map((m) => (
              <div key={m.id} className="issue-row">
                <div className="left">
                  <div className="name">{m.name}</div>
                  <div className="meta">
                    {m.supplier || '未指定供应商'} · 最低 {Number(m.minStock)} {m.unit}
                  </div>
                </div>
                <div className="right">
                  <div className="qty" style={{ color: '#A32D2D' }}>
                    {Number(m.stock)} {m.unit}
                  </div>
                  <div className="time">建议采购 {Number(m.minStock) * 2} {m.unit}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link href="/purchaser/purchases">
          <div className="big-btn blue">
            <div>查看采购记录 <span className="sub">管理发票和订单</span></div>
            <span className="arrow">→</span>
          </div>
        </Link>
      </div>
      <TabBar role="PURCHASER" />
    </div>
  );
}
