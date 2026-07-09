import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { prisma } from '@/lib/prisma';

export default async function CutterRecords() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'CUTTER') redirect('/home');

  const cuttings = await prisma.cutting.findMany({
    where: { userId: session.userId },
    include: {
      style: true,
      styleColor: true,
      items: { include: { fabric: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="app-shell">
      <TopBar title="我的裁片" userName={session.name} roleLabel="裁床" />
      <div className="page">
        <h2>最近 100 批</h2>
        {cuttings.length === 0 && <div className="empty-state">还没有裁片记录</div>}
        {cuttings.map((c) => {
          const totalCost = c.items.reduce((s, i) => s + Number(i.totalCost), 0);
          const perPiece = c.pieceCount > 0 ? totalCost / c.pieceCount : 0;
          return (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{c.style.code} · {c.style.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {c.styleColor.colorName} · {c.pieceCount} 件 · 批次 {c.batchNo}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>¥ {totalCost.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>¥{perPiece.toFixed(2)}/件</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#666', paddingTop: 8, borderTop: '0.5px solid #eee' }}>
                {c.items.map((i, idx) => (
                  <div key={idx} style={{ marginTop: 2 }}>
                    · {i.role || '布料'}：{i.fabric.name} 用 {Number(i.totalUsed).toFixed(2)} 米
                  </div>
                ))}
                {c.note && <div style={{ marginTop: 4, color: '#D85A30' }}>备注：{c.note}</div>}
                <div style={{ marginTop: 4, color: '#aaa', fontSize: 11 }}>
                  {new Date(c.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <TabBar role="CUTTER" />
    </div>
  );
}
