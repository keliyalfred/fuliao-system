'use client';

import { useEffect, useState } from 'react';

interface StyleCost {
  id: string; code: string; name: string;
  laborCost: number; packCost: number; shipCost: number;
  targetPrice: number | null;
}

export function LaborCostClient() {
  const [styles, setStyles] = useState<StyleCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabor, setEditLabor] = useState('');
  const [editPack, setEditPack] = useState('');
  const [editShip, setEditShip] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/labor');
    const data = await res.json();
    setStyles(data.styles || []);
    setLoading(false);
  }

  async function save(styleId: string) {
    const res = await fetch('/api/labor', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        styleId,
        laborCost: Number(editLabor) || 0,
        packCost: Number(editPack) || 0,
        shipCost: Number(editShip) || 0,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setEditing(null); load();
      setMsg(data.message); setTimeout(() => setMsg(''), 2000);
    }
  }

  return (
    <div className="page">
      <h2>工价 · 包装 · 运费</h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>设置每件衣服的工价、包装费、运费，用于成本计算</p>
      {msg && <div className="alert success">{msg}</div>}

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}

      {styles.map((s) => (
        <div key={s.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{s.code} · {s.name}</div>
              {s.targetPrice && <div style={{ fontSize: 12, color: '#888' }}>售价 ¥{s.targetPrice}</div>}
            </div>
            {editing !== s.id && (
              <button onClick={() => {
                setEditing(s.id);
                setEditLabor(String(s.laborCost));
                setEditPack(String(s.packCost));
                setEditShip(String(s.shipCost));
              }} style={{ fontSize: 13, color: '#185FA5', padding: '6px 12px', background: '#E6F1FB', borderRadius: 6 }}>编辑</button>
            )}
          </div>

          {editing === s.id ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">工价/件</label>
                  <input className="form-input" type="number" step="0.01" value={editLabor}
                    onChange={(e) => setEditLabor(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">包装/件</label>
                  <input className="form-input" type="number" step="0.01" value={editPack}
                    onChange={(e) => setEditPack(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">运费/件</label>
                  <input className="form-input" type="number" step="0.01" value={editShip}
                    onChange={(e) => setEditShip(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => save(s.id)} style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', borderRadius: 6, fontSize: 13 }}>保存</button>
                <button onClick={() => setEditing(null)} style={{ padding: '6px 14px', background: '#f0f0f0', borderRadius: 6, fontSize: 13 }}>取消</button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: 'flex', gap: 14, fontSize: 14 }}>
              <span>工价 <strong style={{ color: s.laborCost > 0 ? '#1D9E75' : '#ccc' }}>¥{s.laborCost}</strong>/件</span>
              <span>包装 <strong style={{ color: s.packCost > 0 ? '#1D9E75' : '#ccc' }}>¥{s.packCost}</strong>/件</span>
              <span>运费 <strong style={{ color: s.shipCost > 0 ? '#1D9E75' : '#ccc' }}>¥{s.shipCost}</strong>/件</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
