'use client';

import { useEffect, useState } from 'react';

interface Order {
  id: string;
  materialId: string; materialCode: string; materialName: string; unit: string;
  variantName: string | null;
  quantity: number; receivedQty: number; remaining: number;
  purchaseDate: string;
  expectedDate: string | null;
  note: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
}

const CAN_EDIT = ['BOSS', 'MANAGER', 'FINANCE', 'PURCHASER'];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function daysUntil(iso: string | null) {
  if (!iso) return null;
  const target = new Date(iso); target.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function PurchasesPanelClient({ role }: { role: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [groupByMaterial, setGroupByMaterial] = useState(false);
  const [sortMode, setSortMode] = useState<'expected' | 'newest'>('expected');

  const canEdit = CAN_EDIT.includes(role);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/purchases');
      const data = await res.json();
      if (!res.ok) { setErr(data.error || '加载失败'); setOrders([]); }
      else setOrders(data.orders || []);
    } catch (e: any) {
      setErr('加载失败：' + (e?.message || '网络错误'));
    } finally { setLoading(false); }
  }

  async function cancel(id: string) {
    if (!confirm('确定取消这条采购记录？')) return;
    const res = await fetch('/api/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', id }),
    });
    const data = await res.json();
    if (res.ok) { setMsg(data.message); setTimeout(() => setMsg(''), 2000); load(); }
    else setErr(data.error || '取消失败');
  }

  const sorted = [...orders].sort((a, b) => {
    if (sortMode === 'expected') {
      const ad = a.expectedDate ? new Date(a.expectedDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.expectedDate ? new Date(b.expectedDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    }
    return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
  });

  const totalQty = orders.reduce((s, o) => s + o.remaining, 0);

  return (
    <div className="page">
      {msg && <div className="alert success">{msg}</div>}
      {err && <div className="alert error">{err}</div>}

      <div className="card" style={{ background: '#FFF8EC', border: '1px solid #F0D9A6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 13, color: '#854F0B', marginBottom: 4 }}>🚚 在途采购</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#854F0B' }}>{orders.length} 笔</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 13, color: '#854F0B', marginBottom: 4 }}>待到货总量</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#854F0B' }}>{totalQty.toFixed(1)}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setSortMode('expected')} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #185FA5', background: sortMode === 'expected' ? '#185FA5' : '#fff', color: sortMode === 'expected' ? '#fff' : '#185FA5' }}>按到货日期</button>
        <button onClick={() => setSortMode('newest')} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #185FA5', background: sortMode === 'newest' ? '#185FA5' : '#fff', color: sortMode === 'newest' ? '#fff' : '#185FA5' }}>按下单时间</button>
        <button onClick={() => setGroupByMaterial(!groupByMaterial)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #185FA5', background: groupByMaterial ? '#185FA5' : '#fff', color: groupByMaterial ? '#fff' : '#185FA5' }}>按辅料分组</button>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载中...</p>}
      {!loading && orders.length === 0 && <div className="empty-state">暂无在途采购</div>}

      {!loading && (() => {
        if (groupByMaterial) {
          const byMat: Record<string, { name: string; code: string; unit: string; items: Order[]; total: number }> = {};
          for (const o of sorted) {
            const key = o.materialId;
            if (!byMat[key]) byMat[key] = { name: o.materialName, code: o.materialCode, unit: o.unit, items: [], total: 0 };
            byMat[key].items.push(o);
            byMat[key].total += o.remaining;
          }
          return Object.entries(byMat).map(([mid, g]) => (
            <div key={mid} className="card" style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{g.code}</div>
                </div>
                <div style={{ fontSize: 13, color: '#854F0B', fontWeight: 600 }}>共 {g.total.toFixed(1)} {g.unit}</div>
              </div>
              {g.items.map((o) => (
                <OrderRow key={o.id} o={o} canEdit={canEdit} onCancel={cancel} />
              ))}
            </div>
          ));
        }
        return sorted.map((o) => (
          <div key={o.id} className="card" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{o.materialName}{o.variantName ? ` · ${o.variantName}` : ''}</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{o.materialCode}</div>
            <OrderRow o={o} canEdit={canEdit} onCancel={cancel} />
          </div>
        ));
      })()}
    </div>
  );
}

function OrderRow({ o, canEdit, onCancel }: { o: Order; canEdit: boolean; onCancel: (id: string) => void }) {
  const dLeft = daysUntil(o.expectedDate);
  let dueColor = '#854F0B';
  let dueText = '';
  if (dLeft !== null) {
    if (dLeft < 0) { dueColor = '#A32D2D'; dueText = `已超期 ${-dLeft} 天`; }
    else if (dLeft === 0) { dueColor = '#A32D2D'; dueText = '今天到货'; }
    else if (dLeft <= 3) { dueColor = '#BA7517'; dueText = `${dLeft} 天后到货`; }
    else { dueText = `${dLeft} 天后到货`; }
  }
  return (
    <div style={{ background: '#FAEEDA', padding: '8px 10px', borderRadius: 6, marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, fontSize: 13, color: '#854F0B' }}>
          {o.variantName && <div style={{ fontWeight: 500 }}>{o.variantName}</div>}
          <div>已采购 <strong>{o.remaining}</strong> {o.receivedQty > 0 ? ` / ${o.quantity}` : ''}（{fmtDate(o.purchaseDate)} 下单）</div>
          {o.expectedDate && <div style={{ color: dueColor, fontWeight: 500, marginTop: 2 }}>预计 {fmtDate(o.expectedDate)} 到货{dueText ? ` · ${dueText}` : ''}</div>}
          {o.note && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>备注：{o.note}</div>}
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>录入：{o.createdBy}</div>
        </div>
        {canEdit && (
          <button onClick={() => onCancel(o.id)} style={{ fontSize: 11, color: '#A32D2D' }}>取消</button>
        )}
      </div>
    </div>
  );
}
