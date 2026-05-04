'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Color { id: string; colorCode: string; colorName: string; }
interface Style {
  id: string; code: string; name: string; season: string | null;
  targetPrice: number | null; laborCost: number; sizes: string[];
  colors: Color[]; bedCount: number;
}

export function StylesListClient({ baseUrl, canCreate = false }: { baseUrl: string; canCreate?: boolean }) {
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Form
  const [fCode, setFCode] = useState('');
  const [fName, setFName] = useState('');
  const [fSeason, setFSeason] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fSizes, setFSizes] = useState('S,M,L,XL,XXL');
  const [fColors, setFColors] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/styles');
    const data = await res.json();
    setStyles(data.styles || []);
    setLoading(false);
  }

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500); }

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  }

  async function createStyle() {
    if (!fCode.trim() || !fName.trim()) { setErr('款号和款名必填'); return; }
    setSubmitting(true); setErr('');
    try {
      const sizes = fSizes.split(',').map((s) => s.trim()).filter(Boolean);
      const colors = fColors.split(',').map((s) => s.trim()).filter(Boolean).map((c) => {
        const parts = c.split('/');
        return { colorCode: (parts[1] || parts[0]).toUpperCase().replace(/\s/g, ''), colorName: parts[0] };
      });
      const res = await fetch('/api/styles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fCode.trim(), name: fName.trim(), season: fSeason || null, targetPrice: Number(fPrice) || null, sizes, colors }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      setFCode(''); setFName(''); setFSeason(''); setFPrice(''); setFSizes('S,M,L,XL,XXL'); setFColors('');
      load(); flash('款式创建成功');
    } catch (e: any) { setErr(e.message); }
    finally { setSubmitting(false); }
  }

  const filtered = keyword
    ? styles.filter((s) => s.code.toLowerCase().includes(keyword.toLowerCase()) || s.name.toLowerCase().includes(keyword.toLowerCase()))
    : styles;

  return (
    <div className="page">
      {msg && <div className="alert success">{msg}</div>}

      {canCreate && !showForm && (
        <button className="submit-btn" style={{ marginBottom: 14 }} onClick={() => { setShowForm(true); setErr(''); }}>+ 新建款式</button>
      )}

      {showForm && (
        <div className="card" style={{ border: '2px solid #1D9E75', marginBottom: 14 }}>
          <h3>新建款式</h3>
          {err && <div className="alert error">{err}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="form-label">款号 *</label><input className="form-input" value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="如 SS26-083" /></div>
            <div><label className="form-label">款名 *</label><input className="form-input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="如 碎花连衣裙" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="form-label">季节</label><input className="form-input" value={fSeason} onChange={(e) => setFSeason(e.target.value)} placeholder="如 2026春夏" /></div>
            <div><label className="form-label">目标售价</label><input className="form-input" type="number" value={fPrice} onChange={(e) => setFPrice(e.target.value)} placeholder="¥" /></div>
          </div>
          <label className="form-label">尺码（逗号分隔）</label>
          <input className="form-input" value={fSizes} onChange={(e) => setFSizes(e.target.value)} placeholder="S,M,L,XL,XXL" />
          <label className="form-label">颜色（逗号分隔，格式：名称/编码）</label>
          <input className="form-input" value={fColors} onChange={(e) => setFColors(e.target.value)} placeholder="如 红色/RED,蓝色/BLUE" />
          <p style={{ fontSize: 12, color: '#888', marginTop: -10, marginBottom: 14 }}>留空可以之后添加</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="submit-btn" style={{ flex: 1 }} onClick={createStyle} disabled={submitting}>{submitting ? '创建中...' : '确认创建'}</button>
            <button className="submit-btn red" style={{ width: 60 }} onClick={() => setShowForm(false)}>取消</button>
          </div>
        </div>
      )}

      <input type="text" className="search-bar" placeholder="搜索款号或款名..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
      {!loading && filtered.length === 0 && <div className="empty-state">没有款式，点击上方"新建款式"添加</div>}

      {!loading && filtered.map((s) => {
        const isOpen = expanded.has(s.id);
        return (
          <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* 款号头 - 点击展开/收起 */}
            <div onClick={() => toggle(s.id)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{s.code} · {s.name}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  {s.colors.length} 色 · {s.bedCount} 床
                  {s.season ? ` · ${s.season}` : ''}
                  {s.targetPrice ? ` · 售价 ¥${s.targetPrice}` : ''}
                </div>
                {s.sizes.length > 0 && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>尺码 {s.sizes.join('/')}</div>}
              </div>
              <span style={{ fontSize: 18, color: '#888', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>›</span>
            </div>

            {/* 颜色子项 */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                {s.colors.length === 0 && (
                  <div style={{ padding: '12px 16px', fontSize: 13, color: '#999' }}>暂无颜色，点击进入详情添加</div>
                )}
                {s.colors.map((c) => (
                  <Link key={c.id} href={`${baseUrl}/${s.id}`}>
                    <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: '#1D9E75' }} />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{c.colorName}</span>
                      </div>
                      <span style={{ fontSize: 14, color: '#888' }}>→</span>
                    </div>
                  </Link>
                ))}

                {/* 进入详情按钮 */}
                <Link href={`${baseUrl}/${s.id}`}>
                  <div style={{ padding: '10px 16px', background: '#f8f9fa', textAlign: 'center', fontSize: 13, color: '#185FA5', fontWeight: 500 }}>
                    查看详情 / 录入裁床 →
                  </div>
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
