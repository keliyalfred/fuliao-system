'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Category { id: string; name: string; count: number; }
interface MaterialVariant {
  id: string; variantName: string; stock: number; stockDefect: number; stockWaste: number; unitPrice: number | null;
}
interface Material {
  id: string; code: string; name: string; category: string; unit: string;
  spec?: string; color?: string; supplier?: string; unitPrice?: number;
  usage?: string; note?: string;
  stock: number; stockDefect: number; stockWaste: number; location?: string; stockStatus: string;
  variants?: MaterialVariant[];
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
  const [selectedVariant, setSelectedVariant] = useState<MaterialVariant | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 领料：选择从哪个库存领（良品/次品/废品）
  const [stockSource, setStockSource] = useState('good'); // good/defect/waste
  // 废品报废：抵扣货款金额
  const [deductAmount, setDeductAmount] = useState('');

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
          variantId: selectedVariant?.id || null,
          stockSource: (type === 'OUT' || type === 'SPECIAL') ? stockSource : undefined,
          deductAmount: type === 'WASTE' ? (Number(deductAmount) || 0) : undefined,
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
        {!loading && materials.map((m) => {
          const hasVariants = m.variants && m.variants.length > 0;
          return (
            <div key={m.id} className={`material-item${m.stockStatus === 'danger' || m.stockStatus === 'out' ? ' danger' : m.stockStatus === 'warn' ? ' warn' : ''}`}
              style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0, overflow: 'hidden' }}>
              {/* 主信息 - 没有颜色直接点击选择，有颜色展开 */}
              <div onClick={() => {
                if (!hasVariants) { setSelectedMaterial(m); setSelectedVariant(null); setStep('quantity'); setQuantity('1'); setError(''); setStockSource('good'); }
              }} style={{ padding: '12px 16px', cursor: 'pointer' }}>
                <div className="name">{m.name}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  [{m.code}]{m.color ? ` · ${m.color}` : ''}{m.spec ? ` · ${m.spec}` : ''}{m.supplier ? ` · ${m.supplier}` : ''}{hasVariants ? ` · ${m.variants!.length}色` : ''}
                </div>
                {m.usage && <div style={{ fontSize: 12, color: '#854F0B', marginTop: 2 }}>用量：{m.usage}</div>}
                {m.note && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>备注：{m.note}</div>}
                <div style={{ display: 'flex', gap: 8, fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: '#1D9E75' }}>良品 {m.stock}</span>
                  {m.stockDefect > 0 && <span style={{ color: '#BA7517' }}>次品 {m.stockDefect}</span>}
                  {m.stockWaste > 0 && <span style={{ color: '#A32D2D' }}>废品 {m.stockWaste}</span>}
                  <span style={{ color: '#888' }}>{m.unit}{m.location ? ` · ${m.location}` : ''}</span>
                </div>
              </div>
              {/* 颜色子项 - 点击具体颜色进入领料 */}
              {hasVariants && (
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  {m.variants!.map((v) => (
                    <div key={v.id} onClick={() => { setSelectedMaterial(m); setSelectedVariant(v); setStep('quantity'); setQuantity('1'); setError(''); setStockSource('good'); }}
                      style={{ padding: '8px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>→ {v.variantName}</span>
                        <span style={{ fontSize: 12, color: '#1D9E75', marginLeft: 6 }}>良品 {v.stock}</span>
                        {v.stockDefect > 0 && <span style={{ fontSize: 12, color: '#BA7517', marginLeft: 4 }}>次品 {v.stockDefect}</span>}
                        {v.stockWaste > 0 && <span style={{ fontSize: 12, color: '#A32D2D', marginLeft: 4 }}>废品 {v.stockWaste}</span>}
                      </div>
                      <span style={{ fontSize: 12, color: '#888' }}>→</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Quantity step
  const m = selectedMaterial!;
  return (
    <div className="page">
      <button onClick={() => setStep('material')} style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>← 返回</button>

      <div className="card">
        <h3>{m.name}{selectedVariant ? ` · ${selectedVariant.variantName}` : ''}</h3>
        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
          [{m.code}]
          {m.color ? ` · ${m.color}` : ''}
          {m.spec ? ` · ${m.spec}` : ''}
          {m.supplier ? ` · ${m.supplier}` : ''}
        </div>
        {m.usage && <div style={{ fontSize: 13, color: '#854F0B', marginTop: 4, fontWeight: 500 }}>📐 用量：{m.usage}</div>}
        {m.note && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>📝 备注：{m.note}</div>}
        <div style={{ display: 'flex', gap: 14, fontSize: 14, marginTop: 6 }}>
          {selectedVariant ? (
            <>
              <span style={{ color: '#1D9E75' }}>良品 <strong>{selectedVariant.stock}</strong></span>
              <span style={{ color: '#BA7517' }}>次品 <strong>{selectedVariant.stockDefect}</strong></span>
              <span style={{ color: '#A32D2D' }}>废品 <strong>{selectedVariant.stockWaste}</strong></span>
            </>
          ) : (
            <>
              <span style={{ color: '#1D9E75' }}>良品 <strong>{m.stock}</strong></span>
              <span style={{ color: '#BA7517' }}>次品 <strong>{m.stockDefect}</strong></span>
              <span style={{ color: '#A32D2D' }}>废品 <strong>{m.stockWaste}</strong></span>
            </>
          )}
          <span style={{ color: '#888' }}>{m.unit}</span>
        </div>
      </div>

      {/* 领料：选择从哪个库存领 */}
      {(type === 'OUT' || type === 'SPECIAL') && (
        <div style={{ marginBottom: 14 }}>
          <label className="form-label">领取来源</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'good', label: `良品 (${selectedVariant ? selectedVariant.stock : m.stock})`, color: '#1D9E75', bg: '#E1F5EE' },
              { key: 'defect', label: `次品 (${selectedVariant ? selectedVariant.stockDefect : m.stockDefect})`, color: '#BA7517', bg: '#FAEEDA' },
              { key: 'waste', label: `废品 (${selectedVariant ? selectedVariant.stockWaste : m.stockWaste})`, color: '#A32D2D', bg: '#FCEBEB' },
            ].map((s) => (
              <button key={s.key} onClick={() => setStockSource(s.key)}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500, textAlign: 'center',
                  background: stockSource === s.key ? s.bg : '#f5f5f5',
                  color: stockSource === s.key ? s.color : '#999',
                  border: stockSource === s.key ? `2px solid ${s.color}` : '2px solid transparent' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 下拉联动：款号→裁床号→扎号 */}
      {(type === 'OUT' || type === 'SPECIAL' || type === 'RETURN') && (
        <div style={{ background: '#f0faf5', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #c3e6d5' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#085041', marginBottom: 8 }}>
            {type === 'SPECIAL' ? '关联款号' : type === 'RETURN' ? '退回到哪张需求（选填）' : '关联信息（选填）'}
          </p>

          <label className="form-label">款号</label>
          <select className="form-select" value={selStyleId} onChange={(e) => setSelStyleId(e.target.value)}>
            <option value="">{type === 'SPECIAL' ? '请选择款号' : '不关联款号'}</option>
            {styles.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          {selStyleId && (type === 'OUT' || type === 'RETURN') && (
            <>
              <label className="form-label">裁床号</label>
              <select className="form-select" value={selBedNo} onChange={(e) => setSelBedNo(e.target.value)}>
                <option value="">不关联裁床号</option>
                {beds.map((b) => <option key={b.id} value={b.bedNo}>{b.label}</option>)}
              </select>
            </>
          )}

          {selBedNo && (type === 'OUT' || type === 'RETURN') && bundles.length > 0 && (
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
        <button className="qty-btn" onClick={() => setQuantity(String(Math.max(0, Number(quantity) - 1)))}>−1</button>
        <button className="qty-btn" style={{ fontSize: 12 }} onClick={() => setQuantity(String(Math.max(0, Number(quantity) - 0.5)))}>−0.5</button>
        <input type="number" inputMode="decimal" step="0.1" className="qty-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <button className="qty-btn" style={{ fontSize: 12 }} onClick={() => setQuantity(String(Number(quantity) + 0.5))}>+0.5</button>
        <button className="qty-btn" onClick={() => setQuantity(String(Number(quantity) + 1))}>+1</button>
      </div>

      <label className="form-label">备注</label>
      <input type="text" className="form-input" value={note} onChange={(e) => setNote(e.target.value)} />

      {/* 废品报废：抵扣货款金额 */}
      {type === 'WASTE' && (
        <div style={{ background: '#fef9f0', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #f0dbb8' }}>
          <label className="form-label" style={{ color: '#854F0B' }}>抵扣货款金额（¥，选填）</label>
          <input type="number" step="0.01" className="form-input" value={deductAmount}
            onChange={(e) => setDeductAmount(e.target.value)} placeholder="0.00" />
          <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>报废后可抵扣供应商货款的金额</p>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      <button className={`submit-btn ${config.color === 'amber' ? '' : config.color}`}
        style={config.color === 'amber' ? { background: '#BA7517' } : {}}
        onClick={submit} disabled={submitting}>
        {submitting ? '提交中...' : `确认${config.label}`}
      </button>
    </div>
  );
}
