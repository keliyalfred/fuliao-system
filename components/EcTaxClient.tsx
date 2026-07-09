'use client';

import { useEffect, useState } from 'react';

const PRESET_PLATFORMS = ['Amazon', 'Wildberries', 'TikTok', 'Shein'];
const PRESET_CURRENCIES = ['USD', 'EUR', 'RUB', 'GBP', 'JPY', 'KRW', 'CAD', 'AUD'];

interface Shop { id: string; platform: string; shopName: string; currency: string; note: string | null; recordCount: number; }
interface Record { id: string; shopId: string; platform: string; shopName: string; yearMonth: string; grossSales: number; refunds: number; platformFee: number; adsFee: number; otherFee: number; netIncome: number; orderCount: number; returnCount: number; currency: string; withdrawAmount: number; cnyAmount: number; exchangeRate: number; incomeImages: string[]; orderImages: string[]; withdrawImages: string[]; note: string | null; }

type Tab = 'records' | 'add' | 'shops' | 'summary';

export function EcTaxClient() {
  const [tab, setTab] = useState<Tab>('records');
  const [shops, setShops] = useState<Shop[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterShop, setFilterShop] = useState('');
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  // Shop form
  const [showShopForm, setShowShopForm] = useState(false);
  const [sPlatform, setSPlatform] = useState(PRESET_PLATFORMS[0]);
  const [sCustomPlatform, setSCustomPlatform] = useState('');
  const [sShopName, setSShopName] = useState('');
  const [sCurrency, setSCurrency] = useState('USD');
  const [sCustomCurrency, setSCustomCurrency] = useState('');

  // Record form
  const [rShopId, setRShopId] = useState('');
  const [rMonth, setRMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rGross, setRGross] = useState('');
  const [rRefunds, setRRefunds] = useState('');
  const [rPlatformFee, setRPlatformFee] = useState('');
  const [rAdsFee, setRAdsFee] = useState('');
  const [rOtherFee, setROtherFee] = useState('');
  const [rOrders, setROrders] = useState('');
  const [rReturns, setRReturns] = useState('');
  const [rCurrency, setRCurrency] = useState('USD');
  const [rCustomCurrency, setRCustomCurrency] = useState('');
  const [rWithdraw, setRWithdraw] = useState('');
  const [rCny, setRCny] = useState('');
  const [rRate, setRRate] = useState('');
  const [rIncomeImgs, setRIncomeImgs] = useState<string[]>([]);
  const [rOrderImgs, setROrderImgs] = useState<string[]>([]);
  const [rWithdrawImgs, setRWithdrawImgs] = useState<string[]>([]);
  const [rNote, setRNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadShops(); }, []);
  useEffect(() => {
    if (tab === 'records') loadRecords();
    if (tab === 'summary') loadSummary();
  }, [tab, filterMonth, filterShop]);

  async function loadShops() {
    const res = await fetch('/api/ec-tax?view=shops');
    const data = await res.json();
    setShops(data.shops || []);
  }

  async function loadRecords() {
    setLoading(true);
    const params = new URLSearchParams({ view: 'records' });
    if (filterMonth) params.set('month', filterMonth);
    if (filterShop) params.set('shopId', filterShop);
    const res = await fetch('/api/ec-tax?' + params.toString());
    const data = await res.json();
    setRecords(data.records || []);
    setLoading(false);
  }

  async function loadSummary() {
    setLoading(true);
    const params = new URLSearchParams({ view: 'summary' });
    if (filterMonth) params.set('month', filterMonth);
    const res = await fetch('/api/ec-tax?' + params.toString());
    setSummary(await res.json());
    setLoading(false);
  }

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500); }
  const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

  function handleImgUpload(setter: (fn: (prev: string[]) => string[]) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files; if (!files) return;
      Array.from(files).forEach((file) => {
        if (file.size > 5 * 1024 * 1024) { setErr('图片不能超过5MB'); return; }
        const reader = new FileReader();
        reader.onload = () => setter((prev) => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    };
  }

  // 汇率自动计算
  useEffect(() => {
    const w = Number(rWithdraw);
    const c = Number(rCny);
    if (w > 0 && c > 0) setRRate((c / w).toFixed(4));
  }, [rWithdraw, rCny]);

  const netCalc = (Number(rGross) || 0) - (Number(rRefunds) || 0) - (Number(rPlatformFee) || 0) - (Number(rAdsFee) || 0) - (Number(rOtherFee) || 0);
  const actualCurrency = rCurrency === '其他' ? rCustomCurrency : rCurrency;

  async function addShop() {
    const platform = sPlatform === '其他' ? sCustomPlatform : sPlatform;
    const currency = sCurrency === '其他' ? sCustomCurrency : sCurrency;
    if (!platform || !sShopName) { setErr('平台和店铺名必填'); return; }
    const res = await fetch('/api/ec-tax', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addShop', platform, shopName: sShopName, currency }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    flash(data.message); setShowShopForm(false); setSShopName(''); loadShops();
  }

  async function deleteShop(shopId: string) {
    if (!confirm('确定删除该店铺？')) return;
    await fetch('/api/ec-tax', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deleteShop', shopId }) });
    loadShops(); flash('已删除');
  }

  async function submitRecord() {
    if (!rShopId) { setErr('请选择店铺'); return; }
    if (!rMonth) { setErr('请选择月份'); return; }
    setSubmitting(true); setErr('');
    try {
      const res = await fetch('/api/ec-tax', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveRecord', shopId: rShopId, yearMonth: rMonth,
          grossSales: rGross, refunds: rRefunds, platformFee: rPlatformFee,
          adsFee: rAdsFee, otherFee: rOtherFee,
          orderCount: rOrders, returnCount: rReturns,
          currency: actualCurrency, withdrawAmount: rWithdraw, cnyAmount: rCny, exchangeRate: rRate,
          incomeImages: rIncomeImgs, orderImages: rOrderImgs, withdrawImages: rWithdrawImgs, note: rNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash(data.message);
      setRGross(''); setRRefunds(''); setRPlatformFee(''); setRAdsFee(''); setROtherFee('');
      setROrders(''); setRReturns(''); setRWithdraw(''); setRCny(''); setRRate('');
      setRIncomeImgs([]); setROrderImgs([]); setRWithdrawImgs([]); setRNote('');
      setTab('records');
    } catch (e: any) { setErr(e.message); }
    finally { setSubmitting(false); }
  }

  async function deleteRecord(recordId: string) {
    if (!confirm('确定删除？')) return;
    await fetch('/api/ec-tax', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deleteRecord', recordId }) });
    loadRecords(); flash('已删除');
  }

  // 选店铺后自动设币种
  function selectShop(shopId: string) {
    setRShopId(shopId);
    const shop = shops.find((s) => s.id === shopId);
    if (shop) {
      if (PRESET_CURRENCIES.includes(shop.currency)) { setRCurrency(shop.currency); setRCustomCurrency(''); }
      else { setRCurrency('其他'); setRCustomCurrency(shop.currency); }
    }
  }

  function ImgSection({ label, images, setter }: { label: string; images: string[]; setter: (fn: (p: string[]) => string[]) => void }) {
    return (
      <div style={{ marginBottom: 12 }}>
        <label className="form-label">{label}</label>
        <input type="file" accept="image/*" multiple onChange={handleImgUpload(setter)} style={{ fontSize: 13, marginBottom: 6 }} />
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={img} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }} onClick={() => setPreviewImg(img)} />
                <button onClick={() => setter((p) => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, background: '#A32D2D', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      {msg && <div className="alert success">{msg}</div>}
      {previewImg && (
        <div onClick={() => setPreviewImg(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={previewImg} style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8 }} />
          <div style={{ position: 'absolute', top: 20, right: 20, color: '#fff', fontSize: 24, cursor: 'pointer' }}>✕</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
        {[{ key: 'records' as Tab, label: '月度数据' }, { key: 'add' as Tab, label: '+ 录入' }, { key: 'shops' as Tab, label: '店铺管理' }, { key: 'summary' as Tab, label: '汇总' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="badge" style={{ padding: '8px 14px', fontSize: 13, background: tab === t.key ? '#1D9E75' : '#f0f0f0', color: tab === t.key ? '#fff' : '#666' }}>{t.label}</button>
        ))}
      </div>

      {/* === 店铺管理 === */}
      {tab === 'shops' && (
        <>
          <button className="submit-btn" style={{ marginBottom: 14 }} onClick={() => { setShowShopForm(true); setErr(''); }}>+ 添加平台/店铺</button>
          {showShopForm && (
            <div className="card" style={{ border: '2px solid #1D9E75', marginBottom: 14 }}>
              <h3>添加店铺</h3>
              {err && <div className="alert error">{err}</div>}
              <label className="form-label">平台</label>
              <select className="form-select" value={sPlatform} onChange={(e) => setSPlatform(e.target.value)}>
                {PRESET_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="其他">其他（自定义）</option>
              </select>
              {sPlatform === '其他' && <input className="form-input" placeholder="输入平台名称" value={sCustomPlatform} onChange={(e) => setSCustomPlatform(e.target.value)} />}
              <label className="form-label">店铺名称</label>
              <input className="form-input" placeholder="如 美国站1号店" value={sShopName} onChange={(e) => setSShopName(e.target.value)} />
              <label className="form-label">默认币种</label>
              <select className="form-select" value={sCurrency} onChange={(e) => setSCurrency(e.target.value)}>
                {PRESET_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="其他">其他</option>
              </select>
              {sCurrency === '其他' && <input className="form-input" placeholder="输入币种代码" value={sCustomCurrency} onChange={(e) => setSCustomCurrency(e.target.value)} />}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="submit-btn" style={{ flex: 1 }} onClick={addShop}>确认添加</button>
                <button className="submit-btn red" style={{ width: 60 }} onClick={() => setShowShopForm(false)}>取消</button>
              </div>
            </div>
          )}
          {shops.length === 0 && <div className="empty-state">暂无店铺，点击上方添加</div>}
          {shops.map((s) => (
            <div key={s.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{s.platform} · {s.shopName}</div>
                <div style={{ fontSize: 12, color: '#888' }}>币种 {s.currency} · {s.recordCount} 条记录</div>
              </div>
              <button onClick={() => deleteShop(s.id)} style={{ fontSize: 12, color: '#A32D2D' }}>删除</button>
            </div>
          ))}
        </>
      )}

      {/* === 录入数据 === */}
      {tab === 'add' && (
        <div className="card" style={{ border: '2px solid #1D9E75' }}>
          <h3>录入月度数据</h3>
          {err && <div className="alert error">{err}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">店铺</label>
              <select className="form-select" value={rShopId} onChange={(e) => selectShop(e.target.value)}>
                <option value="">选择店铺</option>
                {shops.map((s) => <option key={s.id} value={s.id}>{s.platform} - {s.shopName}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">月份</label>
              <input className="form-input" type="month" value={rMonth} onChange={(e) => setRMonth(e.target.value)} />
            </div>
          </div>

          <div style={{ background: '#f0faf5', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #c3e6d5' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#085041', marginBottom: 8 }}>收入数据（{actualCurrency}）</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label className="form-label">总销售额</label><input className="form-input" type="number" step="0.01" value={rGross} onChange={(e) => setRGross(e.target.value)} placeholder="0.00" /></div>
              <div><label className="form-label">退款</label><input className="form-input" type="number" step="0.01" value={rRefunds} onChange={(e) => setRRefunds(e.target.value)} placeholder="0.00" /></div>
              <div><label className="form-label">平台费用</label><input className="form-input" type="number" step="0.01" value={rPlatformFee} onChange={(e) => setRPlatformFee(e.target.value)} placeholder="0.00" /></div>
              <div><label className="form-label">广告费</label><input className="form-input" type="number" step="0.01" value={rAdsFee} onChange={(e) => setRAdsFee(e.target.value)} placeholder="0.00" /></div>
              <div><label className="form-label">其他费用</label><input className="form-input" type="number" step="0.01" value={rOtherFee} onChange={(e) => setROtherFee(e.target.value)} placeholder="0.00" /></div>
              <div><label className="form-label">净收入</label><div style={{ padding: '10px 12px', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 16, color: netCalc >= 0 ? '#1D9E75' : '#A32D2D' }}>{fmt(netCalc)} {actualCurrency}</div></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div><label className="form-label">订单数</label><input className="form-input" type="number" value={rOrders} onChange={(e) => setROrders(e.target.value)} placeholder="0" /></div>
            <div><label className="form-label">退货数</label><input className="form-input" type="number" value={rReturns} onChange={(e) => setRReturns(e.target.value)} placeholder="0" /></div>
          </div>

          <div style={{ background: '#fef9f0', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #f0dbb8' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#854F0B', marginBottom: 8 }}>提款与汇率</p>
            <label className="form-label">币种</label>
            <select className="form-select" value={rCurrency} onChange={(e) => setRCurrency(e.target.value)}>
              {PRESET_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="其他">其他</option>
            </select>
            {rCurrency === '其他' && <input className="form-input" placeholder="输入币种代码" value={rCustomCurrency} onChange={(e) => setRCustomCurrency(e.target.value)} />}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><label className="form-label">提款外币</label><input className="form-input" type="number" step="0.01" value={rWithdraw} onChange={(e) => setRWithdraw(e.target.value)} placeholder="0.00" /></div>
              <div><label className="form-label">人民币到账</label><input className="form-input" type="number" step="0.01" value={rCny} onChange={(e) => setRCny(e.target.value)} placeholder="0.00" /></div>
              <div><label className="form-label">汇率</label><input className="form-input" type="number" step="0.0001" value={rRate} onChange={(e) => setRRate(e.target.value)} placeholder="自动计算" /></div>
            </div>
            {Number(rRate) > 0 && <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>1 {actualCurrency} = {rRate} CNY</p>}
          </div>

          <ImgSection label="收入数据截图" images={rIncomeImgs} setter={setRIncomeImgs} />
          <ImgSection label="订单数据截图" images={rOrderImgs} setter={setROrderImgs} />
          <ImgSection label="提款凭证截图" images={rWithdrawImgs} setter={setRWithdrawImgs} />

          <label className="form-label">备注</label>
          <input className="form-input" value={rNote} onChange={(e) => setRNote(e.target.value)} />

          <button className="submit-btn" onClick={submitRecord} disabled={submitting}>{submitting ? '提交中...' : '保存数据'}</button>
        </div>
      )}

      {/* === 月度数据列表 === */}
      {tab === 'records' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input type="month" className="form-input" style={{ flex: 1, marginBottom: 0 }} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
            <select className="form-select" style={{ flex: 1, marginBottom: 0 }} value={filterShop} onChange={(e) => setFilterShop(e.target.value)}>
              <option value="">全部店铺</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.platform} - {s.shopName}</option>)}
            </select>
          </div>
          {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>首次加载可能需要几秒...</p>}
          {!loading && records.length === 0 && <div className="empty-state">暂无数据，点击"+ 录入"添加</div>}
          {!loading && records.map((r) => (
            <div key={r.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{r.platform} · {r.shopName}</div>
                  <div style={{ fontSize: 13, color: '#1D9E75', fontWeight: 500 }}>{r.yearMonth}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#A32D2D' }}>¥{fmt(r.cnyAmount)}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>净收入 {fmt(r.netIncome)} {r.currency}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 12 }}>
                <span style={{ padding: '2px 6px', background: '#E6F1FB', borderRadius: 4 }}>销售 {fmt(r.grossSales)}</span>
                {r.refunds > 0 && <span style={{ padding: '2px 6px', background: '#FCEBEB', borderRadius: 4 }}>退款 {fmt(r.refunds)}</span>}
                <span style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: 4 }}>订单 {r.orderCount}</span>
                {r.exchangeRate > 0 && <span style={{ padding: '2px 6px', background: '#FAEEDA', borderRadius: 4 }}>汇率 {r.exchangeRate}</span>}
              </div>
              {/* 缩略图 */}
              {(r.incomeImages.length > 0 || r.orderImages.length > 0 || r.withdrawImages.length > 0) && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {[...r.incomeImages, ...r.orderImages, ...r.withdrawImages].map((img, i) => (
                    <img key={i} src={img} onClick={() => setPreviewImg(img)} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #eee', cursor: 'pointer' }} />
                  ))}
                </div>
              )}
              <div style={{ marginTop: 6, textAlign: 'right' }}>
                <button onClick={() => deleteRecord(r.id)} style={{ fontSize: 11, color: '#A32D2D' }}>删除</button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* === 汇总 === */}
      {tab === 'summary' && (
        <>
          <input type="month" className="form-input" style={{ marginBottom: 14 }} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
          {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>首次加载可能需要几秒...</p>}
          {!loading && summary && (
            <>
              <div className="card" style={{ background: '#f0faf5', border: '1px solid #c3e6d5' }}>
                <div style={{ fontSize: 13, color: '#888' }}>人民币总到账</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#1D9E75' }}>¥{fmt(summary.totalCny)}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{summary.recordCount} 条记录</div>
              </div>

              <div className="card">
                <h3>按平台</h3>
                {summary.byPlatform?.map((p: any) => (
                  <div key={p.platform} style={{ padding: '8px 0', borderBottom: '0.5px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{p.platform}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{p.shopCount} 店铺 · {p.orders} 单</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#1D9E75' }}>¥{fmt(p.cnyAmount)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {summary.byMonth?.length > 1 && (
                <div className="card">
                  <h3>按月度</h3>
                  {summary.byMonth.map((m: any) => (
                    <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f0f0f0', fontSize: 13 }}>
                      <span>{m.month} · {m.orders}单</span>
                      <span style={{ fontWeight: 600 }}>¥{fmt(m.netCny)}</span>
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
