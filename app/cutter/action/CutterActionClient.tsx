'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface StyleColor { id: string; colorCode: string; colorName: string; }
interface Style { id: string; code: string; name: string; season?: string; colors: StyleColor[]; }
interface BomItem {
  id: string; kind: string; itemId: string; itemName: string; itemCode: string;
  role?: string; qtyPerPiece: number; unit: string; unitPrice: number; cost: number; stock: number;
}
interface StyleDetail {
  id: string; code: string; name: string;
  colors: { id: string; colorCode: string; colorName: string; bomItems: BomItem[]; fabricCost: number; materialCost: number; totalCost: number; }[];
}

type Step = 'style' | 'color' | 'cut';

export function CutterActionClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('style');
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [styleDetail, setStyleDetail] = useState<StyleDetail | null>(null);
  const [selectedColorId, setSelectedColorId] = useState<string>('');
  const [pieceCount, setPieceCount] = useState<string>('');
  const [fabricInputs, setFabricInputs] = useState<Record<string, { layerLength: string; layerCount: string; unit: string }>>({});
  const [note, setNote] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadStyles(); }, []);

  async function loadStyles(q?: string) {
    setLoading(true);
    const url = q ? `/api/styles?q=${encodeURIComponent(q)}` : '/api/styles';
    const res = await fetch(url);
    const data = await res.json();
    setStyles(data.styles || []);
    setLoading(false);
  }

  function pickStyle(s: Style) {
    setSelectedStyle(s);
    if (s.colors.length === 0) {
      setError('这个款式还没有设置颜色，请联系厂长');
      return;
    }
    if (s.colors.length === 1) {
      pickColor(s.id, s.colors[0].id);
    } else {
      setStep('color');
    }
  }

  async function pickColor(styleId: string, colorId: string) {
    setSelectedColorId(colorId);
    setLoading(true);
    const res = await fetch('/api/styles/' + styleId);
    const data = await res.json();
    setStyleDetail(data.style);
    const color = data.style.colors.find((c: any) => c.id === colorId);
    const inputs: Record<string, any> = {};
    if (color) {
      for (const b of color.bomItems) {
        if (b.kind === 'FABRIC') {
          inputs[b.itemId] = { layerLength: '', layerCount: '1', unit: '米' };
        }
      }
    }
    setFabricInputs(inputs);
    setStep('cut');
    setLoading(false);
  }

  function goBack() {
    setError('');
    if (step === 'cut') {
      if (selectedStyle && selectedStyle.colors.length > 1) setStep('color');
      else setStep('style');
    } else if (step === 'color') {
      setStep('style');
      setSelectedStyle(null);
    }
  }

  function updateFabricInput(fabricId: string, key: string, value: string) {
    setFabricInputs((prev) => ({
      ...prev,
      [fabricId]: { ...(prev[fabricId] || { layerLength: '', layerCount: '1', unit: '米' }), [key]: value },
    }));
  }

  async function submit() {
    if (!styleDetail || !selectedColorId) return;
    const pc = Number(pieceCount);
    if (!pc || pc <= 0) { setError('请输入裁件数'); return; }

    const color = styleDetail.colors.find((c) => c.id === selectedColorId);
    if (!color) return;

    const items: any[] = [];
    for (const b of color.bomItems) {
      if (b.kind !== 'FABRIC') continue;
      const input = fabricInputs[b.itemId];
      if (!input || !input.layerLength || !input.layerCount) continue;
      const lenN = Number(input.layerLength);
      const layerN = Number(input.layerCount);
      if (lenN <= 0 || layerN <= 0) continue;
      items.push({
        fabricId: b.itemId,
        role: b.role,
        layerLength: lenN,
        layerCount: layerN,
        unit: input.unit,
      });
    }

    if (items.length === 0) {
      setError('请至少录入一种布料的用量');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/cuttings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleId: styleDetail.id,
          styleColorId: selectedColorId,
          pieceCount: pc,
          items,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      setSuccess(data.message);
      if (navigator.vibrate) navigator.vibrate(100);
      setTimeout(() => router.push('/cutter'), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="page">
        <div className="alert success" style={{ padding: 20, fontSize: 16, textAlign: 'center' }}>✓ {success}</div>
      </div>
    );
  }

  if (step === 'style') {
    return (
      <div className="page">
        <input
          type="text"
          className="search-bar"
          placeholder="搜索款号或款名..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onBlur={() => loadStyles(keyword)}
          onKeyDown={(e) => e.key === 'Enter' && loadStyles(keyword)}
        />
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>选择要裁的款式</p>
        {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
        {!loading && styles.length === 0 && <div className="empty-state">没有款式<br/><small>请联系厂长先建立款式</small></div>}
        {!loading && styles.map((s) => (
          <div key={s.id} className="material-item" onClick={() => pickStyle(s)}>
            <div style={{ flex: 1 }}>
              <div className="name">{s.code} · {s.name}</div>
              <div className="meta">
                {s.season && <>{s.season} · </>}
                {s.colors.length} 个颜色 · 已裁 {s.cuttingCount} 批
              </div>
            </div>
            <span className="arrow">→</span>
          </div>
        ))}
      </div>
    );
  }

  if (step === 'color') {
    const s = selectedStyle!;
    return (
      <div className="page">
        <button onClick={goBack} style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>← 返回</button>
        <div className="card">
          <h3>{s.code} · {s.name}</h3>
        </div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>选择颜色</p>
        {s.colors.map((c) => (
          <div key={c.id} className="material-item" onClick={() => pickColor(s.id, c.id)}>
            <div style={{ flex: 1 }}>
              <div className="name">{c.colorName}</div>
              <div className="meta">{c.colorCode}</div>
            </div>
            <span className="arrow">→</span>
          </div>
        ))}
      </div>
    );
  }

  const color = styleDetail?.colors.find((c) => c.id === selectedColorId);
  if (!color) return <div className="page">加载中...</div>;
  const fabrics = color.bomItems.filter((b) => b.kind === 'FABRIC');
  const pc = Number(pieceCount) || 0;

  let estimatedCost = 0;
  for (const b of fabrics) {
    const input = fabricInputs[b.itemId];
    if (!input || !input.layerLength || !input.layerCount) continue;
    const lenN = Number(input.layerLength);
    const layerN = Number(input.layerCount);
    const lenM = input.unit === '码' ? lenN * 0.9144 : lenN;
    estimatedCost += lenM * layerN * b.unitPrice;
  }

  return (
    <div className="page">
      <button onClick={goBack} style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>← 返回</button>

      <div className="card">
        <h3>{styleDetail!.code} · {styleDetail!.name}</h3>
        <p style={{ fontSize: 13, color: '#666' }}>
          颜色 <strong>{color.colorName}</strong> · 标准成本 ¥{color.fabricCost}/件（布料）
        </p>
      </div>

      <label className="form-label">本批裁多少件？</label>
      <div className="qty-row">
        <button className="qty-btn" onClick={() => setPieceCount(String(Math.max(0, Number(pieceCount) - 10)))}>−10</button>
        <input
          type="number"
          inputMode="numeric"
          className="qty-input"
          value={pieceCount}
          onChange={(e) => setPieceCount(e.target.value)}
          placeholder="件数"
          min="0"
        />
        <button className="qty-btn" onClick={() => setPieceCount(String((Number(pieceCount) || 0) + 10))}>+10</button>
      </div>

      <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 15 }}>布料用量（本批）</h3>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        录入"每层长度"和"铺几层"，系统自动算总用料
      </p>

      {fabrics.map((b) => {
        const input = fabricInputs[b.itemId] || { layerLength: '', layerCount: '1', unit: '米' };
        const lenN = Number(input.layerLength) || 0;
        const layerN = Number(input.layerCount) || 0;
        const lenM = input.unit === '码' ? lenN * 0.9144 : lenN;
        const total = lenM * layerN;
        const stdForBatch = pc * b.qtyPerPiece;
        const overUse = pc > 0 && total > stdForBatch * 1.15;

        return (
          <div key={b.itemId} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 500 }}>{b.role || '布料'} · {b.itemName}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  标准 {b.qtyPerPiece} {b.unit}/件 · 库存 {b.stock.toFixed(1)} 米 · ¥{b.unitPrice}/米
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 2 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>每层长度</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="form-input"
                  style={{ marginBottom: 0 }}
                  value={input.layerLength}
                  onChange={(e) => updateFabricInput(b.itemId, 'layerLength', e.target.value)}
                  placeholder="0"
                  step="0.01"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>单位</label>
                <select
                  className="form-select"
                  style={{ marginBottom: 0 }}
                  value={input.unit}
                  onChange={(e) => updateFabricInput(b.itemId, 'unit', e.target.value)}
                >
                  <option value="米">米</option>
                  <option value="码">码</option>
                </select>
              </div>
              <div style={{ flex: 1.2 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>铺层</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="form-input"
                  style={{ marginBottom: 0 }}
                  value={input.layerCount}
                  onChange={(e) => updateFabricInput(b.itemId, 'layerCount', e.target.value)}
                  placeholder="1"
                  min="1"
                />
              </div>
            </div>

            {total > 0 && (
              <div style={{ fontSize: 12, padding: 8, background: overUse ? '#FCEBEB' : '#F1EFE8', borderRadius: 6, color: overUse ? '#A32D2D' : '#555' }}>
                共用 {total.toFixed(2)} 米 · 成本 ¥{(total * b.unitPrice).toFixed(2)}
                {pc > 0 && <> · 标准 {stdForBatch.toFixed(2)} 米{overUse && '（超耗⚠）'}</>}
              </div>
            )}
          </div>
        );
      })}

      <label className="form-label">备注（选填）</label>
      <input
        type="text"
        className="form-input"
        placeholder="如：A版 · 裁耗较高"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {pc > 0 && estimatedCost > 0 && (
        <div className="card" style={{ background: '#E1F5EE' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ color: '#085041', fontWeight: 500 }}>预计本批布料成本</div>
            <div style={{ color: '#0F6E56', fontWeight: 600, fontSize: 18 }}>¥ {estimatedCost.toFixed(2)}</div>
          </div>
          <div style={{ fontSize: 12, color: '#085041', marginTop: 4 }}>
            折合每件 ¥ {(estimatedCost / pc).toFixed(2)}（标准 ¥{color.fabricCost}）
          </div>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      <button className="submit-btn" onClick={submit} disabled={submitting || !pc}>
        {submitting ? '提交中...' : '确认裁片'}
      </button>
    </div>
  );
}
