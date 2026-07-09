'use client';

import { useEffect, useState } from 'react';

interface FabricColor { id: string; colorName: string; stock: number; unitPriceM: number | null; dyePerUnit: number | null; effectivePriceM: number | null; dyeCostTotal: number | null; note: string | null; }
interface Fabric {
  id: string; code: string; name: string; type: string;
  composition: string | null; width: number | null;
  unitPriceM: number | null; dyePerUnitM: number | null; effectivePriceM: number | null; dyeCostTotal: number | null;
  totalStock: number;
  supplier: string | null; location: string | null;
  stock: number; color: string | null;
  colors: FabricColor[];
}

const M_PER_YARD = 0.9144;

export function FabricAdminClient({ canEdit = false, canOperate = false, canDeleteMove = false }: { canEdit?: boolean; canOperate?: boolean; canDeleteMove?: boolean }) {
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [showPrice, setShowPrice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [keyword, setKeyword] = useState('');

  // 流水记录
  const [showFlowId, setShowFlowId] = useState('');
  const [flowRecords, setFlowRecords] = useState<any[]>([]);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowCanDelete, setFlowCanDelete] = useState(false);

  // New fabric form
  const [showForm, setShowForm] = useState(false);
  const [fCode, setFCode] = useState('');
  const [fName, setFName] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fSupplier, setFSupplier] = useState('');

  // Operation state
  const [opFabricId, setOpFabricId] = useState('');
  const [opColorId, setOpColorId] = useState('');
  const [opType, setOpType] = useState(''); // stockIn/stockOut/stockReturn
  const [opQty, setOpQty] = useState('');
  const [opUnit, setOpUnit] = useState<'米' | '码'>('米');
  const [opPrice, setOpPrice] = useState('');
  const [opPricePerYard, setOpPricePerYard] = useState(false);
  const [opDye, setOpDye] = useState('');
  const [opNote, setOpNote] = useState('');

  // Add color
  const [addColorFabricId, setAddColorFabricId] = useState('');
  const [newColorName, setNewColorName] = useState('');
  const [newColorPrice, setNewColorPrice] = useState('');

  // 修改颜色价格
  const [editingColorId, setEditingColorId] = useState('');
  const [editColorPrice, setEditColorPrice] = useState('');

  // 修正染费(总额+数量)
  const [editingDyeId, setEditingDyeId] = useState('');
  const [editDyeTotal, setEditDyeTotal] = useState('');
  const [editDyeQty, setEditDyeQty] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/fabrics');
    const data = await res.json();
    setFabrics(data.fabrics || []); setShowPrice(data.showPrice);
    setLoading(false);
  }

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500); }
  function toggle(id: string) { const n = new Set(expanded); if (n.has(id)) n.delete(id); else n.add(id); setExpanded(n); }

  async function toggleFlow(fabricId: string) {
    if (showFlowId === fabricId) { setShowFlowId(''); return; }
    setShowFlowId(fabricId); setFlowLoading(true);
    const res = await fetch(`/api/fabric-moves?fabricId=${fabricId}&limit=20`);
    const data = await res.json();
    setFlowRecords(data.moves || []);
    setFlowCanDelete(!!data.canDelete);
    setFlowLoading(false);
  }

  async function createFabric() {
    if (!fCode || !fName) { setErr('编号和名称必填'); return; }
    const res = await fetch('/api/fabrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', code: fCode, name: fName, unitPriceM: Number(fPrice) || 0, supplier: fSupplier }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setShowForm(false); setFCode(''); setFName(''); setFPrice(''); setFSupplier('');
    load(); flash(data.message);
  }

  async function deleteFabric(id: string) {
    if (!confirm('确定删除该布料？有历史记录的将会隐藏而不是真正删除。')) return;
    const res = await fetch('/api/fabrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    const data = await res.json();
    if (res.ok) { load(); flash(data.message); } else { setErr(data.error); }
  }

  async function addColor() {
    if (!newColorName) { setErr('颜色名必填'); return; }
    const res = await fetch('/api/fabrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addColor', fabricId: addColorFabricId, colorName: newColorName, unitPriceM: Number(newColorPrice) || null }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setAddColorFabricId(''); setNewColorName(''); setNewColorPrice('');
    load(); flash(data.message);
  }

  async function deleteColor(colorId: string) {
    if (!confirm('确定删除该颜色？')) return;
    await fetch('/api/fabrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deleteColor', colorId }) });
    load(); flash('已删除');
  }

  function openOp(fabricId: string, colorId: string, type: string) {
    setOpFabricId(fabricId); setOpColorId(colorId); setOpType(type);
    setOpQty(''); setOpUnit('米'); setOpPrice(''); setOpPricePerYard(false); setOpDye(''); setOpNote(''); setErr('');
  }

  async function submitOp() {
    if (!opQty || Number(opQty) <= 0) { setErr('请填写数量'); return; }
    const res = await fetch('/api/fabrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: opType, fabricId: opFabricId,
        colorId: opColorId || null, quantity: Number(opQty), unit: opUnit,
        unitPriceM: opPrice ? Number(opPrice) : undefined,
        priceIsPerYard: opPricePerYard,
        dyeCost: opType === 'stockIn' && opDye ? Number(opDye) : undefined,
        note: opNote,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setOpType(''); load(); flash(data.message);
  }

  async function saveColorDye(colorId: string) {
    if (!editDyeQty || Number(editDyeQty) <= 0) { setErr('请填写这批染了多少米'); return; }
    const res = await fetch('/api/fabrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setColorDye', colorId, dyeTotal: Number(editDyeTotal) || 0, dyeQty: Number(editDyeQty) || 0 }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setEditingDyeId(''); load(); flash(data.message);
  }

  async function deleteFlow(moveId: string) {
    if (!confirm('确定删除这条流水记录？会同时回滚库存和染费。')) return;
    const res = await fetch('/api/fabrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteMove', moveId }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    // 刷新流水
    if (showFlowId) toggleFlow(showFlowId), toggleFlow(showFlowId);
    load(); flash(data.message);
  }

  // 修改颜色价格
  async function updateColorPrice(colorId: string) {
    const res = await fetch('/api/fabrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateColor', colorId, unitPriceM: Number(editColorPrice) || 0 }),
    });
    const data = await res.json();
    if (res.ok) { setEditingColorId(''); load(); flash(data.message); } else { setErr(data.error); }
  }

  const filtered = keyword
    ? fabrics.filter((f) => f.code.toLowerCase().includes(keyword.toLowerCase()) || f.name.toLowerCase().includes(keyword.toLowerCase()))
    : fabrics;

  const totalStock = filtered.reduce((s, f) => s + f.totalStock, 0);
  const totalValue = showPrice ? filtered.reduce((s, f) => s + f.totalStock * (f.unitPriceM || 0), 0) : 0;

  const opLabels: Record<string, string> = { stockIn: '入仓', stockOut: '领取', stockReturn: '退回' };

  return (
    <div className="page">
      {msg && <div className="alert success">{msg}</div>}
      {err && <div className="alert error">{err}<button onClick={() => setErr('')} style={{ float: 'right' }}>✕</button></div>}

      {/* 汇总 */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <div><div style={{ fontSize: 12, color: '#888' }}>总库存</div><div style={{ fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>{totalStock.toFixed(1)} 米</div></div>
        {showPrice && <div><div style={{ fontSize: 12, color: '#888' }}>总价值</div><div style={{ fontSize: 18, fontWeight: 700 }}>¥{totalValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</div></div>}
        <div><div style={{ fontSize: 12, color: '#888' }}>品种</div><div style={{ fontSize: 18, fontWeight: 700 }}>{filtered.length}</div></div>
      </div>

      {/* 新增布料 */}
      {canEdit && !showForm && <button className="submit-btn" style={{ marginBottom: 14 }} onClick={() => { setShowForm(true); setErr(''); }}>+ 新增布料</button>}
      {showForm && (
        <div className="card" style={{ border: '2px solid #1D9E75', marginBottom: 14 }}>
          <h3>新增布料</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="form-label">编号</label><input className="form-input" value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="如 FB-001" /></div>
            <div><label className="form-label">名称</label><input className="form-input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="如 雪纺" /></div>
            <div><label className="form-label">单价(¥/米)</label><input className="form-input" type="number" value={fPrice} onChange={(e) => setFPrice(e.target.value)} /></div>
            <div><label className="form-label">供应商</label><input className="form-input" value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} /></div>
          </div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>创建后可以在编号下添加多个颜色</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="submit-btn" style={{ flex: 1 }} onClick={createFabric}>确认</button>
            <button className="submit-btn red" style={{ width: 60 }} onClick={() => setShowForm(false)}>取消</button>
          </div>
        </div>
      )}

      <input type="text" className="search-bar" placeholder="搜索布料名称/编码..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>首次加载可能需要几秒...</p>}

      {/* 操作弹窗 */}
      {opType && (
        <div className="card" style={{ border: '2px solid #1D9E75', marginBottom: 14 }}>
          <h3>{opLabels[opType]}</h3>
          <label className="form-label">数量</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <input className="form-input" type="number" step="0.1" style={{ marginBottom: 0, flex: 1, textAlign: 'center' }} value={opQty} onChange={(e) => setOpQty(e.target.value)} placeholder="0" />
            <button onClick={() => setOpUnit('米')} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #1D9E75', background: opUnit === '米' ? '#1D9E75' : '#fff', color: opUnit === '米' ? '#fff' : '#1D9E75' }}>米</button>
            <button onClick={() => setOpUnit('码')} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #1D9E75', background: opUnit === '码' ? '#1D9E75' : '#fff', color: opUnit === '码' ? '#fff' : '#1D9E75' }}>码</button>
          </div>
          {Number(opQty) > 0 && (
            <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
              {opUnit === '米' ? `= ${(Number(opQty) / M_PER_YARD).toFixed(1)} 码` : `= ${(Number(opQty) * M_PER_YARD).toFixed(1)} 米`}
            </p>
          )}
          {opType === 'stockIn' && showPrice && (
            <>
              <label className="form-label">单价（留空用默认）</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <input className="form-input" type="number" style={{ marginBottom: 0, flex: 1 }} value={opPrice} onChange={(e) => setOpPrice(e.target.value)} placeholder="0" />
                <button onClick={() => setOpPricePerYard(false)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #185FA5', background: !opPricePerYard ? '#185FA5' : '#fff', color: !opPricePerYard ? '#fff' : '#185FA5', fontSize: 12 }}>¥/米</button>
                <button onClick={() => setOpPricePerYard(true)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #185FA5', background: opPricePerYard ? '#185FA5' : '#fff', color: opPricePerYard ? '#fff' : '#185FA5', fontSize: 12 }}>¥/码</button>
              </div>
              <label className="form-label">本批染费总额（选填）</label>
              <input className="form-input" type="number" step="0.01" value={opDye} onChange={(e) => setOpDye(e.target.value)} placeholder="0" />
              {opDye && Number(opDye) > 0 && Number(opQty) > 0 && (
                <p style={{ fontSize: 12, color: '#185FA5', marginTop: -4, marginBottom: 8 }}>
                  = 每米染费 ¥{(Number(opDye) / (opUnit === '码' ? Number(opQty) * M_PER_YARD : Number(opQty))).toFixed(2)}（加权到该批平均染费）
                </p>
              )}
            </>
          )}
          <label className="form-label">备注</label>
          <input className="form-input" value={opNote} onChange={(e) => setOpNote(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="submit-btn" style={{ flex: 1 }} onClick={submitOp}>确认{opLabels[opType]}</button>
            <button className="submit-btn red" style={{ width: 60 }} onClick={() => setOpType('')}>取消</button>
          </div>
        </div>
      )}

      {/* 布料列表 */}
      {!loading && filtered.map((f) => {
        const isOpen = expanded.has(f.id);
        const hasColors = f.colors.length > 0;
        return (
          <div key={f.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div onClick={() => toggle(f.id)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  [{f.code}]{f.supplier ? ` · ${f.supplier}` : ''}
                  {showPrice && f.unitPriceM ? ` · ¥${f.unitPriceM}/米` : ''}
                  {hasColors ? ` · ${f.colors.length} 色` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1D9E75' }}>{f.totalStock.toFixed(1)} 米</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{(f.totalStock / M_PER_YARD).toFixed(1)} 码</div>
                </div>
                <span style={{ fontSize: 16, color: '#888', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>›</span>
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                {/* 没有颜色子项的旧数据 */}
                {!hasColors && (
                  <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#666' }}>{f.color || '未分颜色'} · {f.stock.toFixed(1)} 米</span>
                    {canOperate && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openOp(f.id, '', 'stockIn')} style={{ fontSize: 11, padding: '3px 8px', background: '#E1F5EE', color: '#085041', borderRadius: 4 }}>入仓</button>
                        <button onClick={() => openOp(f.id, '', 'stockOut')} style={{ fontSize: 11, padding: '3px 8px', background: '#FCEBEB', color: '#501313', borderRadius: 4 }}>领取</button>
                        <button onClick={() => openOp(f.id, '', 'stockReturn')} style={{ fontSize: 11, padding: '3px 8px', background: '#FAEEDA', color: '#633806', borderRadius: 4 }}>退回</button>
                      </div>
                    )}
                  </div>
                )}

                {/* 颜色子项列表 */}
                {hasColors && f.colors.map((c) => (
                  <div key={c.id} style={{ padding: '8px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{c.colorName}</span>
                        <span style={{ fontSize: 13, color: '#1D9E75', marginLeft: 8, fontWeight: 600 }}>{c.stock.toFixed(1)} 米</span>
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>/ {(c.stock / M_PER_YARD).toFixed(1)} 码</span>
                        {showPrice && c.unitPriceM != null && (
                          editingColorId === c.id ? (
                            <span style={{ marginLeft: 6 }}>
                              <input type="number" step="0.01" style={{ width: 70, padding: '2px 4px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12 }}
                                value={editColorPrice} onChange={(e) => setEditColorPrice(e.target.value)} />
                              <button onClick={() => updateColorPrice(c.id)} style={{ fontSize: 10, marginLeft: 4, color: '#1D9E75' }}>✓</button>
                              <button onClick={() => setEditingColorId('')} style={{ fontSize: 10, marginLeft: 2, color: '#888' }}>✕</button>
                            </span>
                          ) : (
                            <span onClick={() => { if (canEdit) { setEditingColorId(c.id); setEditColorPrice(String(c.unitPriceM)); } }}
                              style={{ fontSize: 12, color: '#888', marginLeft: 6, cursor: canEdit ? 'pointer' : 'default', textDecoration: canEdit ? 'underline dotted' : 'none' }}>¥{c.unitPriceM}/米</span>
                          )
                        )}
                        {showPrice && c.dyePerUnit != null && c.dyePerUnit > 0 && (
                          <span style={{ fontSize: 12, color: '#185FA5', marginLeft: 4 }}>+ 染 ¥{c.dyePerUnit.toFixed(2)}/米 = ¥{(c.effectivePriceM ?? 0).toFixed(2)}/米</span>
                        )}
                        {showPrice && canEdit && (
                          editingDyeId === c.id ? (
                            <span style={{ marginLeft: 6, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                              <span style={{ color: '#185FA5' }}>染费总额¥</span>
                              <input type="number" step="0.01" autoFocus style={{ width: 64, padding: '1px 3px', border: '1px solid #185FA5', borderRadius: 4, fontSize: 12, textAlign: 'center' }}
                                value={editDyeTotal} onChange={(e) => setEditDyeTotal(e.target.value)} placeholder="总额" />
                              <span style={{ color: '#185FA5' }}>÷ 这批</span>
                              <input type="number" step="0.1" style={{ width: 58, padding: '1px 3px', border: '1px solid #185FA5', borderRadius: 4, fontSize: 12, textAlign: 'center' }}
                                value={editDyeQty} onChange={(e) => setEditDyeQty(e.target.value)} placeholder="米数" />
                              <span style={{ color: '#185FA5' }}>米</span>
                              {Number(editDyeTotal) > 0 && Number(editDyeQty) > 0 && <span style={{ color: '#1D9E75' }}>= ¥{(Number(editDyeTotal) / Number(editDyeQty)).toFixed(2)}/米</span>}
                              <button onClick={() => saveColorDye(c.id)} style={{ fontSize: 11, marginLeft: 2, color: '#185FA5' }}>✓</button>
                              <button onClick={() => setEditingDyeId('')} style={{ fontSize: 11, marginLeft: 2, color: '#888' }}>✕</button>
                            </span>
                          ) : (
                            <button onClick={() => { setEditingDyeId(c.id); setEditDyeTotal(''); setEditDyeQty(''); }}
                              style={{ fontSize: 11, color: '#A36B00', marginLeft: 6, textDecoration: 'underline dotted' }}>
                              改染费{c.dyePerUnit != null && c.dyePerUnit > 0 ? `（现¥${c.dyePerUnit.toFixed(2)}/米）` : ''}
                            </button>
                          )
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {canOperate && (
                          <>
                            <button onClick={() => openOp(f.id, c.id, 'stockIn')} style={{ fontSize: 10, padding: '2px 6px', background: '#E1F5EE', color: '#085041', borderRadius: 4 }}>入仓</button>
                            <button onClick={() => openOp(f.id, c.id, 'stockOut')} style={{ fontSize: 10, padding: '2px 6px', background: '#FCEBEB', color: '#501313', borderRadius: 4 }}>领取</button>
                            <button onClick={() => openOp(f.id, c.id, 'stockReturn')} style={{ fontSize: 10, padding: '2px 6px', background: '#FAEEDA', color: '#633806', borderRadius: 4 }}>退回</button>
                          </>
                        )}
                        {canEdit && <button onClick={() => deleteColor(c.id)} style={{ fontSize: 10, color: '#A32D2D', marginLeft: 4 }}>删</button>}
                      </div>
                    </div>
                  </div>
                ))}

                {/* 添加颜色 */}
                {canEdit && addColorFabricId === f.id && (
                  <div style={{ padding: '10px 16px', background: '#f8f9fa' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input className="form-input" style={{ marginBottom: 0, flex: 2 }} placeholder="颜色名称" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} />
                      {showPrice && <input className="form-input" type="number" style={{ marginBottom: 0, flex: 1 }} placeholder="单价" value={newColorPrice} onChange={(e) => setNewColorPrice(e.target.value)} />}
                      <button onClick={addColor} style={{ fontSize: 12, padding: '6px 10px', background: '#1D9E75', color: '#fff', borderRadius: 6 }}>添加</button>
                      <button onClick={() => setAddColorFabricId('')} style={{ fontSize: 12, color: '#888' }}>取消</button>
                    </div>
                  </div>
                )}

                {/* 底部操作栏 */}
                <div style={{ padding: '8px 16px', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {canEdit && <button onClick={() => { setAddColorFabricId(f.id); setNewColorName(''); setNewColorPrice(''); }} style={{ fontSize: 12, color: '#185FA5' }}>+ 添加颜色</button>}
                    <button onClick={() => toggleFlow(f.id)} style={{ fontSize: 12, color: '#666' }}>{showFlowId === f.id ? '收起流水' : '查看流水'}</button>
                  </div>
                  {canEdit && <button onClick={() => deleteFabric(f.id)} style={{ fontSize: 12, color: '#A32D2D' }}>删除布料</button>}
                </div>

                {/* 流水记录 */}
                {showFlowId === f.id && (
                  <div style={{ padding: '8px 16px', background: '#fafafa', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>操作流水</p>
                    {flowLoading && <p style={{ fontSize: 12, color: '#999' }}>加载中...</p>}
                    {!flowLoading && flowRecords.length === 0 && <p style={{ fontSize: 12, color: '#999' }}>暂无记录</p>}
                    {!flowLoading && flowRecords.map((r: any) => {
                      const typeLabels: Record<string, { text: string; color: string }> = { IN: { text: '入仓', color: '#1D9E75' }, CUT: { text: '领取', color: '#A32D2D' }, RETURN: { text: '退回', color: '#0C447C' }, DEFECT: { text: '次品', color: '#BA7517' } };
                      const t = typeLabels[r.type] || { text: r.type, color: '#666' };
                      const isAdd = ['IN', 'RETURN'].includes(r.type);
                      const d = new Date(r.createdAt);
                      const time = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                      return (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '0.5px solid rgba(0,0,0,0.04)', fontSize: 12 }}>
                          <div>
                            <span style={{ color: t.color, fontWeight: 500 }}>{t.text}</span>
                            {r.colorName && <span style={{ color: '#666', marginLeft: 4 }}>[{r.colorName}]</span>}
                            <span style={{ color: '#888', marginLeft: 6 }}>{r.userName}</span>
                            {r.note && <span style={{ color: '#aaa', marginLeft: 4 }}>· {r.note}</span>}
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div>
                              <span style={{ fontWeight: 600, color: isAdd ? '#1D9E75' : '#A32D2D' }}>{isAdd ? '+' : '-'}{r.displayQty} {r.displayUnit}</span>
                              <span style={{ color: '#aaa', marginLeft: 6 }}>{time}</span>
                            </div>
                            {(canDeleteMove && flowCanDelete) && <button onClick={() => deleteFlow(r.id)} style={{ fontSize: 10, color: '#A32D2D' }}>删</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
