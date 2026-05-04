'use client';

import { useEffect, useState } from 'react';

interface Issue {
  id: string; type: string; materialName: string; materialCode: string;
  categoryName: string; unit: string; quantity: number; unitPrice: number;
  totalPrice: number; userName: string; styleCode?: string; note?: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { text: string; cls: string }> = {
  IN: { text: '入库', cls: 'green' },
  OUT: { text: '领料', cls: 'red' },
  RETURN: { text: '退料', cls: 'green' },
  DEFECT: { text: '报次品', cls: 'amber' },
  WASTE: { text: '报废品', cls: 'red' },
  DEFECT_TO_WASTE: { text: '次→废', cls: 'red' },
  DEFECT_RETURN_SUPPLIER: { text: '次品退供', cls: 'gray' },
  RESHELF: { text: '返修', cls: 'green' },
};

export function IssuesListClient({ scope = 'all' }: { scope?: 'all' | 'mine' }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ scope, limit: '50' });
    if (filter) params.set('type', filter);
    const res = await fetch('/api/issues/list?' + params.toString());
    const data = await res.json();
    setIssues(data.issues || []);
    setLoading(false);
  }

  function fmtTime(iso: string) {
    const d = new Date(iso);
    const mm = d.getMonth() + 1, dd = d.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  }

  const filterButtons = [
    { value: '', label: '全部' },
    { value: 'IN', label: '入库' },
    { value: 'OUT', label: '领料' },
    { value: 'RETURN', label: '退料' },
    { value: 'DEFECT', label: '次品' },
    { value: 'WASTE', label: '废品' },
  ];

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
        {filterButtons.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} className="badge"
            style={{ padding: '6px 12px', fontSize: 13, whiteSpace: 'nowrap', background: filter === f.value ? '#1D9E75' : '#f0f0f0', color: filter === f.value ? '#fff' : '#666' }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
      {!loading && issues.length === 0 && <div className="empty-state">暂无记录</div>}

      {!loading && issues.map((i) => {
        const t = TYPE_LABELS[i.type] || { text: i.type, cls: 'gray' };
        const isAdd = ['IN', 'RETURN', 'RESHELF'].includes(i.type);
        return (
          <div key={i.id} className="issue-row">
            <div className="left">
              <div className="name">
                <span className={`badge ${t.cls}`} style={{ marginRight: 6 }}>{t.text}</span>
                {i.materialName}
              </div>
              <div className="meta">
                {i.userName}{i.styleCode ? ` · ${i.styleCode}` : ''}{i.note ? ` · ${i.note}` : ''}
              </div>
            </div>
            <div className="right">
              <div className="qty" style={{ color: isAdd ? '#1D9E75' : '#A32D2D' }}>
                {isAdd ? '+' : '-'}{i.quantity} {i.unit}
              </div>
              <div className="time">{fmtTime(i.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
