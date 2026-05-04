'use client';

import { useEffect, useState } from 'react';

const CATEGORIES: Record<string, string[]> = {
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
  invoiceImages: string[]; supplier: string | null; description: string | null;
  note: string | null; expenseDate: string; images: string[];
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
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState<string | null>(null); // expense id being edited
  const [invoiceFiles, setInvoiceFiles] = useState<string[]>([]);

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

  useEffect(() => { if (tab === 'list') loadList(); if (tab === 'summary') loadSummary(); }, [tab, filterCat, filterMonth]);

  async function loadList() {
    setLoading(true);
    const params = new URLSearchParams({ view: 'list' });
    if (filterCat) params.set('category', filterCat);
    if (filterMonth) params.set('month', filterMonth);
    const res = await fetch('/api/expenses?' + params.toString());
    const data = await res.json();
    setExpenses(data.expenses || []);
    setLoading(false);
  }

  async function loadSummary() {
    setLoading(true);
    const params = new URLSearchParams({ view: 'summary' });
    if (filterMonth) params.set('month', filterMonth);
    const res = await fetch('/api/expenses?' + params.toString());
    setSummary(await res.json());
    setLoading(false);
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
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create', category: fCat, subCategory: fSub,
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
      setFInvoiceStatus('未开票'); setTab('list');
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
              <select className="form-select" value={fCat} onChange={(e) => { setFCat(e.target.value); setFSub(CATEGORIES[e.target.value][0]); }}>
                {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="form-label">费用小类</label>
              <select className="form-select" value={fSub} onChange={(e) => setFSub(e.target.value)}>
                {(CATEGORIES[fCat] || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
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
          <input className="form-input" value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} placeholder="如 顺丰纺织" />
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
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ flex: 1, marginBottom: 0, minWidth: 100 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">全部分类</option>
              {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="month" className="form-input" style={{ flex: 1, marginBottom: 0, minWidth: 120 }} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
          </div>

          {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>首次加载可能需要几秒...</p>}
          {!loading && expenses.length === 0 && <div className="empty-state">暂无费用记录</div>}

          {!loading && expenses.map((e) => (
            <div key={e.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{e.category} · {e.subCategory}</div>
                  {e.supplier && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{e.supplier}</div>}
                  {e.description && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{e.description}</div>}

                  <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => togglePayStatus(e.id, e.payStatus)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: e.payStatus === '已付款' ? '#E1F5EE' : '#FCEBEB', color: e.payStatus === '已付款' ? '#1D9E75' : '#A32D2D', border: '1px solid transparent' }}>{e.payStatus}</button>
                    <button onClick={() => togglePayMethod(e.id, e.payMethod)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: e.payMethod === '公账' ? '#E6F1FB' : '#FBEAF0', color: e.payMethod === '公账' ? '#0C447C' : '#72243E', border: '1px solid transparent' }}>{e.payMethod}</button>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: e.invoiceStatus === '已开票' ? '#E1F5EE' : '#FAEEDA', color: e.invoiceStatus === '已开票' ? '#1D9E75' : '#BA7517' }}>{e.invoiceStatus}</span>
                  </div>

                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{new Date(e.expenseDate).toLocaleDateString('zh-CN')} · {e.createdBy}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#A32D2D' }}>¥{fmt(e.amount)}</div>
                  <button onClick={() => deleteExpense(e.id)} style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>删除</button>
                </div>
              </div>

              {/* 付款凭证缩略图 */}
              {e.images.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>付款凭证：</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {e.images.map((img, i) => (
                      <img key={i} src={img} onClick={() => setPreviewImg(img)} style={{ width: 55, height: 55, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              )}

              {/* 发票区域 */}
              {e.invoiceStatus === '已开票' && e.invoiceImages.length > 0 && (
                <div style={{ marginTop: 8, padding: 8, background: '#f0faf5', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#085041', marginBottom: 4, fontWeight: 500 }}>发票：</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {e.invoiceImages.map((img, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={img} onClick={() => setPreviewImg(img)} style={{ width: 55, height: 55, objectFit: 'cover', borderRadius: 6, border: '1px solid #c3e6d5', cursor: 'pointer' }} />
                        <button onClick={() => downloadImage(img, `发票_${i + 1}.png`)} style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 10, background: '#1D9E75', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>↓</button>
                      </div>
                    ))}
                  </div>
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
          ))}
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
