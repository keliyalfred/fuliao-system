'use client';

import { useEffect, useState } from 'react';

interface BomItem { id: string; kind: string; role: string | null; qtyPerPiece: number; unit: string; fabricName: string | null; materialName: string | null; }
interface DemandData { id: string; materialName: string; qtyNeeded: number; qtyIssued: number; unit: string; role: string | null; fulfilled: boolean; }
interface BundleData { id: string; bundleNo: string; color: string | null; size: string | null; quantity: number; status: string; note: string | null; }
interface BedData {
  id: string; bedNo: string; colorName: string; totalPieces: number; status: string;
  sizes: { size: string; quantity: number }[];
  bundles: BundleData[]; demands: DemandData[];
  fabricCost: number | null; materialCost: number | null; laborCost: number | null;
  totalCost: number | null; unitCost: number | null;
  userName: string; createdAt: string;
}
interface ColorData { id: string; colorCode: string; colorName: string; bomItems: BomItem[]; }
interface StyleData {
  id: string; code: string; name: string; season: string | null;
  targetPrice: number | null; sizes: string[]; laborCost: number;
  colors: ColorData[]; beds: BedData[];
}
interface Option { id: string; code: string; name: string; unit?: string; }

export function StyleDetailClient({ styleId, canEdit = false }: { styleId: string; canEdit?: boolean }) {
  const [style, setStyle] = useState<StyleData | null>(null);
  const [showPrice, setShowPrice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [fabrics, setFabrics] = useState<Option[]>([]);
  const [materials, setMaterials] = useState<Option[]>([]);
  const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
  const [showBedForm, setShowBedForm] = useState(false);
  const [bedColorId, setBedColorId] = useState('');
  const [bedSizes, setBedSizes] = useState<Record<string, string>>({});
  const [bedFabrics, setBedFabrics] = useState<{ fabricId: string; role: string; layerLength: string; layerCount: string }[]>([]);
  const [bedMaterials, setBedMaterials] = useState<{ materialId: string; role: string; qtyPerPiece: string; unit: string }[]>([]);
  const [bedBundles, setBedBundles] = useState<{ color: string; size: string; quantity: string; note: string }[]>([]);
  const [bedNote, setBedNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 修改裁床
  const [editBedId, setEditBedId] = useState('');
  const [editSizes, setEditSizes] = useState<Record<string, string>>({});
  const [editFabrics, setEditFabrics] = useState<{ fabricId: string; role: string; layerLength: string; layerCount: string }[]>([]);
  const [editMaterials, setEditMaterials] = useState<{ materialId: string; role: string; qtyPerPiece: string; unit: string }[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => { load(); loadOptions(); }, []);
  async function load() {
    setLoading(true);
    const res = await fetch(`/api/styles/${styleId}`);
    const data = await res.json();
    setStyle(data.style); setShowPrice(data.showPrice);
    if (data.style?.colors) setExpandedColors(new Set(data.style.colors.map((c: any) => c.id)));
    setLoading(false);
  }
  async function loadOptions() {
    const [f, m] = await Promise.all([fetch('/api/fabrics'), fetch('/api/materials')]);
    const fd = await f.json(); const md = await m.json();
    setFabrics((fd.fabrics || []).map((x: any) => ({ id: x.id, code: x.code, name: x.name })));
    setMaterials((md.materials || []).map((x: any) => ({ id: x.id, code: x.code, name: x.name, unit: x.unit })));
  }
  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000); }
  function toggleColor(id: string) { const n = new Set(expandedColors); if (n.has(id)) n.delete(id); else n.add(id); setExpandedColors(n); }
  async function addColor() {
    const name = prompt('颜色名称'); if (!name) return;
    const code = prompt('颜色编码'); if (!code) return;
    await fetch(`/api/styles/${styleId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'addColor', colorCode: code, colorName: name }) });
    load(); flash('颜色已添加');
  }
  async function deleteColor(cid: string) {
    if (!confirm('确定删除？')) return;
    await fetch(`/api/styles/${styleId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deleteColor', colorId: cid }) });
    load(); flash('已删除');
  }

  async function deleteStyle() {
    if (!confirm('确定删除该款式？有裁床记录的将会隐藏。')) return;
    const res = await fetch(`/api/styles/${styleId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deleteStyle' }) });
    const data = await res.json();
    if (res.ok) { flash(data.message); setTimeout(() => window.history.back(), 1000); } else { setErr(data.error); }
  }

  async function deleteBed(bedId: string) {
    if (!confirm('确定删除该裁床？关联的扎号和辅料需求都会删除。')) return;
    const res = await fetch(`/api/styles/${styleId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deleteBed', bedId }) });
    const data = await res.json();
    if (res.ok) { load(); flash(data.message); } else { setErr(data.error); }
  }

  function openEditBed(b: any) {
    setEditBedId(b.id);
    const sizeMap: Record<string, string> = {};
    b.sizes.forEach((s: any) => { sizeMap[s.size] = String(s.quantity); });
    setEditSizes(sizeMap);
    setEditFabrics(b.fabricItems?.map((fi: any) => ({ fabricId: fi.fabricId, role: fi.role || '主布', layerLength: String(fi.layerLength || ''), layerCount: String(fi.layerCount || '') })) || []);
    setEditMaterials(b.demands?.map((d: any) => ({ materialId: d.materialId, role: d.role || '', qtyPerPiece: String(b.totalPieces > 0 ? (d.qtyNeeded / b.totalPieces).toFixed(2) : ''), unit: d.unit || '' })) || []);
  }

  async function saveEditBed() {
    setSubmitting(true); setErr('');
    try {
      const sizes = Object.entries(editSizes).map(([size, qty]) => ({ size, quantity: Number(qty) || 0 })).filter(s => s.quantity > 0);
      const res = await fetch('/api/beds', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'editBed', bedId: editBedId, sizes, fabricItems: editFabrics.filter(f => f.fabricId), materialItems: editMaterials.filter(m => m.materialId) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditBedId(''); load(); flash(data.message);
    } catch (e: any) { setErr(e.message); }
    finally { setSubmitting(false); }
  }

  // 完工标记
  async function completeBed(bedId: string) {
    if (!confirm('确定标记整床完工？')) return;
    const res = await fetch('/api/beds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'completeBed', bedId }) });
    const data = await res.json();
    if (res.ok) { load(); flash(data.message); }
  }
  async function completeBundle(bundleId: string) {
    if (!confirm('确定标记该扎完工？')) return;
    const res = await fetch('/api/beds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'completeBundle', bundleId }) });
    const data = await res.json();
    if (res.ok) { load(); flash(data.message); }
  }

  function openBedForm(cid?: string) {
    if (!style) return;
    const sq: Record<string, string> = {}; (style.sizes || []).forEach((s) => { sq[s] = ''; });
    setBedSizes(sq); setBedColorId(cid || style.colors[0]?.id || '');
    setBedFabrics([{ fabricId: '', role: '主布', layerLength: '', layerCount: '' }]);
    setBedMaterials([{ materialId: '', role: '', qtyPerPiece: '', unit: '个' }]);
    setBedBundles([]); setBedNote(''); setWarnings([]); setErr(''); setShowBedForm(true);
  }
  const bedTotal = Object.values(bedSizes).reduce((s, v) => s + (Number(v) || 0), 0);

  async function submitBed() {
    if (!bedColorId) { setErr('请选择颜色'); return; }
    const sizes = Object.entries(bedSizes).filter(([, v]) => Number(v) > 0).map(([size, qty]) => ({ size, quantity: Number(qty) }));
    if (sizes.length === 0) { setErr('请填写至少一个尺码数量'); return; }
    setSubmitting(true); setErr('');
    try {
      const res = await fetch('/api/beds', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createBed', styleColorId: bedColorId, sizes,
          fabricItems: bedFabrics.filter((f) => f.fabricId && Number(f.layerLength) > 0 && Number(f.layerCount) > 0).map((f) => ({ fabricId: f.fabricId, role: f.role, layerLength: Number(f.layerLength), layerCount: Number(f.layerCount) })),
          materialItems: bedMaterials.filter((m) => m.materialId && Number(m.qtyPerPiece) > 0).map((m) => ({ materialId: m.materialId, role: m.role, qtyPerPiece: Number(m.qtyPerPiece), unit: m.unit })),
          bundles: bedBundles.filter((b) => Number(b.quantity) > 0).map((b) => ({ color: b.color, size: b.size, quantity: Number(b.quantity), note: b.note })),
          note: bedNote,
        }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.materialWarnings?.length) setWarnings(data.materialWarnings);
      flash(data.message); setShowBedForm(false); load();
    } catch (e: any) { setErr(e.message); } finally { setSubmitting(false); }
  }

  if (loading) return <div className="page"><p style={{ textAlign: 'center', color: '#999' }}>加载中...</p></div>;
  if (!style) return <div className="page"><div className="alert error">款式不存在</div></div>;
  const totalCut = style.beds.reduce((s, b) => s + b.totalPieces, 0);
  const bedsByColor: Record<string, BedData[]> = {};
  for (const b of style.beds) { const c = style.colors.find((x) => x.colorName === b.colorName); const k = c?.id || 'x'; if (!bedsByColor[k]) bedsByColor[k] = []; bedsByColor[k].push(b); }

  return (
    <div className="page">
      {msg && <div className="alert success">{msg}</div>}
      {warnings.length > 0 && <div className="alert error"><strong>⚠ 辅料不足：</strong>{warnings.map((w, i) => <div key={i}>{w}</div>)}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{style.code} · {style.name}</h3>
            <p style={{ fontSize: 13, color: '#666' }}>{style.season || ''} · {style.colors.length} 色{style.targetPrice ? ` · 售价 ¥${style.targetPrice}` : ''}{showPrice && style.laborCost > 0 ? ` · 工价 ¥${style.laborCost}/件` : ''}</p>
            {style.sizes.length > 0 && <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>尺码：{style.sizes.join(' / ')}</p>}
            <p style={{ fontSize: 14, color: '#1D9E75', marginTop: 6, fontWeight: 600 }}>累计 {totalCut} 件 · {style.beds.length} 床</p>
          </div>
          {canEdit && <button onClick={deleteStyle} style={{ fontSize: 12, color: '#A32D2D' }}>删除款式</button>}
        </div>
      </div>

      {canEdit && (<div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {!showBedForm && <button className="submit-btn" style={{ flex: 1, fontSize: 14 }} onClick={() => openBedForm()}>+ 录入裁床</button>}
        <button className="submit-btn blue" style={{ flex: 0, fontSize: 14, padding: '12px 16px' }} onClick={addColor}>+ 颜色</button>
      </div>)}

      {/* 裁床录入表单 */}
      {showBedForm && (
        <div className="card" style={{ border: '2px solid #1D9E75' }}>
          <h3>录入裁床 · {style.code}</h3>
          {err && <div className="alert error">{err}</div>}
          <label className="form-label">颜色</label>
          <select className="form-select" value={bedColorId} onChange={(e) => setBedColorId(e.target.value)}>
            {style.colors.map((c) => <option key={c.id} value={c.id}>{c.colorName}</option>)}
          </select>
          <div style={{ background: '#f0faf5', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #c3e6d5' }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#085041' }}>各尺码裁片数量</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ borderBottom: '2px solid #1D9E75' }}>
              {Object.keys(bedSizes).map((s) => <th key={s} style={{ padding: '6px 2px', textAlign: 'center', fontWeight: 600, color: '#085041', minWidth: 45, fontSize: 13 }}>{s}</th>)}
              <th style={{ padding: '6px 2px', textAlign: 'center', fontWeight: 600, color: '#A32D2D', minWidth: 45 }}>合计</th>
            </tr></thead><tbody><tr>
              {Object.keys(bedSizes).map((s) => (<td key={s} style={{ padding: 2 }}><input type="number" style={{ width: '100%', padding: '8px 2px', textAlign: 'center', border: '1px solid #ddd', borderRadius: 6, fontSize: 16, fontWeight: 600 }} value={bedSizes[s]} onChange={(e) => setBedSizes({ ...bedSizes, [s]: e.target.value })} placeholder="0" /></td>))}
              <td style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>{bedTotal}</td>
            </tr></tbody></table>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>布料用量</p>
          {bedFabrics.map((cf, i) => (<div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <select className="form-select" style={{ marginBottom: 0, fontSize: 13 }} value={cf.fabricId} onChange={(e) => { const a = [...bedFabrics]; a[i].fabricId = e.target.value; setBedFabrics(a); }}><option value="">选布料</option>{fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
            <input className="form-input" style={{ marginBottom: 0, fontSize: 13 }} placeholder="用途" value={cf.role} onChange={(e) => { const a = [...bedFabrics]; a[i].role = e.target.value; setBedFabrics(a); }} />
            <input className="form-input" type="number" style={{ marginBottom: 0, fontSize: 13 }} placeholder="每层米" value={cf.layerLength} onChange={(e) => { const a = [...bedFabrics]; a[i].layerLength = e.target.value; setBedFabrics(a); }} />
            <input className="form-input" type="number" style={{ marginBottom: 0, fontSize: 13 }} placeholder="层数" value={cf.layerCount} onChange={(e) => { const a = [...bedFabrics]; a[i].layerCount = e.target.value; setBedFabrics(a); }} />
            {bedFabrics.length > 1 && <button onClick={() => setBedFabrics(bedFabrics.filter((_, j) => j !== i))} style={{ color: '#A32D2D' }}>✕</button>}
          </div>))}
          <button onClick={() => setBedFabrics([...bedFabrics, { fabricId: '', role: '', layerLength: '', layerCount: '' }])} style={{ fontSize: 12, color: '#185FA5', marginBottom: 12 }}>+ 布料</button>
          <div style={{ background: '#fef9f0', borderRadius: 10, padding: 12, marginBottom: 14, border: '1px solid #f0dbb8' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#854F0B', marginBottom: 6 }}>辅料用料（每件）</p>
            {bedMaterials.map((cm, i) => (<div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <select className="form-select" style={{ marginBottom: 0, fontSize: 13 }} value={cm.materialId} onChange={(e) => { const a = [...bedMaterials]; a[i].materialId = e.target.value; const mat = materials.find((x) => x.id === e.target.value); if (mat?.unit) a[i].unit = mat.unit; setBedMaterials(a); }}><option value="">选辅料</option>{materials.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <input className="form-input" style={{ marginBottom: 0, fontSize: 13 }} placeholder="用途" value={cm.role} onChange={(e) => { const a = [...bedMaterials]; a[i].role = e.target.value; setBedMaterials(a); }} />
              <input className="form-input" type="number" step="0.01" style={{ marginBottom: 0, fontSize: 13 }} placeholder="每件量" value={cm.qtyPerPiece} onChange={(e) => { const a = [...bedMaterials]; a[i].qtyPerPiece = e.target.value; setBedMaterials(a); }} />
              <input className="form-input" style={{ marginBottom: 0, fontSize: 13 }} placeholder="单位" value={cm.unit} onChange={(e) => { const a = [...bedMaterials]; a[i].unit = e.target.value; setBedMaterials(a); }} />
              {bedMaterials.length > 1 && <button onClick={() => setBedMaterials(bedMaterials.filter((_, j) => j !== i))} style={{ color: '#A32D2D' }}>✕</button>}
            </div>))}
            <button onClick={() => setBedMaterials([...bedMaterials, { materialId: '', role: '', qtyPerPiece: '', unit: '个' }])} style={{ fontSize: 12, color: '#854F0B', marginTop: 6 }}>+ 辅料</button>
          </div>
          <div style={{ background: '#f5f0ff', borderRadius: 10, padding: 12, marginBottom: 14, border: '1px solid #d5ccee' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#3C3489', marginBottom: 6 }}>扎号（选填，格式同东纺）</p>
            {bedBundles.map((b, i) => (<div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <input className="form-input" style={{ marginBottom: 0, fontSize: 13 }} placeholder="颜色" value={b.color} onChange={(e) => { const a = [...bedBundles]; a[i].color = e.target.value; setBedBundles(a); }} />
              <input className="form-input" style={{ marginBottom: 0, fontSize: 13 }} placeholder="尺码" value={b.size} onChange={(e) => { const a = [...bedBundles]; a[i].size = e.target.value; setBedBundles(a); }} />
              <input className="form-input" type="number" style={{ marginBottom: 0, fontSize: 13 }} placeholder="件数" value={b.quantity} onChange={(e) => { const a = [...bedBundles]; a[i].quantity = e.target.value; setBedBundles(a); }} />
              <input className="form-input" style={{ marginBottom: 0, fontSize: 13 }} placeholder="备注" value={b.note} onChange={(e) => { const a = [...bedBundles]; a[i].note = e.target.value; setBedBundles(a); }} />
              <button onClick={() => setBedBundles(bedBundles.filter((_, j) => j !== i))} style={{ color: '#A32D2D' }}>✕</button>
            </div>))}
            <button onClick={() => setBedBundles([...bedBundles, { color: '', size: '', quantity: '', note: '' }])} style={{ fontSize: 12, color: '#3C3489' }}>+ 扎号</button>
          </div>
          <label className="form-label">备注</label>
          <input className="form-input" value={bedNote} onChange={(e) => setBedNote(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="submit-btn" style={{ flex: 1 }} onClick={submitBed} disabled={submitting || bedTotal === 0}>{submitting ? '提交中...' : `确认录入（${bedTotal}件）`}</button>
            <button className="submit-btn red" style={{ width: 60 }} onClick={() => setShowBedForm(false)}>取消</button>
          </div>
        </div>
      )}

      {/* 颜色分组 */}
      {style.colors.map((c) => {
        const colorBeds = bedsByColor[c.id] || [];
        const colorTotal = colorBeds.reduce((s, b) => s + b.totalPieces, 0);
        const isOpen = expandedColors.has(c.id);
        return (
          <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div onClick={() => toggleColor(c.id)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isOpen ? '#f8f9fa' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: '#1D9E75' }} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>{c.colorName}</span>
                <span style={{ fontSize: 12, color: '#888' }}>{colorBeds.length}床 · {colorTotal}件</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {canEdit && <button onClick={(e) => { e.stopPropagation(); openBedForm(c.id); }} style={{ fontSize: 11, padding: '3px 8px', background: '#E1F5EE', color: '#085041', borderRadius: 6 }}>+裁床</button>}
                <span style={{ fontSize: 16, color: '#888', transform: isOpen ? 'rotate(90deg)' : 'none' }}>›</span>
              </div>
            </div>
            {isOpen && (<div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              {colorBeds.length === 0 && <div style={{ padding: 16, fontSize: 13, color: '#999', textAlign: 'center' }}>暂无裁床</div>}
              {colorBeds.map((b) => (
                <div key={b.id} style={{ padding: '10px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`badge ${b.status === 'done' ? 'green' : 'amber'}`} style={{ fontSize: 11 }}>{b.bedNo}</span>
                        {b.status === 'done' && <span style={{ fontSize: 11, color: '#1D9E75' }}>✓ 完工</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{b.sizes.map((s) => `${s.size}×${s.quantity}`).join(' ')} = <strong>{b.totalPieces}</strong>件</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{b.userName} · {new Date(b.createdAt).toLocaleDateString('zh-CN')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {showPrice && b.unitCost != null && <div style={{ fontSize: 14, fontWeight: 600, color: '#1D9E75' }}>¥{b.unitCost.toFixed(2)}/件</div>}
                      {b.status !== 'done' && <button onClick={() => completeBed(b.id)} style={{ fontSize: 11, padding: '3px 8px', background: '#E1F5EE', color: '#085041', borderRadius: 6, marginTop: 4 }}>整床完工</button>}
                      {canEdit && <button onClick={() => openEditBed(b)} style={{ fontSize: 11, padding: '3px 8px', background: '#E6F1FB', color: '#0C447C', borderRadius: 6, marginTop: 4, marginLeft: 4 }}>修改</button>}
                      {canEdit && <button onClick={() => deleteBed(b.id)} style={{ fontSize: 11, padding: '3px 8px', color: '#A32D2D', marginTop: 4, marginLeft: 4 }}>删除</button>}
                    </div>
                  </div>

                  {/* 修改裁床表单 */}
                  {editBedId === b.id && (
                    <div style={{ margin: '8px 0', padding: 12, background: '#f0faf5', borderRadius: 8, border: '1px solid #c3e6d5' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#085041', marginBottom: 8 }}>修改裁床数据</p>
                      {err && <div className="alert error" style={{ marginBottom: 8 }}>{err}</div>}
                      
                      <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>尺码数量</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {Object.entries(editSizes).map(([size, qty]) => (
                          <div key={size} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12 }}>{size}</span>
                            <input type="number" style={{ width: 50, padding: '3px 4px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12, textAlign: 'center' }}
                              value={qty} onChange={(e) => setEditSizes({ ...editSizes, [size]: e.target.value })} />
                          </div>
                        ))}
                      </div>

                      <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>布料用量</p>
                      {editFabrics.map((ef, i) => {
                        const fab = fabrics.find(f => f.id === ef.fabricId);
                        return (
                          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                            <span style={{ minWidth: 60 }}>{fab?.label || '布料'}</span>
                            <span>每层</span>
                            <input type="number" step="0.1" style={{ width: 55, padding: '2px 4px', border: '1px solid #ddd', borderRadius: 4, textAlign: 'center' }}
                              value={ef.layerLength} onChange={(e) => { const n = [...editFabrics]; n[i].layerLength = e.target.value; setEditFabrics(n); }} />
                            <span>米 ×</span>
                            <input type="number" style={{ width: 40, padding: '2px 4px', border: '1px solid #ddd', borderRadius: 4, textAlign: 'center' }}
                              value={ef.layerCount} onChange={(e) => { const n = [...editFabrics]; n[i].layerCount = e.target.value; setEditFabrics(n); }} />
                            <span>层 = {(Number(ef.layerLength) * Number(ef.layerCount)).toFixed(1)}米</span>
                          </div>
                        );
                      })}

                      {editMaterials.length > 0 && (
                        <>
                          <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, marginTop: 8 }}>辅料用量（每件）</p>
                          {editMaterials.map((em, i) => {
                            const mat = materials.find(m => m.id === em.materialId);
                            return (
                              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                                <span style={{ minWidth: 60 }}>{mat?.label || '辅料'}</span>
                                <input type="number" step="0.1" style={{ width: 55, padding: '2px 4px', border: '1px solid #ddd', borderRadius: 4, textAlign: 'center' }}
                                  value={em.qtyPerPiece} onChange={(e) => { const n = [...editMaterials]; n[i].qtyPerPiece = e.target.value; setEditMaterials(n); }} />
                                <span>{em.unit}/件</span>
                              </div>
                            );
                          })}
                        </>
                      )}

                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="submit-btn" style={{ flex: 1, padding: '8px 0' }} onClick={saveEditBed} disabled={submitting}>{submitting ? '保存中...' : '保存修改'}</button>
                        <button onClick={() => setEditBedId('')} style={{ padding: '8px 14px', background: '#f0f0f0', borderRadius: 6, fontSize: 13 }}>取消</button>
                      </div>
                    </div>
                  )}
                  {/* 扎号列表 */}
                  {b.bundles.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: '1px solid #eee', color: '#888' }}>
                          <th style={{ padding: '3px 4px', textAlign: 'left', fontWeight: 500 }}>扎号</th>
                          <th style={{ padding: '3px 4px', textAlign: 'left', fontWeight: 500 }}>颜色</th>
                          <th style={{ padding: '3px 4px', textAlign: 'left', fontWeight: 500 }}>尺码</th>
                          <th style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 500 }}>件数</th>
                          <th style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 500 }}>状态</th>
                        </tr></thead>
                        <tbody>{b.bundles.map((bu) => (
                          <tr key={bu.id} style={{ borderBottom: '0.5px solid #f5f5f5' }}>
                            <td style={{ padding: '4px' }}>第{bu.bundleNo}扎</td>
                            <td style={{ padding: '4px' }}>{bu.color || '-'}</td>
                            <td style={{ padding: '4px' }}>{bu.size || '-'}</td>
                            <td style={{ padding: '4px', textAlign: 'right', fontWeight: 500 }}>{bu.quantity}</td>
                            <td style={{ padding: '4px', textAlign: 'right' }}>
                              {bu.status === 'done'
                                ? <span style={{ color: '#1D9E75' }}>✓</span>
                                : <button onClick={() => completeBundle(bu.id)} style={{ fontSize: 11, padding: '2px 6px', background: '#FAEEDA', color: '#633806', borderRadius: 4 }}>完工</button>
                              }
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                  {/* 辅料需求 */}
                  {b.demands.length > 0 && (
                    <div style={{ marginTop: 6, padding: 6, background: '#fef9f0', borderRadius: 6, fontSize: 11 }}>
                      {b.demands.map((d) => (<div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                        <span>{d.materialName}{d.role ? `(${d.role})` : ''}</span>
                        <span>需{d.qtyNeeded} {d.fulfilled ? <span style={{ color: '#1D9E75' }}>✓</span> : <span style={{ color: '#A32D2D' }}>{d.qtyIssued}/{d.qtyNeeded}</span>}</span>
                      </div>))}
                    </div>
                  )}
                </div>
              ))}
            </div>)}
          </div>
        );
      })}
    </div>
  );
}
