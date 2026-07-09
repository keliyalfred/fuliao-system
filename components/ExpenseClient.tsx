'use client';

import { useEffect, useState } from 'react';

const DEFAULT_CATEGORIES: Record<string, string[]> = {
  '采购类': ['布料', '辅料', '办公用品', '其他'],
  '办公成本': ['订餐', '订水', '其他'],
  '房屋支出': ['房租', '水电', '维修', '其他'],
  '教育培训': ['培训费'],
  '团队活动': ['团建费用'],
  '运费': ['国内运费', '国际运费', '报关费', '海外仓运费', '其他'],
  '其他杂费': ['其他'],
};
const PAY_STATUS = ['已付款', '未付款'];
const PAY_METHODS = ['公账', '私账'];
const INVOICE_STATUS = ['已开票', '未开票'];

interface Expense {
  id: string; category: string; subCategory: string; amount: number;
  payStatus: string; payMethod: string; invoiceStatus: string;
  imageCount: number; invoiceCount: number;
  supplier: string | null; description: string | null;
  note: string | null; expenseDate: string;
  createdBy: string; createdAt: string;
}

type Tab = 'list' | 'add' | 'summary';

export function ExpenseClient() {
  const [tab, setTab] = useState<Tab>('list');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterPayStatus, setFilterPayStatus] = useState('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState('');
  const [filterPayMethod, setFilterPayMethod] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState<string | null>(null);
  const [invoiceFiles, setInvoiceFiles] = useState<string[]>([]);
  // 图片按需缓存
  const [imgCache, setImgCache] = useState<Record<string, { images: string[]; invoiceImages: string[] }>>({});
  const [loadingImgId, setLoadingImgId] = useState('');

  // 动态分类
  const [CATEGORIES, setCATEGORIES] = useState<Record<string, string[]>>(DEFAULT_CATEGORIES);
  const [customCat, setCustomCat] = useState(false);
  const [customCatName, setCustomCatName] = useState('');
  const [customSub, setCustomSub] = useState(false);
  const [customSubName, setCustomSubName] = useState('');

  // Form
  const [fCat, setFCat] = useState(Object.keys(CATEGORIES)[0]);
  const [fSub, setFSub] = useState(CATEGORIES[Object.keys(CATEGORIES)[0]][0]);
  const [fAmount, setFAmount] = useState('');
  const [fPayStatus, setFPayStatus] = useState('已付款');
  const [fPayMethod, setFPayMethod] = useState('公账');
  const [fInvoiceStatus, setFInvoiceStatus] = useState('未开票');
  const [fInvoiceImages, setFInvoiceImages] = useState<string[]>([]);
  const [fSupplier, setFSupplier] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fNote, setFNote] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fImages, setFImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => {
    if (tab === 'list') loadList();
    if (tab === 'summary') loadSummary();
  }, [tab, filterCat, filterMonth, filterPayStatus, filterInvoiceStatus, filterPayMethod, filterSupplier]);

  async function loadCategories() {
    try {
      const res = await fetch('/api/expenses?view=categories');
      const data = await res.json();
      if (data.suppliers) setSuppliers(data.suppliers);
      if (data.categories) {
        const merged = { ...DEFAULT_CATEGORIES };
        for (const [cat, subs] of Object.entries(data.categories as Record<string, string[]>)) {
          if (!merged[cat]) merged[cat] = [];
          for (const sub of subs) {
            if (!merged[cat].includes(sub)) merged[cat].push(sub);
          }
        }
        setCATEGORIES(merged);
      }
    } catch {}
  }

  async function loadList() {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({ view: 'list' });
      if (filterCat) params.set('category', filterCat);
      if (filterMonth) params.set('month', filterMonth);
      if (filterPayStatus) params.set('payStatus', filterPayStatus);
      if (filterInvoiceStatus) params.set('invoiceStatus', filterInvoiceStatus);
      if (filterPayMethod) params.set('payMethod', filterPayMethod);
      if (filterSupplier) params.set('supplier', filterSupplier);
      const res = await fetch('/api/expenses?' + params.toString());
      const data = await res.json();
      if (!res.ok) { setErr(data.error || '加载失败'); setExpenses([]); }
      else setExpenses(data.expenses || []);
    } catch (e: any) {
      setErr('加载失败：' + (e?.message || '网络错误'));
    } finally { setLoading(false); }
  }

  async function loadSummary() {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({ view: 'summary' });
      if (filterMonth) params.set('month', filterMonth);
      const res = await fetch('/api/expenses?' + params.toString());
      const data = await res.json();
      if (!res.ok) { setErr(data.error || '加载失败'); setSummary(null); }
      else setSummary(data);
    } catch (e: any) {
      setErr('加载失败：' + (e?.message || '网络错误'));
    } finally { setLoading(false); }
  }

  async function loadExpenseImages(id: string) {
    if (imgCache[id]) return;
    setLoadingImgId(id);
    try {
      const res = await fetch(`/api/expenses?view=images&id=${id}`);
      const data = await res.json();
      if (res.ok) {
        setImgCache((c) => ({ ...c, [id]: { images: data.images || [], invoiceImages: data.invoiceImages || [] } }));
      }
    } catch {}
    finally { setLoadingImgId(''); }
  }

  async function toggleInvoiceStatusFn(id: string) {
    if (!confirm('切换开票状态？')) return;
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggleInvoiceStatus', id }),
    });
    const data = await res.json();
    if (res.ok) { loadList(); flash(data.message); }
    else setErr(data.error);
  }

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500); }
  const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

  function handleImgUpload(setter: (fn: (p: string[]) => string[]) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files; if (!files) return;
      Array.from(files).forEach((file) => {
        if (file.size > 5 * 1024 * 1024) { setErr('图片不能超过5MB'); return; }
        const reader = new FileReader();
        reader.onload = () => setter((prev) => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    };
  }

  async function submit() {
    if (!fAmount || Number(fAmount) <= 0) { setErr('请填写金额'); return; }
    setSubmitting(true); setErr('');
    try {
      const actualCat = customCat ? customCatName : fCat;
      const actualSub = customSub ? customSubName : fSub;
      if (!actualCat || !actualSub) { setErr('请填写分类'); return; }

      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create', category: actualCat, subCategory: actualSub,
          amount: Number(fAmount), payStatus: fPayStatus, payMethod: fPayMethod,
          invoiceStatus: fInvoiceStatus,
          invoiceImages: fInvoiceStatus === '已开票' ? fInvoiceImages : [],
          supplier: fSupplier, description: fDesc, note: fNote,
          expenseDate: fDate, images: fImages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash(data.message);
      setFAmount(''); setFSupplier(''); setFDesc(''); setFNote('');
      setFImages([]); setFInvoiceImages([]);
      setFInvoiceStatus('未开票');
      setCustomCat(false); setCustomCatName('');
      setCustomSub(false); setCustomSubName('');
      loadCategories(); // 刷新分类列表
      setTab('list');
    } catch (e: any) { setErr(e.message); }
    finally { setSubmitting(false); }
  }

  async function deleteExpense(id: string) {
    if (!confirm('确定删除该记录？')) return;
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (res.ok) { loadList(); flash('已删除'); }
  }

  // 更新开票状态+上传发票
  async function saveInvoice(id: string) {
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, invoiceStatus: '已开票', invoiceImages: invoiceFiles }),
    });
    if (res.ok) { setUploadingInvoice(null); setInvoiceFiles([]); loadList(); flash('发票已上传'); }
  }

  // 切换付款状态
  async function togglePayStatus(id: string, current: string) {
    const newStatus = current === '已付款' ? '未付款' : '已付款';
    if (!confirm(`确定改为"${newStatus}"？`)) return;
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, payStatus: newStatus }),
    });
    if (res.ok) { loadList(); flash(`已改为${newStatus}`); }
  }

  // 切换付款方式
  async function togglePayMethod(id: string, current: string) {
    const newMethod = current === '公账' ? '私账' : '公账';
    if (!confirm(`确定改为"${newMethod}"？`)) return;
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, payMethod: newMethod }),
    });
    if (res.ok) { loadList(); flash(`已改为${newMethod}`); }
  }

  function downloadImage(url: string, name: string) {
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
  }

  return (
    <div className="page">
      {msg && <div className="alert success">{msg}</div>}

      {previewImg && (
        <div onClick={() => setPreviewImg(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={previewImg} style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8 }} />
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 10 }}>
            <button onClick={(e) => { e.stopPropagation(); downloadImage(previewImg, '凭证.png'); }} style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', borderRadius: 6, fontSize: 13 }}>下载</button>
            <button onClick={() => setPreviewImg(null)} style={{ padding: '6px 14px', background: '#A32D2D', color: '#fff', borderRadius: 6, fontSize: 13 }}>关闭</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['list', '费用记录'], ['add', '+ 新增'], ['summary', '统计汇总']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className="badge"
            style={{ padding: '8px 16px', fontSize: 14, background: tab === key ? '#1D9E75' : '#f0f0f0', color: tab === key ? '#fff' : '#666' }}>{label}</button>
        ))}
      </div>

      {/* === 新增 === */}
      {tab === 'add' && (
        <div className="card" style={{ border: '2px solid #1D9E75' }}>
          <h3>新增费用记录</h3>
          {err && <div className="alert error">{err}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="form-label">费用大类</label>
              {customCat ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input className="form-input" style={{ marginBottom: 0, flex: 1 }} placeholder="输入新大类名称" value={customCatName} onChange={(e) => setCustomCatName(e.target.value)} />
                  <button onClick={() => { setCustomCat(false); setCustomCatName(''); }} style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>取消</button>
                </div>
              ) : (
                <select className="form-select" value={fCat} onChange={(e) => {
                  if (e.target.value === '__custom__') { setCustomCat(true); setCustomSub(true); }
                  else { setFCat(e.target.value); setFSub((CATEGORIES[e.target.value] || ['其他'])[0]); setCustomSub(false); }
                }}>
                  {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ 自定义大类</option>
                </select>
              )}
            </div>
            <div><label className="form-label">费用小类</label>
              {customSub ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input className="form-input" style={{ marginBottom: 0, flex: 1 }} placeholder="输入新小类名称" value={customSubName} onChange={(e) => setCustomSubName(e.target.value)} />
                  {!customCat && <button onClick={() => { setCustomSub(false); setCustomSubName(''); }} style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>取消</button>}
                </div>
              ) : (
                <select className="form-select" value={fSub} onChange={(e) => {
                  if (e.target.value === '__custom__') { setCustomSub(true); }
                  else { setFSub(e.target.value); }
                }}>
                  {(CATEGORIES[fCat] || []).map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom__">+ 自定义小类</option>
                </select>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="form-label">金额 (¥)</label>
              <input className="form-input" type="number" step="0.01" value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="0.00" /></div>
            <div><label className="form-label">费用日期</label>
              <input className="form-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label className="form-label">付款状态</label>
              <select className="form-select" value={fPayStatus} onChange={(e) => setFPayStatus(e.target.value)}>
                {PAY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div><label className="form-label">付款方式</label>
              <select className="form-select" value={fPayMethod} onChange={(e) => setFPayMethod(e.target.value)}>
                {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select></div>
            <div><label className="form-label">开票状态</label>
              <select className="form-select" value={fInvoiceStatus} onChange={(e) => setFInvoiceStatus(e.target.value)}>
                {INVOICE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>

          {fInvoiceStatus === '已开票' && (
            <div style={{ background: '#f0faf5', borderRadius: 10, padding: 12, marginBottom: 14, border: '1px solid #c3e6d5' }}>
              <label className="form-label" style={{ color: '#085041' }}>上传发票</label>
              <input type="file" accept="image/*" multiple onChange={handleImgUpload(setFInvoiceImages)} style={{ fontSize: 13, marginBottom: 6 }} />
              {fInvoiceImages.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {fInvoiceImages.map((img, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={img} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }} onClick={() => setPreviewImg(img)} />
                      <button onClick={() => setFInvoiceImages(fInvoiceImages.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, background: '#A32D2D', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="form-label">供应商/对方</label>
          <input className="form-input" list="supplier-names" value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} placeholder="如 顺丰纺织" />
          <datalist id="supplier-names">
            {suppliers.map((s) => <option key={s} value={s} />)}
          </datalist>
          <label className="form-label">费用说明</label>
          <input className="form-input" value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="如 4月份布料采购" />
          <label className="form-label">备注</label>
          <input className="form-input" value={fNote} onChange={(e) => setFNote(e.target.value)} />

          <label className="form-label">付款凭证/收据照片</label>
          <input type="file" accept="image/*" multiple onChange={handleImgUpload(setFImages)} style={{ fontSize: 13, marginBottom: 6 }} />
          {fImages.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {fImages.map((img, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={img} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }} onClick={() => setPreviewImg(img)} />
                  <button onClick={() => setFImages(fImages.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, background: '#A32D2D', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <button className="submit-btn" onClick={submit} disabled={submitting}>{submitting ? '提交中...' : '确认添加'}</button>
        </div>
      )}

      {/* === 列表 === */}
      {tab === 'list' && (
        <>
          {err && <div className="alert error">{err}</div>}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ flex: 1, marginBottom: 0, minWidth: 100 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">全部分类</option>
              {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="month" className="form-input" style={{ flex: 1, marginBottom: 0, minWidth: 120 }} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ flex: 1, marginBottom: 0, minWidth: 100 }} value={filterPayStatus} onChange={(e) => setFilterPayStatus(e.target.value)}>
              <option value="">付款状态</option>
              {PAY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select" style={{ flex: 1, marginBottom: 0, minWidth: 100 }} value={filterInvoiceStatus} onChange={(e) => setFilterInvoiceStatus(e.target.value)}>
              <option value="">开票状态</option>
              {INVOICE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select" style={{ flex: 1, marginBottom: 0, minWidth: 100 }} value={filterPayMethod} onChange={(e) => setFilterPayMethod(e.target.value)}>
              <option value="">账户</option>
              {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ flex: 1, marginBottom: 0, minWidth: 120 }} value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}>
              <option value="">全部供应商/公司</option>
              {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setGroupBySupplier(!groupBySupplier)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: groupBySupplier ? '#185FA5' : '#fff', color: groupBySupplier ? '#fff' : '#185FA5', fontSize: 12 }}>按公司分组</button>
            {(filterCat || filterMonth || filterPayStatus || filterInvoiceStatus || filterPayMethod || filterSupplier) && (
              <button onClick={() => { setFilterCat(''); setFilterMonth(''); setFilterPayStatus(''); setFilterInvoiceStatus(''); setFilterPayMethod(''); setFilterSupplier(''); }} style={{ fontSize: 12, color: '#A32D2D' }}>清空筛选</button>
            )}
          </div>

          {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
          {!loading && expenses.length === 0 && <div className="empty-state">暂无费用记录</div>}

          {!loading && (() => {
            const renderCard = (e: Expense) => {
              const cached = imgCache[e.id];
              return (
                <div key={e.id} className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{e.category} · {e.subCategory}</div>
                      {e.supplier && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{e.supplier}</div>}
                      {e.description && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{e.description}</div>}
                      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => togglePayStatus(e.id, e.payStatus)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: e.payStatus === '已付款' ? '#E1F5EE' : '#FCEBEB', color: e.payStatus === '已付款' ? '#1D9E75' : '#A32D2D', border: '1px solid transparent' }}>{e.payStatus}</button>
                        <button onClick={() => togglePayMethod(e.id, e.payMethod)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: e.payMethod === '公账' ? '#E6F1FB' : '#FBEAF0', color: e.payMethod === '公账' ? '#0C447C' : '#72243E', border: '1px solid transparent' }}>{e.payMethod}</button>
                        <button onClick={() => toggleInvoiceStatusFn(e.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: e.invoiceStatus === '已开票' ? '#E1F5EE' : '#FAEEDA', color: e.invoiceStatus === '已开票' ? '#1D9E75' : '#BA7517', border: '1px solid transparent' }}>{e.invoiceStatus}</button>
                      </div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{new Date(e.expenseDate).toLocaleDateString('zh-CN')} · {e.createdBy}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 80 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#A32D2D' }}>¥{fmt(e.amount)}</div>
                      <button onClick={() => deleteExpense(e.id)} style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>删除</button>
                    </div>
                  </div>

                  {/* 图片按需加载 */}
                  {(e.imageCount > 0 || e.invoiceCount > 0) && (
                    <div style={{ marginTop: 8 }}>
                      {!cached && (
                        <button onClick={() => loadExpenseImages(e.id)} style={{ fontSize: 12, padding: '4px 10px', background: '#f0f0f0', color: '#666', borderRadius: 6 }}>
                          {loadingImgId === e.id ? '加载中...' : `📷 付款凭证 ${e.imageCount} 张${e.invoiceCount > 0 ? ` · 发票 ${e.invoiceCount} 张` : ''} · 点击查看`}
                        </button>
                      )}
                      {cached && cached.images.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>付款凭证：</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {cached.images.map((img, i) => (
                              <img key={i} src={img} onClick={() => setPreviewImg(img)} style={{ width: 55, height: 55, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee', cursor: 'pointer' }} />
                            ))}
                          </div>
                        </div>
                      )}
                      {cached && cached.invoiceImages.length > 0 && (
                        <div style={{ marginTop: 8, padding: 8, background: '#f0faf5', borderRadius: 6 }}>
                          <div style={{ fontSize: 11, color: '#085041', marginBottom: 4, fontWeight: 500 }}>发票：</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {cached.invoiceImages.map((img, i) => (
                              <div key={i} style={{ position: 'relative' }}>
                                <img src={img} onClick={() => setPreviewImg(img)} style={{ width: 55, height: 55, objectFit: 'cover', borderRadius: 6, border: '1px solid #c3e6d5', cursor: 'pointer' }} />
                                <button onClick={() => downloadImage(img, `发票_${i + 1}.png`)} style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 10, background: '#1D9E75', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>↓</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 未开票 → 上传发票入口 */}
                  {e.invoiceStatus === '未开票' && (
                    <div style={{ marginTop: 8 }}>
                      {uploadingInvoice === e.id ? (
                        <div style={{ padding: 10, background: '#f0faf5', borderRadius: 8, border: '1px solid #c3e6d5' }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#085041', marginBottom: 6 }}>上传发票</div>
                          <input type="file" accept="image/*" multiple onChange={handleImgUpload(setInvoiceFiles)} style={{ fontSize: 12, marginBottom: 6 }} />
                          {invoiceFiles.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                              {invoiceFiles.map((img, i) => (
                                <img key={i} src={img} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }} onClick={() => setPreviewImg(img)} />
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => saveInvoice(e.id)} disabled={invoiceFiles.length === 0} style={{ fontSize: 12, padding: '4px 12px', background: '#1D9E75', color: '#fff', borderRadius: 6 }}>确认上传</button>
                            <button onClick={() => { setUploadingInvoice(null); setInvoiceFiles([]); }} style={{ fontSize: 12, padding: '4px 12px', background: '#f0f0f0', borderRadius: 6 }}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setUploadingInvoice(e.id); setInvoiceFiles([]); }} style={{ fontSize: 12, padding: '4px 12px', background: '#FAEEDA', color: '#854F0B', borderRadius: 6 }}>+ 上传发票</button>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            if (!groupBySupplier) return expenses.map(renderCard);

            // 按公司分组
            const groups: Record<string, Expense[]> = {};
            const sorted = [...expenses].sort((a, b) => {
              const s = (a.supplier || 'zzz').localeCompare(b.supplier || 'zzz');
              if (s !== 0) return s;
              return new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime();
            });
            for (const e of sorted) {
              const k = e.supplier || '未填供应商';
              if (!groups[k]) groups[k] = [];
              groups[k].push(e);
            }
            return Object.entries(groups).map(([sup, items]) => {
              const total = items.reduce((s, e) => s + e.amount, 0);
              return (
                <div key={sup}>
                  <div style={{ padding: '10px 12px', background: '#E6F1FB', borderRadius: 8, margin: '10px 0 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0C447C' }}>🏢 {sup} <span style={{ fontSize: 12, color: '#666', fontWeight: 400 }}>({items.length} 笔)</span></div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0C447C' }}>¥{fmt(total)}</div>
                  </div>
                  {items.map(renderCard)}
                </div>
              );
            });
          })()}
        </>
      )}

      {/* === 统计 === */}
      {tab === 'summary' && (
        <>
          <input type="month" className="form-input" style={{ marginBottom: 14 }} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
          {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>首次加载可能需要几秒...</p>}
          {!loading && summary && (
            <>
              <div className="card" style={{ background: '#f0faf5', border: '1px solid #c3e6d5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ fontSize: 13, color: '#888' }}>总支出</div><div style={{ fontSize: 24, fontWeight: 700, color: '#A32D2D' }}>¥{fmt(summary.grandTotal)}</div></div>
                  <div style={{ fontSize: 13, color: '#666' }}>{summary.count} 笔</div>
                </div>
              </div>

              <div className="card"><h3>按付款状态</h3>
                {summary.byPayStatus?.map((p: any) => (
                  <div key={p.status} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                    <span style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, background: p.status === '已付款' ? '#E1F5EE' : '#FCEBEB', color: p.status === '已付款' ? '#1D9E75' : '#A32D2D' }}>{p.status}</span>
                    <span style={{ fontWeight: 600 }}>¥{fmt(p.total)}</span>
                  </div>
                ))}
              </div>

              <div className="card"><h3>按付款方式</h3>
                {summary.byPayMethod?.map((p: any) => (
                  <div key={p.method} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                    <span style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, background: p.method === '公账' ? '#E6F1FB' : '#FBEAF0', color: p.method === '公账' ? '#0C447C' : '#72243E' }}>{p.method}</span>
                    <span style={{ fontWeight: 600 }}>¥{fmt(p.total)}</span>
                  </div>
                ))}
              </div>

              <div className="card"><h3>按开票状态</h3>
                {summary.byInvoice?.map((inv: any) => (
                  <div key={inv.status} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                    <span style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, background: inv.status === '已开票' ? '#E1F5EE' : '#FAEEDA', color: inv.status === '已开票' ? '#1D9E75' : '#BA7517' }}>{inv.status}</span>
                    <span style={{ fontWeight: 600 }}>¥{fmt(inv.total)}</span>
                  </div>
                ))}
              </div>

              <div className="card"><h3>按分类明细</h3>
                {summary.byCategory?.map((c: any) => (
                  <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f0f0f0', fontSize: 13 }}>
                    <span>{c.name} <span style={{ color: '#aaa' }}>({c.count}笔)</span></span>
                    <span style={{ fontWeight: 600 }}>¥{fmt(c.total)}</span>
                  </div>
                ))}
              </div>

              {summary.byMonth?.length > 1 && (
                <div className="card"><h3>按月度</h3>
                  {summary.byMonth.map((m: any) => (
                    <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f0f0f0', fontSize: 13 }}>
                      <span>{m.month}</span><span style={{ fontWeight: 600 }}>¥{fmt(m.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
