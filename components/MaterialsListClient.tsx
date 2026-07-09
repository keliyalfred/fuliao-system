'use client';

import { useEffect, useState } from 'react';

interface Material {
  id: string; code: string; name: string; category: string;
  unit: string; unitPrice: number; stock: number; stockDefect: number; stockWaste: number;
  minStock: number; location?: string; supplier?: string; stockStatus: string;
}

export function MaterialsListClient({ showPrice = false }: { showPrice?: boolean }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  useEffect(() => { load(); }, []);

  async function load(q?: string) {
    setLoading(true);
    const url = q ? `/api/materials?q=${encodeURIComponent(q)}` : '/api/materials';
    const res = await fetch(url);
    const data = await res.json();
    setMaterials(data.materials || []);
    setLoading(false);
  }

  const totalValue = materials.reduce((sum, m) => sum + m.stock * m.unitPrice, 0);

  return (
    <div className="page">
      <input
        type="text" className="search-bar"
        placeholder="搜索辅料名称/编码/颜色..."
        value={keyword}
        onChange={(e) => { setKeyword(e.target.value); }}
        onKeyDown={(e) => e.key === 'Enter' && load(keyword)}
        onBlur={() => load(keyword)}
      />

      {showPrice && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 12, color: '#888' }}>良品总值</p>
              <p style={{ fontSize: 22, fontWeight: 600 }}>¥ {totalValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: '#888' }}>品种数</p>
              <p style={{ fontSize: 22, fontWeight: 600 }}>{materials.length}</p>
            </div>
          </div>
        </div>
      )}

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
      {!loading && materials.length === 0 && <div className="empty-state">没有找到辅料</div>}

      {!loading && materials.map((m) => {
        let cls = 'material-item';
        let tag = '充足';
        if (m.stockStatus === 'out') { cls += ' danger'; tag = '缺货'; }
        else if (m.stockStatus === 'danger') { cls += ' danger'; tag = '紧张'; }
        else if (m.stockStatus === 'warn') { cls += ' warn'; tag = '偏低'; }

        return (
          <div key={m.id} className={cls} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div>
              <div className="name">{m.name}</div>
              <div className="meta">
                [{m.category}] {m.code}
                {m.location && <> · {m.location}</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 13 }}>
              <span style={{ color: '#1D9E75' }}>良品 <strong>{m.stock}</strong></span>
              {m.stockDefect > 0 && <span style={{ color: '#BA7517' }}>次品 <strong>{m.stockDefect}</strong></span>}
              {m.stockWaste > 0 && <span style={{ color: '#A32D2D' }}>废品 <strong>{m.stockWaste}</strong></span>}
              <span style={{ color: '#888' }}>{m.unit} / 最低 {m.minStock}</span>
            </div>
            <div className="meta" style={{ marginTop: 4 }}>
              {tag}
              {showPrice && <> · 单价 ¥{m.unitPrice} · 良品价值 ¥{(m.stock * m.unitPrice).toFixed(2)}</>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
