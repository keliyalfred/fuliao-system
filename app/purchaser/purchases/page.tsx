import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { prisma } from '@/lib/prisma';

export default async function PurchasesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'PURCHASER' && session.role !== 'FINANCE' && session.role !== 'BOSS') redirect('/home');

  const purchases = await prisma.purchase.findMany({
    include: { items: { include: { material: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="app-shell">
      <TopBar title="采购记录" userName={session.name} roleLabel="采购" />
      <div className="page">
        <h2>采购单</h2>
        {purchases.length === 0 && (
          <div className="card">
            <p style={{ color: '#666', fontSize: 14, lineHeight: 1.8 }}>
              还没有采购记录。<br/>
              后续版本会在这里提供：<br/>
              • 新建采购单<br/>
              • 上传发票照片/PDF<br/>
              • 按月按供应商汇总<br/>
              • 采购入库自动加库存
            </p>
          </div>
        )}
        {purchases.map((p) => (
          <div key={p.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{p.orderNo}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{p.supplier}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>¥ {Number(p.totalAmount).toFixed(2)}</div>
                <div>
                  <span className={`badge ${p.hasInvoice ? 'green' : 'amber'}`}>
                    {p.hasInvoice ? '已开票' : '未开票'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {p.items.length} 项 · {p.createdAt.toLocaleDateString('zh-CN')}
            </div>
          </div>
        ))}
      </div>
      <TabBar role={session.role} />
    </div>
  );
}
