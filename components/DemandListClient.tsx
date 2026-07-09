'use client';

import { useEffect, useState } from 'react';

interface Demand {
  id: string; batchNo: string;
  styleCode: string; styleName: string; colorName: string; totalPieces: number;
  materialId: string; materialName: string; materialCode: string; categoryName: string;
  currentStock: number; qtyNeeded: number; qtyIssued: number; qtyRemaining: number;
  unit: string; role: string | null; fulfilled: boolean; shortage: boolean;
  createdAt: string;
}

export function DemandListClient() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [issuing, setIssuing] = useState<string | null>(null);
  const [issueQty, setIssueQty] = useState('');

  useEffect(() => { load(); }, [showAll]);

  async function load() {
    setLoading(true);
    const url = showAll ? '/api/demands' : '/api/demands?pending=1';
    const res = await fetch(url);
    const data = await res.json();
    setDemands(data.demands || []);
    setLoading(false);
  }

  async function fulfill(demandId: string) {
    const qty = Number(issueQty);
    if (!qty || qty <= 0) { setErr('请输入领取数量'); return; }
    setErr('');
    try {
      const res = await fetch('/api/demands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demandId, quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIssuing(null); setIssueQty('');
      setMsg(data.message); setTimeout(() => setMsg(''), 2000);
      load();
    } catch (e: any) { setErr(e.message); }
  }

  const pendingCount = demands.filter((d) => !d.fulfilled).length;
  const shortageCount = demands.filter((d) => d.shortage && !d.fulfilled).length;

  return (
    <div className="page">
      {msg && <div className="alert success">{msg}</div>}
      {err && <div className="alert error">{err}</div>}

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="label">待领取</div>
          <div className="value red">{pendingCount}</div>
        </div>
        <div className="stat">
          <div className="label">库存不足</div>
          <div className="value red">{shortageCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setShowAll(false)} className="badge"
          style={{ padding: '8px 14px', fontSize: 13, background: !showAll ? '#1D9E75' : '#f0f0f0', color: !showAll ? '#fff' : '#666' }}>
          待领取
        </button>
        <button onClick={() => setShowAll(true)} className="badge"
          style={{ padding: '8px 14px', fontSize: 13, background: showAll ? '#1D9E75' : '#f0f0f0', color: showAll ? '#fff' : '#666' }}>
          全部
        </button>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
      {!loading && demands.length === 0 && <div className="empty-state">暂无辅料需求</div>}

      {!loading && demands.map((d) => (
        <div key={d.id} className={`material-item${d.shortage ? ' danger' : d.fulfilled ? '' : ' warn'}`}
          style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="name">{d.materialName}</div>
              <div className="meta">
                批次 {d.batchNo} · {d.styleCode} {d.colorName} · {d.totalPieces}件
                {d.role ? ` · ${d.role}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {d.fulfilled
                ? <span className="badge green">已完成</span>
                : d.shortage
                  ? <span className="badge red">库存不足</span>
                  : <span className="badge amber">待领取</span>
              }
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 13 }}>
            <span>需要 <strong>{d.qtyNeeded}</strong> {d.unit}</span>
            <span style={{ color: '#1D9E75' }}>已领 <strong>{d.qtyIssued}</strong></span>
            {!d.fulfilled && <span style={{ color: '#A32D2D' }}>还差 <strong>{d.qtyRemaining}</strong></span>}
            <span style={{ color: '#888' }}>库存 {d.currentStock}</span>
          </div>

          {!d.fulfilled && (
            <div style={{ marginTop: 8 }}>
              {issuing === d.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" className="form-input" style={{ flex: 1, marginBottom: 0, height: 36 }}
                    placeholder={`领取数量（还差${d.qtyRemaining}）`}
                    value={issueQty} onChange={(e) => setIssueQty(e.target.value)} />
                  <button onClick={() => fulfill(d.id)}
                    style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', borderRadius: 6, fontSize: 13 }}>确认</button>
                  <button onClick={() => { setIssuing(null); setErr(''); }}
                    style={{ padding: '6px 10px', background: '#f0f0f0', borderRadius: 6, fontSize: 13 }}>取消</button>
                </div>
              ) : (
                <button onClick={() => { setIssuing(d.id); setIssueQty(String(d.qtyRemaining)); setErr(''); }}
                  style={{ padding: '6px 14px', background: '#E1F5EE', color: '#085041', borderRadius: 6, fontSize: 13 }}>领取辅料</button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
