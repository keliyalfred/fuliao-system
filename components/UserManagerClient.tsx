'use client';

import { useEffect, useState } from 'react';

interface User { id: string; username: string; name: string; role: string; }
const ROLE_LABELS: Record<string, string> = { BOSS: '老板', MANAGER: '厂长', FINANCE: '财务', PURCHASER: '采购', WORKER: '车间师傅', CUTTER: '裁床师傅' };

export function UserManagerClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data.users || []);
  }

  async function save(id: string) {
    if (!editName.trim()) return;
    const res = await fetch('/api/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName }),
    });
    if (res.ok) {
      setEditing(null); load();
      setMsg('已保存'); setTimeout(() => setMsg(''), 2000);
    }
  }

  return (
    <div className="page">
      <h2>员工管理</h2>
      {msg && <div className="alert success">{msg}</div>}
      {users.map((u) => (
        <div key={u.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#888' }}>{ROLE_LABELS[u.role] || u.role} · {u.username}</div>
            {editing === u.id ? (
              <input className="form-input" style={{ marginTop: 6, marginBottom: 0 }} value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save(u.id)}
                autoFocus />
            ) : (
              <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>{u.name}</div>
            )}
          </div>
          {editing === u.id ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => save(u.id)} style={{ fontSize: 13, color: '#1D9E75', padding: '6px 12px', background: '#E1F5EE', borderRadius: 6 }}>保存</button>
              <button onClick={() => setEditing(null)} style={{ fontSize: 13, color: '#666', padding: '6px 12px', background: '#f0f0f0', borderRadius: 6 }}>取消</button>
            </div>
          ) : (
            <button onClick={() => { setEditing(u.id); setEditName(u.name); }} style={{ fontSize: 13, color: '#185FA5', padding: '6px 12px', background: '#E6F1FB', borderRadius: 6 }}>改名</button>
          )}
        </div>
      ))}
    </div>
  );
}
