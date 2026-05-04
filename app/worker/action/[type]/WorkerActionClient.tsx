'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Category { id: string; name: string; count: number; }
interface Material {
  id: string; code: string; name: string; category: string; unit: string;
  stock: number; stockDefect: number; stockWaste: number; location?: string; stockStatus: string;
}
interface LookupItem { id: string; label: string; bedNo?: string; bundleNo?: string; }

type Step = 'category' | 'material' | 'quantity';

const TYPE_CONFIG: Record<string, { label: string; color: string; fromField: string; fromLabel: string }> = {
  OUT: { label: '领料', color: 'green', fromField: 'stock', fromLabel: '良品' },
  RETURN: { label: '退料', color: 'blue', fromField: '', fromLabel: '' },
  DEFECT: { label: '报次品', color: 'amber', fromField: 'stock', fromLabel: '良品' },
  WASTE: { label: '报废品', color: 'red', fromField: 'stock', fromLabel: '良品' },
  DEFECT_TO_WASTE: { label: '次品转废品', color: 'red', fromField: 'stockDefect', fromLabel: '次品' },
  DEFECT_RETURN_SUPPLIER: { label: '次品退供应商', color: 'blue', fromField: 'stockDefect', fromLabel: '次品' },
  SPECIAL: { label: '专机领料', color: 'green', fromField: 'stock', fromLabel: '良品' },
  DEFECT_RETURN_SUPPLIER: { label: '次品退供应商', color: 'blue', fromField: 'stockDefect', fromLabel: '次品' },
};

