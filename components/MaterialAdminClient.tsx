'use client';

import { useEffect, useState } from 'react';

interface Category { id: string; name: string; icon: string | null; count: number; }
interface InTransitPO { id: string; quantity: number; remaining: number; purchaseDate: string; expectedDate: string | null; note: string | null }
interface MaterialVariant {
  id: string; variantName: string;
  stock: number; stockDefect: number; stockWaste: number;
  minStock: number; stockStatus?: string;
  unitPrice: number | null; note: string | null;
  inTransit?: InTransitPO[];
}

interface Material {
  id: string; code: string; name: string; category: string; categoryId: string;
  spec: string | null; color: string | null; unit: string; unitPrice: number;
  stock: number; stockDefect: number; stockWaste: number; minStock: number;
  location: string | null; supplier: string | null;
  usage: string | null; note: string | null;
  stockStatus: string; variants: MaterialVariant[];
  inTransit?: InTransitPO[];
}

type View = 'list' | 'addCategory' | 'editCategory' | 'addMaterial' | 'editMaterial' | 'detail';

export function MaterialAdminClient() {
  const [view, setView] = useState<View>('list');
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [selectedMat, setSelectedMat] = useState<Material | null>(null);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Variant management
  const [addVariantId, setAddVariantId] = useState('');
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantMin, setNewVariantMin] = useState('');
  // Variant stock operation
  const [variantOpId, setVariantOpId] = useState('');
  const [variantOpType, setVariantOpType] = useState(''); // variantStockIn/variantStockOut
  const [variantOpQty, setVariantOpQty] = useState('');
  const [editVariantId, setEditVariantId] = useState('');
  const [editVariantName, setEditVariantName] = useState('');
  const [editVariantPrice, setEditVariantPrice] = useState('');
  const [editVariantMin, setEditVariantMin] = useState('');
  // 已采购（在途）录入
  const [purchaseTarget, setPurchaseTarget] = useState<{ materialId: string; variantName?: string; unit: string } | null>(null);
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchaseExpected, setPurchaseExpected] = useState('');
  const [purchaseNote, setPurchaseNote] = useState('');
  // 主记录(无颜色)入仓
  const [matOpId, setMatOpId] = useState('');
  const [matOpQty, setMatOpQty] = useState('');
  // 直接修改库存数量
  const [editStockVId, setEditStockVId] = useState('');
  const [editStockField, setEditStockField] = useState(''); // stock/stockDefect/stockWaste
  const [editStockValue, setEditStockValue] = useState('');
  // 流水记录
  const [showFlowId, setShowFlowId] = useState('');
  const [flowRecords, setFlowRecords] = useState<any[]>([]);
  const [flowLoading, setFlowLoading] = useState(false);

  // Form state for category
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('');

  // Form state for material
  const [mForm, setMForm] = useState({
    code: '', name: '', categoryId: '', spec: '', color: '', unit: '个',
    unitPrice: '', stock: '', stockDefect: '', stockWaste: '', minStock: '', location: '', supplier: '',
    usage: '', note: '',
  });

  useEffect(() => { loadCategories(); loadMaterials(); }, []);

  async function loadCategories() {
    const res = await fetch('/api/categories');
    const data = await res.json();
    setCategories(data.categories || []);
  }

  async function loadMaterials(catId?: string, q?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (catId) params.set('categoryId', catId);
    if (q) params.set('q', q);
    const res = await fetch('/api/materials?' + params.toString());
    const data = await res.json();
    setMaterials(data.materials || []);
    setLoading(false);
  }

  function flash(message: string) { setMsg(message); setTimeout(() => setMsg(''), 3000); }

  async function submitPurchase() {
    if (!purchaseTarget) return;
    if (!purchaseQty || Number(purchaseQty) <= 0) { setErr('请填写采购数量'); return; }
    const res = await fetch('/api/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        materialId: purchaseTarget.materialId,
        variantName: purchaseTarget.variantName || null,
        quantity: Number(purchaseQty),
        purchaseDate, expectedDate: purchaseExpected || null,
        note: purchaseNote.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setPurchaseTarget(null); setPurchaseQty(''); setPurchaseExpected(''); setPurchaseNote('');
    loadMaterials(selectedCat?.id); flash(data.message);
  }

  async function cancelPurchase(poId: string) {
    if (!confirm('确定取消这条采购记录？')) return;
    const res = await fetch('/api/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', id: poId }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    loadMaterials(selectedCat?.id); flash(data.message);
  }
  function fmtPoDate(iso: string) { const d = new Date(iso); return `${d.getMonth() + 1}月${d.getDate()}日`; }

  async function submitMatStockIn(materialId: string) {
    if (!matOpQty || Number(matOpQty) <= 0) { setErr('请输入数量'); return; }
    const res = await fetch('/api/materials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'materialStockIn', materialId, quantity: Number(matOpQty), stockType: 'good' }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setMatOpId(''); setMatOpQty('');
    loadMaterials(selectedCat?.id); flash(data.message);
  }


  async function toggleFlow(materialId: string) {
    if (showFlowId === materialId) { setShowFlowId(''); return; }
    setShowFlowId(materialId); setFlowLoading(true);
    const res = await fetch('/api/issues/list?materialId=' + materialId + '&limit=20');
    const data = await res.json();
    setFlowRecords(data.issues || []);
    setFlowLoading(false);
  }

  function toggleExpand(id: string) { const n = new Set(expanded); if (n.has(id)) n.delete(id); else n.add(id); setExpanded(n); }

  async function addVariant() {
    if (!newVariantName) { setErr('名称必填'); return; }
    const res = await fetch('/api/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addVariant', materialId: addVariantId, variantName: newVariantName, unitPrice: Number(newVariantPrice) || null, minStock: Number(newVariantMin) || 0 }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setAddVariantId(''); setNewVariantName(''); setNewVariantPrice(''); setNewVariantMin('');
    loadMaterials(selectedCat?.id); flash(data.message);
  }

  async function deleteVariant(variantId: string) {
    if (!confirm('确定删除？')) return;
    await fetch('/api/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteVariant', variantId }) });
    loadMaterials(selectedCat?.id); flash('已删除');
  }

  async function submitVariantOp() {
    if (!variantOpQty || Number(variantOpQty) <= 0) { setErr('请输入数量'); return; }
    const res = await fetch('/api/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: variantOpType, variantId: variantOpId, quantity: Number(variantOpQty), stockType: 'good' }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setVariantOpId(''); setVariantOpType(''); setVariantOpQty('');
    loadMaterials(selectedCat?.id); flash(data.message);
  }

  async function saveVariantEdit() {
    if (!editVariantName.trim()) { setErr('名称不能为空'); return; }
    const res = await fetch('/api/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateVariant', variantId: editVariantId, variantName: editVariantName.trim(), unitPrice: Number(editVariantPrice) || 0, minStock: Number(editVariantMin) || 0 }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setEditVariantId('');
    loadMaterials(selectedCat?.id); flash(data.message);
  }

  async function saveStockValue() {
    const res = await fetch('/api/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setVariantStock', variantId: editStockVId, field: editStockField, value: Number(editStockValue) || 0 }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setEditStockVId(''); setEditStockField('');
    loadMaterials(selectedCat?.id); flash(data.message);
  }

  // === Category Management ===
  async function addCategory() {
    if (!catName.trim()) { setErr('请输入分类名称'); return; }
    setErr('');
    const res = await fetch('/api/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: catName, icon: catIcon }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setCatName(''); setCatIcon('');
    loadCategories(); loadMaterials();
    flash('分类添加成功');
  }

  async function updateCategory() {
    if (!selectedCat || !catName.trim()) { setErr('请输入分类名称'); return; }
    setErr('');
    const res = await fetch('/api/categories', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedCat.id, name: catName, icon: catIcon }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setView('list'); setSelectedCat(null);
    loadCategories(); loadMaterials();
    flash('分类已更新');
  }

  async function deleteCategory(cat: Category) {
    if (!confirm(`确定删除分类"${cat.name}"？`)) return;
    const res = await fetch('/api/categories', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cat.id }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); setTimeout(() => setErr(''), 3000); return; }
    loadCategories(); loadMaterials();
    flash('分类已删除');
  }

  // === Material Management ===
  function openAddMaterial() {
    setMForm({ code: '', name: '', categoryId: categories[0]?.id || '', spec: '', color: '', unit: '个', unitPrice: '', stock: '', stockDefect: '0', stockWaste: '0', minStock: '', location: '', supplier: '', usage: '', note: '' });
    setErr('');
    setView('addMaterial');
  }

  function openEditMaterial(m: Material) {
    setSelectedMat(m);
    setMForm({
      code: m.code, name: m.name, categoryId: m.categoryId,
      spec: m.spec || '', color: m.color || '', unit: m.unit,
      unitPrice: String(m.unitPrice), stock: String(m.stock),
      stockDefect: String(m.stockDefect), stockWaste: String(m.stockWaste),
      minStock: String(m.minStock), location: m.location || '', supplier: m.supplier || '',
      usage: m.usage || '', note: m.note || '',
    });
    setErr('');
    setView('editMaterial');
  }

  async function saveMaterial(isNew: boolean) {
    if (!mForm.code.trim() || !mForm.name.trim() || !mForm.categoryId) {
      setErr('编码、名称、分类必填'); return;
    }
    setErr('');
    const body: any = { ...mForm, unitPrice: Number(mForm.unitPrice) || 0, stock: Number(mForm.stock) || 0, stockDefect: Number(mForm.stockDefect) || 0, stockWaste: Number(mForm.stockWaste) || 0, minStock: Number(mForm.minStock) || 0 };
    if (!isNew) body.id = selectedMat!.id;

    const res = await fetch('/api/materials', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setView('list');
    loadCategories(); loadMaterials();
    flash(isNew ? '辅料添加成功' : '辅料已更新');
  }

  async function deleteMaterial(m: Material) {
    if (!confirm(`确定删除"${m.name}"？`)) return;
    const res = await fetch('/api/materials', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id }),
    });
    if (!res.ok) { const data = await res.json(); setErr(data.error); return; }
    loadCategories(); loadMaterials();
    flash('辅料已删除');
  }

  // === Render: Material Form ===
  function renderMaterialForm(isNew: boolean) {
    return (
      <div className="page">
        <button onClick={() => setView('list')} style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>← 返回</button>
        <h2>{isNew ? '新增辅料' : '编辑辅料'}</h2>

        {err && <div className="alert error">{err}</div>}

        <label className="form-label">编码 *</label>
        <input className="form-input" value={mForm.code} onChange={(e) => setMForm({ ...mForm, code: e.target.value })} placeholder="如 BTN-R-4" readOnly={!isNew} style={!isNew ? { background: '#f0f0f0' } : {}} />

        <label className="form-label">名称 *</label>
        <input className="form-input" value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} placeholder="如 红色纽扣 4号" />

        <label className="form-label">分类 *</label>
        <select className="form-select" value={mForm.categoryId} onChange={(e) => setMForm({ ...mForm, categoryId: e.target.value })}>
          <option value="">请选择分类</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="form-label">规格</label>
            <input className="form-input" value={mForm.spec} onChange={(e) => setMForm({ ...mForm, spec: e.target.value })} placeholder="如 直径10mm" />
          </div>
          <div>
            <label className="form-label">颜色</label>
            <input className="form-input" value={mForm.color} onChange={(e) => setMForm({ ...mForm, color: e.target.value })} placeholder="如 红色" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="form-label">单位</label>
            <input className="form-input" value={mForm.unit} onChange={(e) => setMForm({ ...mForm, unit: e.target.value })} placeholder="个/米/卷" />
          </div>
          <div>
            <label className="form-label">单价（元）</label>
            <input className="form-input" type="number" step="0.01" value={mForm.unitPrice} onChange={(e) => setMForm({ ...mForm, unitPrice: e.target.value })} />
          </div>
        </div>

        <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>库存数量</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label" style={{ color: '#1D9E75' }}>良品</label>
              <input className="form-input" type="number" step="0.01" value={mForm.stock} onChange={(e) => setMForm({ ...mForm, stock: e.target.value })} style={{ borderColor: '#1D9E75' }} />
            </div>
            <div>
              <label className="form-label" style={{ color: '#BA7517' }}>次品</label>
              <input className="form-input" type="number" step="0.01" value={mForm.stockDefect} onChange={(e) => setMForm({ ...mForm, stockDefect: e.target.value })} style={{ borderColor: '#BA7517' }} />
            </div>
            <div>
              <label className="form-label" style={{ color: '#A32D2D' }}>废品</label>
              <input className="form-input" type="number" step="0.01" value={mForm.stockWaste} onChange={(e) => setMForm({ ...mForm, stockWaste: e.target.value })} style={{ borderColor: '#A32D2D' }} />
            </div>
          </div>
        </div>

        <label className="form-label">安全库存（低于此数预警）</label>
        <input className="form-input" type="number" step="1" value={mForm.minStock} onChange={(e) => setMForm({ ...mForm, minStock: e.target.value })} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="form-label">存放位置</label>
            <input className="form-input" value={mForm.location} onChange={(e) => setMForm({ ...mForm, location: e.target.value })} placeholder="如 A1-01" />
          </div>
          <div>
            <label className="form-label">供应商</label>
            <input className="form-input" value={mForm.supplier} onChange={(e) => setMForm({ ...mForm, supplier: e.target.value })} />
          </div>
        </div>

        <label className="form-label">用量说明（如"每件2个"、"每米用0.5个"）</label>
        <input className="form-input" value={mForm.usage} onChange={(e) => setMForm({ ...mForm, usage: e.target.value })} placeholder="如 每件2个" />

        <label className="form-label">备注</label>
        <input className="form-input" value={mForm.note} onChange={(e) => setMForm({ ...mForm, note: e.target.value })} placeholder="其他说明" />

        <button className="submit-btn" onClick={() => saveMaterial(isNew)}>
          {isNew ? '确认添加' : '保存修改'}
        </button>
      </div>
    );
  }

  // === Render: Category Manager (inline panel) ===
  function renderCategoryManager() {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>分类管理</h3>
          <button onClick={() => setShowCatMgr(false)} style={{ fontSize: 13, color: '#888' }}>收起 ▲</button>
        </div>

        {err && <div className="alert error">{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="form-input" style={{ flex: 1, marginBottom: 0 }} placeholder="新分类名称" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <button className="submit-btn" style={{ width: 'auto', padding: '10px 18px', fontSize: 14 }} onClick={addCategory}>添加</button>
        </div>

        {categories.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize: 15 }}>{c.name} <span style={{ fontSize: 12, color: '#888' }}>({c.count} 种)</span></span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setSelectedCat(c); setCatName(c.name); setCatIcon(c.icon || ''); setView('editCategory'); }} style={{ fontSize: 13, color: '#185FA5' }}>编辑</button>
              <button onClick={() => deleteCategory(c)} style={{ fontSize: 13, color: '#A32D2D' }}>删除</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // === Render: Edit Category View ===
  if (view === 'editCategory' && selectedCat) {
    return (
      <div className="page">
        <button onClick={() => { setView('list'); setErr(''); }} style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>← 返回</button>
        <h2>编辑分类</h2>
        {err && <div className="alert error">{err}</div>}
        <label className="form-label">分类名称</label>
        <input className="form-input" value={catName} onChange={(e) => setCatName(e.target.value)} />
        <button className="submit-btn" onClick={updateCategory}>保存修改</button>
      </div>
    );
  }

  // === Render: Material Form Views ===
  if (view === 'addMaterial') return renderMaterialForm(true);
  if (view === 'editMaterial') return renderMaterialForm(false);

  // === Render: Main List ===
  const totalValue = materials.reduce((sum, m) => sum + m.stock * m.unitPrice, 0);
  const totalDefect = materials.reduce((sum, m) => sum + m.stockDefect, 0);
  const totalWaste = materials.reduce((sum, m) => sum + m.stockWaste, 0);

  return (
    <div className="page">
      {msg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setMsg('')}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '30px 40px', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', maxWidth: 300 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1D9E75' }}>{msg}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>点击任意位置关闭</div>
          </div>
        </div>
      )}
      {err && <div className="alert error">{err}</div>}

      {/* Stats */}
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <p style={{ fontSize: 11, color: '#888' }}>良品总值</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#1D9E75' }}>¥{totalValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#888' }}>次品总数</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#BA7517' }}>{totalDefect}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#888' }}>废品总数</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#A32D2D' }}>{totalWaste}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="submit-btn" style={{ flex: 1, fontSize: 14, padding: 12 }} onClick={openAddMaterial}>+ 新增辅料</button>
        <button className="submit-btn blue" style={{ flex: 1, fontSize: 14, padding: 12 }} onClick={() => setShowCatMgr(!showCatMgr)}>
          {showCatMgr ? '收起分类' : '管理分类'}
        </button>
      </div>

      {showCatMgr && renderCategoryManager()}

      {/* Filter by category */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
        <button onClick={() => { setSelectedCat(null); loadMaterials(); }} className="badge" style={{ padding: '6px 12px', fontSize: 13, whiteSpace: 'nowrap', background: !selectedCat ? '#1D9E75' : '#f0f0f0', color: !selectedCat ? '#fff' : '#666' }}>
          全部
        </button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => { setSelectedCat(c); loadMaterials(c.id); }} className="badge" style={{ padding: '6px 12px', fontSize: 13, whiteSpace: 'nowrap', background: selectedCat?.id === c.id ? '#1D9E75' : '#f0f0f0', color: selectedCat?.id === c.id ? '#fff' : '#666' }}>
            {c.name} ({c.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <input type="text" className="search-bar" placeholder="搜索辅料名称/编码/颜色..." value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && loadMaterials(selectedCat?.id, keyword)}
        onBlur={() => keyword && loadMaterials(selectedCat?.id, keyword)}
      />

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
      {!loading && materials.length === 0 && <div className="empty-state">没有辅料，点击上方"新增辅料"添加</div>}

      {!loading && materials.map((m) => {
        let cls = 'material-item';
        let tag = '充足';
        if (m.stockStatus === 'out') { cls += ' danger'; tag = '缺货'; }
        else if (m.stockStatus === 'danger') { cls += ' danger'; tag = '紧张'; }
        else if (m.stockStatus === 'warn') { cls += ' warn'; tag = '偏低'; }

        return (
          <div key={m.id} className={cls} style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0, overflow: 'hidden' }}>
            <div onClick={() => toggleExpand(m.id)} style={{ padding: '12px 16px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="name">{m.name}</div>
                  <div className="meta">[{m.category}] {m.code}{m.color ? ` · ${m.color}` : ''}{m.spec ? ` · ${m.spec}` : ''}{m.location ? ` · ${m.location}` : ''}{m.variants.length > 0 ? ` · ${m.variants.length}色` : ''}</div>
                {m.usage && <div style={{ fontSize: 12, color: '#854F0B', marginTop: 2 }}>用量：{m.usage}</div>}
                {m.note && <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>备注：{m.note}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${m.stockStatus === 'ok' ? 'green' : m.stockStatus === 'warn' ? 'amber' : 'red'}`}>{tag}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 13 }}>
                <span style={{ color: '#1D9E75' }}>良品 <strong>{m.stock}</strong></span>
                {m.stockDefect > 0 && <span style={{ color: '#BA7517' }}>次品 <strong>{m.stockDefect}</strong></span>}
                {m.stockWaste > 0 && <span style={{ color: '#A32D2D' }}>废品 <strong>{m.stockWaste}</strong></span>}
                <span style={{ color: '#888' }}>{m.unit} · ¥{m.unitPrice}</span>
              </div>
              {/* 已采购在途（主记录） */}
              {m.inTransit && m.inTransit.length > 0 && (
                <div onClick={(ev) => ev.stopPropagation()} style={{ marginTop: 6, padding: '6px 8px', background: '#FAEEDA', borderRadius: 6, fontSize: 12 }}>
                  {m.inTransit.map((po) => (
                    <div key={po.id} style={{ color: '#854F0B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span>🚚 已采购 <strong>{po.remaining}</strong> {m.unit} · {fmtPoDate(po.purchaseDate)}下单{po.expectedDate ? ` · 预计 ${fmtPoDate(po.expectedDate)} 到货` : ''}{po.note ? ` · ${po.note}` : ''}</span>
                      <button onClick={() => cancelPurchase(po.id)} style={{ fontSize: 11, color: '#A32D2D' }}>取消</button>
                    </div>
                  ))}
                </div>
              )}
              {/* 主记录的 + 入仓 / + 已采购（无颜色子项时） */}
              {m.variants.length === 0 && (
                <div onClick={(ev) => ev.stopPropagation()} style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {matOpId === m.id && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: '#E1F5EE', padding: 6, borderRadius: 6 }}>
                      <span style={{ fontSize: 12, color: '#085041' }}>入仓:</span>
                      <input type="number" step="0.1" className="form-input" placeholder="数量" style={{ marginBottom: 0, width: 80 }} value={matOpQty} onChange={(e) => setMatOpQty(e.target.value)} autoFocus />
                      <button onClick={() => submitMatStockIn(m.id)} style={{ fontSize: 12, padding: '4px 12px', background: '#1D9E75', color: '#fff', borderRadius: 6 }}>确认入仓</button>
                      <button onClick={() => { setMatOpId(''); setMatOpQty(''); }} style={{ fontSize: 12, color: '#888' }}>取消</button>
                    </div>
                  )}
                  {purchaseTarget?.materialId === m.id && !purchaseTarget.variantName && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: '#FFF8EC', padding: 6, borderRadius: 6 }}>
                      <input type="number" step="0.1" className="form-input" placeholder="采购数量" style={{ marginBottom: 0, width: 90 }} value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} autoFocus />
                      <input type="date" className="form-input" style={{ marginBottom: 0, width: 130 }} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                      <input type="date" className="form-input" placeholder="预计到货" style={{ marginBottom: 0, width: 130 }} value={purchaseExpected} onChange={(e) => setPurchaseExpected(e.target.value)} />
                      <input className="form-input" placeholder="备注（选填）" style={{ marginBottom: 0, flex: 1, minWidth: 100 }} value={purchaseNote} onChange={(e) => setPurchaseNote(e.target.value)} />
                      <button onClick={submitPurchase} style={{ fontSize: 12, padding: '4px 12px', background: '#1D9E75', color: '#fff', borderRadius: 6 }}>确认</button>
                      <button onClick={() => setPurchaseTarget(null)} style={{ fontSize: 12, color: '#888' }}>取消</button>
                    </div>
                  )}
                  {matOpId !== m.id && !(purchaseTarget?.materialId === m.id && !purchaseTarget.variantName) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => { setMatOpId(m.id); setMatOpQty(''); setPurchaseTarget(null); }}
                        style={{ fontSize: 11, padding: '3px 10px', background: '#E1F5EE', color: '#085041', borderRadius: 4 }}>+ 入仓</button>
                      <button onClick={() => { setPurchaseTarget({ materialId: m.id, unit: m.unit }); setPurchaseQty(''); setPurchaseDate(new Date().toISOString().slice(0,10)); setPurchaseExpected(''); setPurchaseNote(''); setMatOpId(''); }}
                        style={{ fontSize: 11, padding: '3px 10px', background: '#FAEEDA', color: '#854F0B', borderRadius: 4 }}>+ 已采购</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {expanded.has(m.id) && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                {/* 颜色子项 */}
                {m.variants.map((v) => (
                  <div key={v.id} style={{ padding: '8px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                    {editVariantId === v.id ? (
                      /* 编辑模式 */
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input className="form-input" style={{ marginBottom: 0, flex: 2, minWidth: 80 }} value={editVariantName} onChange={(e) => setEditVariantName(e.target.value)} placeholder="名称" />
                        <input className="form-input" type="number" style={{ marginBottom: 0, flex: 1, minWidth: 60 }} value={editVariantPrice} onChange={(e) => setEditVariantPrice(e.target.value)} placeholder="单价" />
                        <input className="form-input" type="number" style={{ marginBottom: 0, flex: 1, minWidth: 70 }} value={editVariantMin} onChange={(e) => setEditVariantMin(e.target.value)} placeholder="安全库存" />
                        <button onClick={saveVariantEdit} style={{ fontSize: 11, padding: '4px 10px', background: '#1D9E75', color: '#fff', borderRadius: 6, whiteSpace: 'nowrap' }}>保存</button>
                        <button onClick={() => setEditVariantId('')} style={{ fontSize: 11, color: '#888' }}>取消</button>
                      </div>
                    ) : (
                      /* 显示模式 */
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{v.variantName}</span>
                            {editStockVId === v.id && editStockField === 'stock' ? (
                              <span style={{ marginLeft: 8, fontSize: 12 }}><span style={{ color: '#1D9E75' }}>良品 </span><input type="number" step="0.1" autoFocus style={{ width: 55, padding: '1px 3px', border: '1px solid #1D9E75', borderRadius: 4, fontSize: 12, textAlign: 'center' }} value={editStockValue} onChange={(e) => setEditStockValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveStockValue(); if (e.key === 'Escape') setEditStockVId(''); }} /><button onClick={saveStockValue} style={{ fontSize: 10, marginLeft: 2, color: '#1D9E75' }}>✓</button></span>
                            ) : (
                              <span onClick={(e) => { e.stopPropagation(); setEditStockVId(v.id); setEditStockField('stock'); setEditStockValue(String(v.stock)); }} style={{ fontSize: 12, color: '#1D9E75', marginLeft: 8, cursor: 'pointer', borderBottom: '1px dashed #1D9E75' }}>良品 {v.stock}</span>
                            )}
                            {v.stockDefect > 0 && (editStockVId === v.id && editStockField === 'stockDefect' ? (
                              <span style={{ marginLeft: 4, fontSize: 12 }}><span style={{ color: '#BA7517' }}>次品 </span><input type="number" step="0.1" autoFocus style={{ width: 55, padding: '1px 3px', border: '1px solid #BA7517', borderRadius: 4, fontSize: 12, textAlign: 'center' }} value={editStockValue} onChange={(e) => setEditStockValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveStockValue(); if (e.key === 'Escape') setEditStockVId(''); }} /><button onClick={saveStockValue} style={{ fontSize: 10, marginLeft: 2, color: '#BA7517' }}>✓</button></span>
                            ) : (
                              <span onClick={(e) => { e.stopPropagation(); setEditStockVId(v.id); setEditStockField('stockDefect'); setEditStockValue(String(v.stockDefect)); }} style={{ fontSize: 12, color: '#BA7517', marginLeft: 4, cursor: 'pointer', borderBottom: '1px dashed #BA7517' }}>次品 {v.stockDefect}</span>
                            ))}
                            {v.stockWaste > 0 && (editStockVId === v.id && editStockField === 'stockWaste' ? (
                              <span style={{ marginLeft: 4, fontSize: 12 }}><span style={{ color: '#A32D2D' }}>废品 </span><input type="number" step="0.1" autoFocus style={{ width: 55, padding: '1px 3px', border: '1px solid #A32D2D', borderRadius: 4, fontSize: 12, textAlign: 'center' }} value={editStockValue} onChange={(e) => setEditStockValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveStockValue(); if (e.key === 'Escape') setEditStockVId(''); }} /><button onClick={saveStockValue} style={{ fontSize: 10, marginLeft: 2, color: '#A32D2D' }}>✓</button></span>
                            ) : (
                              <span onClick={(e) => { e.stopPropagation(); setEditStockVId(v.id); setEditStockField('stockWaste'); setEditStockValue(String(v.stockWaste)); }} style={{ fontSize: 12, color: '#A32D2D', marginLeft: 4, cursor: 'pointer', borderBottom: '1px dashed #A32D2D' }}>废品 {v.stockWaste}</span>
                            ))}
                            {v.unitPrice != null && <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>¥{v.unitPrice}</span>}
                            {v.minStock > 0 && <span style={{ fontSize: 11, color: v.stockStatus === 'danger' ? '#A32D2D' : v.stockStatus === 'warn' ? '#BA7517' : '#888', marginLeft: 6 }}>安 {v.minStock}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button onClick={(e) => { e.stopPropagation(); setVariantOpId(v.id); setVariantOpType('variantStockIn'); setVariantOpQty(''); }} style={{ fontSize: 10, padding: '2px 6px', background: '#E1F5EE', color: '#085041', borderRadius: 4 }}>入仓</button>
                            <button onClick={(e) => { e.stopPropagation(); setVariantOpId(v.id); setVariantOpType('variantStockOut'); setVariantOpQty(''); }} style={{ fontSize: 10, padding: '2px 6px', background: '#FCEBEB', color: '#501313', borderRadius: 4 }}>领取</button>
                            <button onClick={(e) => { e.stopPropagation(); setEditVariantId(v.id); setEditVariantName(v.variantName); setEditVariantPrice(String(v.unitPrice || '')); setEditVariantMin(String(v.minStock || '')); }} style={{ fontSize: 10, padding: '2px 6px', background: '#E6F1FB', color: '#0C447C', borderRadius: 4 }}>改</button>
                            <button onClick={(e) => { e.stopPropagation(); deleteVariant(v.id); }} style={{ fontSize: 10, color: '#A32D2D' }}>删</button>
                          </div>
                        </div>
                        {/* 库存操作表单 */}
                        {variantOpId === v.id && (
                          <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{variantOpType === 'variantStockIn' ? '入仓' : '领取'}:</span>
                            <input type="number" step="0.1" className="form-input" style={{ marginBottom: 0, width: 80, textAlign: 'center' }} value={variantOpQty} onChange={(e) => setVariantOpQty(e.target.value)} placeholder="0" />
                            <button onClick={submitVariantOp} style={{ fontSize: 11, padding: '4px 10px', background: '#1D9E75', color: '#fff', borderRadius: 6, whiteSpace: 'nowrap' }}>确认</button>
                            <button onClick={() => { setVariantOpId(''); setVariantOpType(''); }} style={{ fontSize: 11, color: '#888' }}>取消</button>
                          </div>
                        )}
                      </>
                    )}
                    {/* 变体已采购显示 + 录入 */}
                    {v.inTransit && v.inTransit.length > 0 && (
                      <div style={{ marginTop: 6, padding: '4px 6px', background: '#FAEEDA', borderRadius: 4, fontSize: 11 }}>
                        {v.inTransit.map((po) => (
                          <div key={po.id} style={{ color: '#854F0B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                            <span>🚚 已采购 <strong>{po.remaining}</strong> {m.unit} · {fmtPoDate(po.purchaseDate)}下单{po.expectedDate ? ` · 预计 ${fmtPoDate(po.expectedDate)} 到货` : ''}{po.note ? ` · ${po.note}` : ''}</span>
                            <button onClick={() => cancelPurchase(po.id)} style={{ fontSize: 10, color: '#A32D2D' }}>取消</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 4 }}>
                      {purchaseTarget?.materialId === m.id && purchaseTarget.variantName === v.variantName ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', background: '#FFF8EC', padding: 4, borderRadius: 4 }}>
                          <input type="number" step="0.1" className="form-input" placeholder="数量" style={{ marginBottom: 0, width: 70, fontSize: 12 }} value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} autoFocus />
                          <input type="date" className="form-input" style={{ marginBottom: 0, width: 120, fontSize: 12 }} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                          <input type="date" className="form-input" placeholder="预计到货" style={{ marginBottom: 0, width: 120, fontSize: 12 }} value={purchaseExpected} onChange={(e) => setPurchaseExpected(e.target.value)} />
                          <input className="form-input" placeholder="备注" style={{ marginBottom: 0, flex: 1, minWidth: 80, fontSize: 12 }} value={purchaseNote} onChange={(e) => setPurchaseNote(e.target.value)} />
                          <button onClick={submitPurchase} style={{ fontSize: 11, padding: '3px 10px', background: '#1D9E75', color: '#fff', borderRadius: 4 }}>确认</button>
                          <button onClick={() => setPurchaseTarget(null)} style={{ fontSize: 11, color: '#888' }}>取消</button>
                        </div>
                      ) : (
                        <button onClick={() => { setPurchaseTarget({ materialId: m.id, variantName: v.variantName, unit: m.unit }); setPurchaseQty(''); setPurchaseDate(new Date().toISOString().slice(0,10)); setPurchaseExpected(''); setPurchaseNote(''); }}
                          style={{ fontSize: 10, padding: '2px 6px', background: '#FAEEDA', color: '#854F0B', borderRadius: 4 }}>+ 已采购</button>
                      )}
                    </div>
                  </div>
                ))}

                {/* 添加颜色 */}
                {addVariantId === m.id ? (
                  <div style={{ padding: '10px 16px', background: '#f8f9fa' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input className="form-input" style={{ marginBottom: 0, flex: 2 }} placeholder="颜色/名称" value={newVariantName} onChange={(e) => setNewVariantName(e.target.value)} />
                      <input className="form-input" type="number" style={{ marginBottom: 0, flex: 1 }} placeholder="单价" value={newVariantPrice} onChange={(e) => setNewVariantPrice(e.target.value)} />
                      <input className="form-input" type="number" style={{ marginBottom: 0, flex: 1 }} placeholder="安全库存" value={newVariantMin} onChange={(e) => setNewVariantMin(e.target.value)} />
                      <button onClick={addVariant} style={{ fontSize: 12, padding: '6px 10px', background: '#1D9E75', color: '#fff', borderRadius: 6, whiteSpace: 'nowrap' }}>添加</button>
                      <button onClick={() => setAddVariantId('')} style={{ fontSize: 12, color: '#888' }}>取消</button>
                    </div>
                  </div>
                ) : null}

                {/* 底部操作 */}
                <div style={{ padding: '8px 16px', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={(e) => { e.stopPropagation(); setAddVariantId(m.id); setNewVariantName(''); setNewVariantPrice(''); }} style={{ fontSize: 12, color: '#185FA5' }}>+ 添加颜色</button>
                    <button onClick={(e) => { e.stopPropagation(); openEditMaterial(m); }} style={{ fontSize: 12, color: '#185FA5' }}>编辑</button>
                    <button onClick={(e) => { e.stopPropagation(); toggleFlow(m.id); }} style={{ fontSize: 12, color: '#666' }}>{showFlowId === m.id ? '收起流水' : '查看流水'}</button>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteMaterial(m); }} style={{ fontSize: 12, color: '#A32D2D' }}>删除</button>
                </div>

                {/* 流水记录 */}
                {showFlowId === m.id && (
                  <div style={{ padding: '8px 16px', background: '#fafafa', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>操作流水</p>
                    {flowLoading && <p style={{ fontSize: 12, color: '#999' }}>加载中...</p>}
                    {!flowLoading && flowRecords.length === 0 && <p style={{ fontSize: 12, color: '#999' }}>暂无记录</p>}
                    {!flowLoading && flowRecords.map((r: any, i: number) => {
                      const typeLabels: Record<string, { text: string; color: string }> = { IN: { text: '入库', color: '#1D9E75' }, OUT: { text: '领取', color: '#A32D2D' }, RETURN: { text: '退回', color: '#0C447C' }, DEFECT: { text: '报次品', color: '#BA7517' }, WASTE: { text: '报废品', color: '#A32D2D' }, DEFECT_TO_WASTE: { text: '次→废', color: '#A32D2D' }, DEFECT_RETURN_SUPPLIER: { text: '次→退', color: '#0C447C' } };
                      const t = typeLabels[r.type] || { text: r.type, color: '#666' };
                      const isAdd = ['IN', 'RETURN', 'RESHELF'].includes(r.type);
                      const d = new Date(r.createdAt);
                      const time = d.getMonth()+1 + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '0.5px solid rgba(0,0,0,0.04)', fontSize: 12 }}>
                          <div>
                            <span style={{ color: t.color, fontWeight: 500 }}>{t.text}</span>
                            <span style={{ color: '#888', marginLeft: 6 }}>{r.userName}</span>
                            {r.note && <span style={{ color: '#aaa', marginLeft: 4 }}>· {r.note}</span>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 600, color: isAdd ? '#1D9E75' : '#A32D2D' }}>{isAdd ? '+' : '-'}{r.quantity} {r.unit || ''}</span>
                            <span style={{ color: '#aaa', marginLeft: 6 }}>{time}</span>
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
