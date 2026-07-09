'use client';

import { useEffect, useState } from 'react';

interface FabricMove {
  id: string; type: string;
  fabricName: string; fabricCode: string; fabricColor: string | null;
  quantityM: number; displayQty: number; displayUnit: string;
  unitPriceM: number | null; totalPrice: number | null;
  userName: string; styleCode: string | null; batchNo: string | null;
  note: string | null; createdAt: string;
}

const TYPE_LABELS: Record<string, { text: string; cls: string }> = {
  IN: { text: '入仓', cls: 'green' },
  CUT: { text: '领取', cls: 'red' },
  RETURN: { text: '退回', cls: 'amber' },
  DEFECT: { text: '次品', cls: 'red' },
};

export function FabricFlowClient() {
  const [moves, setMoves] = useState<FabricMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrice, setShowPrice] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filter) params.set('type', filter);
    const res = await fetch('/api/fabric-moves?' + params.toString());
    const data = await res.json();
    setMoves(data.moves || []);
    setShowPrice(data.showPrice || false);
    setLoading(false);
  }

  function fmtTime(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const filters = [
    { value: '', label: '全部' },
    { value: 'IN', label: '入仓' },
    { value: 'CUT', label: '领取' },
    { value: 'RETURN', label: '退回' },
    { value: 'DEFECT', label: '次品' },
  ];

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} className="badge"
            style={{ padding: '6px 12px', fontSize: 13, whiteSpace: 'nowrap', background: filter === f.value ? '#1D9E75' : '#f0f0f0', color: filter === f.value ? '#fff' : '#666' }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
      {!loading && moves.length === 0 && <div className="empty-state">暂无记录</div>}

      {!loading && moves.map((m) => {
        const t = TYPE_LABELS[m.type] || { text: m.type, cls: 'gray' };
        const isAdd = ['IN', 'RETURN'].includes(m.type);
        return (
          <div key={m.id} className="issue-row">
            <div className="left">
              <div className="name">
                <span className={`badge ${t.cls}`} style={{ marginRight: 6 }}>{t.text}</span>
                {m.fabricName}
                {m.fabricColor ? ` (${m.fabricColor})` : ''}
              </div>
              <div className="meta">
                {m.userName}
                {m.batchNo ? ` · 批次 ${m.batchNo}` : ''}
                {m.styleCode ? ` · ${m.styleCode}` : ''}
                {m.note ? ` · ${m.note}` : ''}
              </div>
            </div>
            <div className="right">
              <div className="qty" style={{ color: isAdd ? '#1D9E75' : '#A32D2D' }}>
                {isAdd ? '+' : '-'}{m.displayQty} {m.displayUnit}
              </div>
              {showPrice && m.totalPrice != null && (
                <div className="time" style={{ color: '#888' }}>¥{m.totalPrice.toFixed(2)}</div>
              )}
              <div className="time">{fmtTime(m.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
