'use client';

import { useEffect, useState } from 'react';

interface Category { id: string; name: string; icon: string | null; count: number; }
interface Material {
  id: string; code: string; name: string; category: string; categoryId: string;
  spec: string | null; color: string | null; unit: string; unitPrice: number;
  stock: number; stockDefect: number; stockWaste: number; minStock: number;
  location: string | null; supplier: string | null; stockStatus: string;
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

  // Form state for category
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('');

  // Form state for material
  const [mForm, setMForm] = useState({
    code: '', name: '', categoryId: '', spec: '', color: '', unit: '个',
    unitPrice: '', stock: '', stockDefect: '', stockWaste: '', minStock: '', location: '', supplier: '',
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

  function flash(message: string) { setMsg(message); setTimeout(() => setMsg(''), 2000); }

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
    setMForm({ code: '', name: '', categoryId: categories[0]?.id || '', spec: '', color: '', unit: '个', unitPrice: '', stock: '', stockDefect: '0', stockWaste: '0', minStock: '', location: '', supplier: '' });
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
      {msg && <div className="alert success">{msg}</div>}
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
          <div key={m.id} className={cls} style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch' }} onClick={() => openEditMaterial(m)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div className="name">{m.name}</div>
                <div className="meta">[{m.category}] {m.code}{m.location ? ` · ${m.location}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${m.stockStatus === 'ok' ? 'green' : m.stockStatus === 'warn' ? 'amber' : 'red'}`}>{tag}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13 }}>
              <span style={{ color: '#1D9E75' }}>良品 <strong>{m.stock}</strong></span>
              {m.stockDefect > 0 && <span style={{ color: '#BA7517' }}>次品 <strong>{m.stockDefect}</strong></span>}
              {m.stockWaste > 0 && <span style={{ color: '#A32D2D' }}>废品 <strong>{m.stockWaste}</strong></span>}
              <span style={{ color: '#888' }}>{m.unit} · ¥{m.unitPrice}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button onClick={(e) => { e.stopPropagation(); openEditMaterial(m); }} style={{ fontSize: 12, color: '#185FA5', padding: '4px 10px', background: '#E6F1FB', borderRadius: 6 }}>编辑</button>
              <button onClick={(e) => { e.stopPropagation(); deleteMaterial(m); }} style={{ fontSize: 12, color: '#A32D2D', padding: '4px 10px', background: '#FCEBEB', borderRadius: 6 }}>删除</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