export function WorkerActionClient({ type }: { type: string }) {
  const router = useRouter();
  const config = TYPE_CONFIG[type] || { label: type, color: 'green', fromField: 'stock', fromLabel: '良品' };

  const [step, setStep] = useState<Step>('category');
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Cascading dropdowns
  const [styles, setStyles] = useState<LookupItem[]>([]);
  const [beds, setBeds] = useState<LookupItem[]>([]);
  const [bundles, setBundles] = useState<LookupItem[]>([]);
  const [selStyleId, setSelStyleId] = useState('');
  const [selBedNo, setSelBedNo] = useState('');
  const [selBundleNo, setSelBundleNo] = useState('');

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d.categories || []));
    fetch('/api/lookup?type=styles').then((r) => r.json()).then((d) => setStyles(d.items || []));
  }, []);

  useEffect(() => {
    if (selStyleId) {
      fetch(`/api/lookup?type=beds&styleId=${selStyleId}`).then((r) => r.json()).then((d) => setBeds(d.items || []));
    } else { setBeds([]); }
    setSelBedNo(''); setBundles([]); setSelBundleNo('');
  }, [selStyleId]);

  useEffect(() => {
    if (selBedNo) {
      const bed = beds.find((b) => b.bedNo === selBedNo);
      if (bed) fetch(`/api/lookup?type=bundles&bedId=${bed.id}`).then((r) => r.json()).then((d) => setBundles(d.items || []));
    } else { setBundles([]); }
    setSelBundleNo('');
  }, [selBedNo]);

  async function loadMaterials(categoryId?: string, q?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    if (q) params.set('q', q);
    const res = await fetch('/api/materials?' + params.toString());
    const data = await res.json();
    setMaterials(data.materials || []);
    setLoading(false);
  }

  async function submit() {
    if (!selectedMaterial) return;
    const qty = Number(quantity);
    if (!qty || qty <= 0) { setError('请输入数量'); return; }

    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/issues', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: selectedMaterial.id, type, quantity: qty,
          styleId: selStyleId || null,
          bedNo: selBedNo || null,
          bundleNo: selBundleNo || null,
          issueMode: type === 'SPECIAL' ? 'special' : 'worker',
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(data.message);
      if (navigator.vibrate) navigator.vibrate(100);
      setTimeout(() => router.push('/worker'), 1500);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  if (success) return <div className="page"><div className="alert success" style={{ padding: 20, fontSize: 15, textAlign: 'center' }}>✓ {success}</div></div>;

  if (step === 'category') {
    const colors = ['#EEEDFE|#3C3489', '#E1F5EE|#085041', '#FAECE7|#712B13', '#FBEAF0|#72243E', '#E6F1FB|#0C447C', '#FAEEDA|#633806', '#EAF3DE|#27500A', '#FCEBEB|#501313'];
    return (
      <div className="page">
        <input type="text" className="search-bar" placeholder="搜索辅料..." value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && keyword.trim()) { setStep('material'); loadMaterials(undefined, keyword.trim()); } }} />
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>选择辅料大类</p>
        <div className="category-grid">
          {categories.map((c, i) => {
            const [bg, fg] = (colors[i % colors.length]).split('|');
            return (
              <button key={c.id} onClick={() => { setStep('material'); loadMaterials(c.id); }} className="category-card" style={{ background: bg, color: fg }}>
                <div className="cname">{c.name}</div><div className="ccount">{c.count} 种</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 'material') {
    return (
      <div className="page">
        <button onClick={() => { setStep('category'); setKeyword(''); }} style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>← 返回</button>
        {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
        {!loading && materials.length === 0 && <div className="empty-state">没有找到辅料</div>}
        {!loading && materials.map((m) => (
          <div key={m.id} className={`material-item${m.stockStatus === 'danger' || m.stockStatus === 'out' ? ' danger' : m.stockStatus === 'warn' ? ' warn' : ''}`}
            onClick={() => { setSelectedMaterial(m); setStep('quantity'); setQuantity('1'); setError(''); }}
            style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="name">{m.name}</div>
            <div style={{ display: 'flex', gap: 8, fontSize: 12, marginTop: 4 }}>
              <span style={{ color: '#1D9E75' }}>良品 {m.stock}</span>
              {m.stockDefect > 0 && <span style={{ color: '#BA7517' }}>次品 {m.stockDefect}</span>}
              <span style={{ color: '#888' }}>{m.unit}{m.location ? ` · ${m.location}` : ''}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Quantity step
  const m = selectedMaterial!;
  return (
    <div className="page">
      <button onClick={() => setStep('material')} style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>← 返回</button>

      <div className="card">
        <h3>{m.name}</h3>
        <div style={{ display: 'flex', gap: 14, fontSize: 14, marginTop: 4 }}>
          <span style={{ color: '#1D9E75' }}>良品 <strong>{m.stock}</strong></span>
          <span style={{ color: '#BA7517' }}>次品 <strong>{m.stockDefect}</strong></span>
          <span style={{ color: '#888' }}>{m.unit}</span>
        </div>
      </div>

      {/* 下拉联动：款号→裁床号→扎号 */}
      {(type === 'OUT' || type === 'SPECIAL') && (
        <div style={{ background: '#f0faf5', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #c3e6d5' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#085041', marginBottom: 8 }}>
            {type === 'SPECIAL' ? '关联款号' : '关联信息（选填）'}
          </p>

          <label className="form-label">款号</label>
          <select className="form-select" value={selStyleId} onChange={(e) => setSelStyleId(e.target.value)}>
            <option value="">{type === 'SPECIAL' ? '请选择款号' : '不关联款号'}</option>
            {styles.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          {selStyleId && type === 'OUT' && (
            <>
              <label className="form-label">裁床号</label>
              <select className="form-select" value={selBedNo} onChange={(e) => setSelBedNo(e.target.value)}>
                <option value="">不关联裁床号</option>
                {beds.map((b) => <option key={b.id} value={b.bedNo}>{b.label}</option>)}
              </select>
            </>
          )}

          {selBedNo && type === 'OUT' && bundles.length > 0 && (
            <>
              <label className="form-label">扎号</label>
              <select className="form-select" value={selBundleNo} onChange={(e) => setSelBundleNo(e.target.value)}>
                <option value="">不关联扎号</option>
                {bundles.map((b) => <option key={b.id} value={b.bundleNo}>{b.label}</option>)}
              </select>
            </>
          )}
        </div>
      )}

      <label className="form-label">{config.label}数量（{m.unit}）</label>
      <div className="qty-row">
        <button className="qty-btn" onClick={() => setQuantity(String(Math.max(0, Number(quantity) - 1)))}>−</button>
        <input type="number" inputMode="decimal" className="qty-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <button className="qty-btn" onClick={() => setQuantity(String(Number(quantity) + 1))}>+</button>
      </div>

      <label className="form-label">备注</label>
      <input type="text" className="form-input" value={note} onChange={(e) => setNote(e.target.value)} />

      {error && <div className="alert error">{error}</div>}

      <button className={`submit-btn ${config.color === 'amber' ? '' : config.color}`}
        style={config.color === 'amber' ? { background: '#BA7517' } : {}}
        onClick={submit} disabled={submitting}>
        {submitting ? '提交中...' : `确认${config.label}`}
      </button>
    </div>
  );
}
