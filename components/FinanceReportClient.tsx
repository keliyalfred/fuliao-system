'use client';

import { useEffect, useState } from 'react';

type View = 'style' | 'bed' | 'monthly';

export function FinanceReportClient() {
  const [view, setView] = useState<View>('style');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [view]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/reports?view=${view}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }

  const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  const fmt2 = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

  return (
    <div className="page">
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { key: 'style' as View, label: '按款号' },
          { key: 'bed' as View, label: '按批次' },
          { key: 'monthly' as View, label: '按月度' },
        ].map((t) => (
          <button key={t.key} onClick={() => setView(t.key)} className="badge"
            style={{ padding: '8px 16px', fontSize: 14, background: view === t.key ? '#1D9E75' : '#f0f0f0', color: view === t.key ? '#fff' : '#666' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}

      {/* === 按款号 === */}
      {!loading && view === 'style' && data?.report && (
        <>
          {/* Grand total */}
          {data.grandTotal && (
            <div className="card" style={{ background: '#f0faf5', border: '1px solid #c3e6d5' }}>
              <h3 style={{ color: '#085041' }}>总计</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 13 }}>
                <div><span style={{ color: '#888' }}>总件数</span><div style={{ fontWeight: 600, fontSize: 16 }}>{fmt(data.grandTotal.totalPieces)}</div></div>
                <div><span style={{ color: '#888' }}>总成本</span><div style={{ fontWeight: 600, fontSize: 16, color: '#A32D2D' }}>¥{fmt(data.grandTotal.totalCost)}</div></div>
                <div><span style={{ color: '#888' }}>布料</span><div style={{ fontWeight: 600 }}>¥{fmt(data.grandTotal.fabricCost)}</div></div>
                <div><span style={{ color: '#888' }}>辅料</span><div style={{ fontWeight: 600 }}>¥{fmt(data.grandTotal.materialCost)}</div></div>
                <div><span style={{ color: '#888' }}>工价</span><div style={{ fontWeight: 600 }}>¥{fmt(data.grandTotal.laborCost)}</div></div>
                <div><span style={{ color: '#888' }}>包装+运费</span><div style={{ fontWeight: 600 }}>¥{fmt(data.grandTotal.packCost + data.grandTotal.shipCost)}</div></div>
              </div>
            </div>
          )}

          {data.report.length === 0 && <div className="empty-state">暂无裁片数据</div>}

          {data.report.map((s: any) => (
            <div key={s.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{s.code} · {s.name}</h3>
                  <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{s.totalPieces} 件 · {s.bedCount} 床</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>¥{fmt2(s.unitCost)}<span style={{ fontSize: 12, fontWeight: 400 }}>/件</span></div>
                  {s.targetPrice > 0 && (
                    <div style={{ fontSize: 12, color: s.profitRate > 0 ? '#1D9E75' : '#A32D2D' }}>
                      毛利 {s.profitRate.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 13 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px 0', color: '#888' }}>布料成本</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>¥{fmt(s.fabricCost)}</td>
                      <td style={{ textAlign: 'right', color: '#888', width: 80 }}>¥{fmt2(s.fabricCost / s.totalPieces)}/件</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px 0', color: '#888' }}>辅料成本</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>¥{fmt(s.materialCost)}</td>
                      <td style={{ textAlign: 'right', color: '#888' }}>¥{fmt2(s.materialCost / s.totalPieces)}/件</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px 0', color: '#888' }}>工价</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>¥{fmt(s.laborCost)}</td>
                      <td style={{ textAlign: 'right', color: '#888' }}>¥{s.laborCostPerPiece}/件</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px 0', color: '#888' }}>包装费</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>¥{fmt(s.packCost)}</td>
                      <td style={{ textAlign: 'right', color: '#888' }}>¥{s.packCostPerPiece}/件</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px 0', color: '#888' }}>运费</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>¥{fmt(s.shipCost)}</td>
                      <td style={{ textAlign: 'right', color: '#888' }}>¥{s.shipCostPerPiece}/件</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px 0', color: '#BA7517' }}>次品废品分摊</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: '#BA7517' }}>¥{fmt(s.defectWasteCost)}</td>
                      <td style={{ textAlign: 'right', color: '#888' }}>¥{fmt2(s.defectWasteCost / s.totalPieces)}/件</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 0', fontWeight: 600 }}>总成本</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#A32D2D', fontSize: 15 }}>¥{fmt(s.totalCost)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>¥{fmt2(s.unitCost)}/件</td>
                    </tr>
                  </tbody>
                </table>

                {s.targetPrice > 0 && (
                  <div style={{ marginTop: 8, padding: 8, background: s.profit > 0 ? '#f0faf5' : '#fcebeb', borderRadius: 6, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                    <span>售价 ¥{s.targetPrice} - 成本 ¥{fmt2(s.unitCost)}</span>
                    <span style={{ fontWeight: 600, color: s.profit > 0 ? '#1D9E75' : '#A32D2D' }}>
                      毛利 ¥{fmt2(s.profit)} ({s.profitRate.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* === 按批次 === */}
      {!loading && view === 'bed' && data?.beds && (
        <>
          {data.beds.length === 0 && <div className="empty-state">暂无裁床数据</div>}
          {data.beds.map((b: any) => (
            <div key={b.bedNo} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    <span className="badge green" style={{ marginRight: 4 }}>{b.bedNo}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{b.styleCode} {b.styleName} · {b.colorName} · {b.totalPieces}件</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{new Date(b.createdAt).toLocaleDateString('zh-CN')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1D9E75' }}>¥{fmt2(b.unitCost)}/件</div>
                  <div style={{ fontSize: 12, color: '#888' }}>总 ¥{fmt(b.totalCost)}</div>
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                <span style={{ padding: '2px 6px', background: '#E6F1FB', borderRadius: 4 }}>布 ¥{fmt(b.fabricCost)}</span>
                <span style={{ padding: '2px 6px', background: '#E1F5EE', borderRadius: 4 }}>辅 ¥{fmt(b.materialCost)}</span>
                <span style={{ padding: '2px 6px', background: '#FBEAF0', borderRadius: 4 }}>工 ¥{fmt(b.laborCost)}</span>
                <span style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: 4 }}>包 ¥{fmt(b.packCost)}</span>
                <span style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: 4 }}>运 ¥{fmt(b.shipCost)}</span>
                {b.defectWasteCost > 0 && <span style={{ padding: '2px 6px', background: '#FAEEDA', borderRadius: 4 }}>损 ¥{fmt(b.defectWasteCost)}</span>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* === 按月度 === */}
      {!loading && view === 'monthly' && data?.months && (
        <>
          {data.months.length === 0 && <div className="empty-state">暂无数据</div>}
          {data.months.map((m: any) => (
            <div key={m.month} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{m.month}</h3>
                  <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{m.styleCount} 款 · {m.bedCount} 床 · {m.totalPieces} 件</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#A32D2D' }}>¥{fmt(m.totalCost)}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>平均 ¥{fmt2(m.totalPieces > 0 ? m.totalCost / m.totalPieces : 0)}/件</div>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 13 }}>
                <div><span style={{ color: '#888' }}>布料</span><div style={{ fontWeight: 500 }}>¥{fmt(m.fabricCost)}</div></div>
                <div><span style={{ color: '#888' }}>辅料</span><div style={{ fontWeight: 500 }}>¥{fmt(m.materialCost)}</div></div>
                <div><span style={{ color: '#888' }}>工价</span><div style={{ fontWeight: 500 }}>¥{fmt(m.laborCost)}</div></div>
                <div><span style={{ color: '#888' }}>包装</span><div style={{ fontWeight: 500 }}>¥{fmt(m.packCost)}</div></div>
                <div><span style={{ color: '#888' }}>运费</span><div style={{ fontWeight: 500 }}>¥{fmt(m.shipCost)}</div></div>
                <div><span style={{ color: '#BA7517' }}>损耗分摊</span><div style={{ fontWeight: 500, color: '#BA7517' }}>¥{fmt(m.defectWasteCost)}</div></div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
