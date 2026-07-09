'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Summary {
  totalMaterials: number; totalAssetValue: number; totalDefect: number; totalWaste: number;
  lowStockCount: number; outOfStockCount: number;
  monthOut: number; monthDefect: number; monthWaste: number; monthReturn: number; monthIn: number;
  todayOperations: number;
}
interface LowItem { id: string; code: string; name: string; stock: number; minStock: number; unit: string; }
interface RecentIssue { id: string; type: string; materialName: string; quantity: number; unit: string; userName: string; createdAt: string; }

const TYPE_LABEL: Record<string, string> = {
  OUT: '领料', RETURN: '退料', DEFECT: '次品', WASTE: '废品', IN: '入库',
  DEFECT_TO_WASTE: '次→废', DEFECT_RETURN_SUPPLIER: '退供', RESHELF: '返修',
};
const TYPE_COLOR: Record<string, string> = {
  OUT: 'green', RETURN: 'amber', DEFECT: 'amber', WASTE: 'red', IN: 'gray',
  DEFECT_TO_WASTE: 'red', DEFECT_RETURN_SUPPLIER: 'gray', RESHELF: 'green',
};

export function BossDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lowStock, setLowStock] = useState<LowItem[]>([]);
  const [recent, setRecent] = useState<RecentIssue[]>([]);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
        setLowStock(d.lowStockItems || []);
        setRecent(d.recentIssues || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="page"><p style={{ textAlign: 'center', color: '#999' }}>加载中...</p></div>;
  if (!summary) return <div className="page"><div className="alert error">数据加载失败</div></div>;

  const now = new Date();
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日`;

  return (
    <div className="page">
      <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>本月概览 · 截至 {dateStr}</p>
      <p style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>今日已操作 {summary.todayOperations} 次</p>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">良品资产总值</div>
          <div className="value">¥ {fmt(summary.totalAssetValue)}</div>
        </div>
        <div className="stat">
          <div className="label">辅料品种数</div>
          <div className="value">{summary.totalMaterials}</div>
        </div>
        <div className="stat">
          <div className="label">本月领料</div>
          <div className="value green">¥ {fmt(summary.monthOut)}</div>
        </div>
        <div className="stat">
          <div className="label">本月次品损耗</div>
          <div className="value red">¥ {fmt(summary.monthDefect)}</div>
        </div>
      </div>

      {/* Defect/Waste summary */}
      {(summary.totalDefect > 0 || summary.totalWaste > 0) && (
        <div className="card" style={{ display: 'flex', gap: 20 }}>
          <div>
            <p style={{ fontSize: 12, color: '#BA7517' }}>次品总数</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#BA7517' }}>{summary.totalDefect}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#A32D2D' }}>废品总数</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#A32D2D' }}>{summary.totalWaste}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {(summary.lowStockCount > 0 || summary.outOfStockCount > 0) && (
        <div className="card" style={{ background: '#FCEBEB' }}>
          <h3 style={{ color: '#A32D2D', marginBottom: 6 }}>需要关注</h3>
          {summary.outOfStockCount > 0 && <p style={{ fontSize: 14 }}>● {summary.outOfStockCount} 项辅料已缺货</p>}
          {summary.lowStockCount > 0 && <p style={{ fontSize: 14 }}>● {summary.lowStockCount} 项辅料库存偏低</p>}
        </div>
      )}

      {/* Low stock items */}
      {lowStock.length > 0 && (
        <div className="card">
          <h3>库存紧张的辅料</h3>
          {lowStock.map((m) => (
            <div key={m.id} className="issue-row">
              <div className="left">
                <div className="name">{m.name}</div>
                <div className="meta">{m.code} · 安全库存 {m.minStock} {m.unit}</div>
              </div>
              <div className="right">
                <div className="qty" style={{ color: '#A32D2D' }}>{m.stock} {m.unit}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent */}
      <div className="card">
        <h3>最近操作</h3>
        {recent.map((i) => {
          const isAdd = ['IN', 'RETURN', 'RESHELF'].includes(i.type);
          return (
            <div key={i.id} className="issue-row">
              <div className="left">
                <div className="name">
                  <span className={`badge ${TYPE_COLOR[i.type] || 'gray'}`} style={{ marginRight: 6 }}>{TYPE_LABEL[i.type] || i.type}</span>
                  {i.materialName}
                </div>
                <div className="meta">{i.userName} · {fmtTime(i.createdAt)}</div>
              </div>
              <div className="right">
                <div className="qty" style={{ color: isAdd ? '#1D9E75' : '#A32D2D' }}>
                  {isAdd ? '+' : '-'}{i.quantity} {i.unit}
                </div>
              </div>
            </div>
          );
        })}
        {recent.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>暂无操作记录</p>}
      </div>

      {/* Quick links */}
      <div className="card">
        <h3>快捷操作</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <a href="/boss/styles" style={{ padding: '12px 10px', background: '#E1F5EE', color: '#085041', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ✂ 裁片录入
          </a>
          <a href="/boss/fabrics" style={{ padding: '12px 10px', background: '#E6F1FB', color: '#0C447C', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ▤ 布料管理
          </a>
          <a href="/boss/materials" style={{ padding: '12px 10px', background: '#EEEDFE', color: '#3C3489', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ▦ 辅料管理
          </a>
          <a href="/purchases" style={{ padding: '12px 10px', background: '#FAEEDA', color: '#854F0B', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            🚚 采购在途
          </a>
          <a href="/boss/demands" style={{ padding: '12px 10px', background: '#FAEEDA', color: '#633806', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ⊘ 辅料需求
          </a>
          <a href="/boss/fabric-flow" style={{ padding: '12px 10px', background: '#f0f0f0', color: '#333', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ☰ 布料流水
          </a>
          <a href="/boss/records" style={{ padding: '12px 10px', background: '#f0f0f0', color: '#333', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ☰ 辅料流水
          </a>
          <a href="/boss/labor" style={{ padding: '12px 10px', background: '#FBEAF0', color: '#72243E', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ¥ 工价管理
          </a>
          <a href="/boss/users" style={{ padding: '12px 10px', background: '#FCEBEB', color: '#501313', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ⊙ 员工管理
          </a>
          <a href="/boss/reports" style={{ padding: '12px 10px', background: '#FBEAF0', color: '#72243E', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ▧ 成本报表
          </a>
          <a href="/worker/action/OUT" style={{ padding: '12px 10px', background: '#E1F5EE', color: '#085041', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ⊕ 领料操作
          </a>
          <a href="/worker/action/RETURN" style={{ padding: '12px 10px', background: '#E6F1FB', color: '#0C447C', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ⊕ 退料
          </a>
          <a href="/worker/action/WASTE" style={{ padding: '12px 10px', background: '#FCEBEB', color: '#501313', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ⊕ 报废品
          </a>
          <a href="/worker/action/SPECIAL" style={{ padding: '12px 10px', background: '#FAEEDA', color: '#633806', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ⊕ 专机领料
          </a>
          <a href="/boss/expenses" style={{ padding: '12px 10px', background: '#EEEDFE', color: '#3C3489', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ◉ 财务凭证
          </a>
          <a href="/boss/ec-tax" style={{ padding: '12px 10px', background: '#E6F1FB', color: '#0C447C', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
            ◉ 电商报税
          </a>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) { return n.toLocaleString('zh-CN', { maximumFractionDigits: 1 }); }
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
