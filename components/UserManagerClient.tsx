'use client';

import { useEffect, useState } from 'react';

interface User { id: string; username: string; name: string; role: string; }
const ROLE_LABELS: Record<string, string> = { BOSS: '老板', MANAGER: '厂长', FINANCE: '财务', PURCHASER: '采购', WORKER: '车间师傅', CUTTER: '裁床师傅', PACKER: '打包师傅', WAREHOUSE: '仓库' };

export function UserManagerClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

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
    const data = await res.json();
    if (res.ok) {
      setEditing(null); load();
      setMsg(data.message || '已保存'); setTimeout(() => setMsg(''), 2000);
    } else {
      setErr(data.error); setTimeout(() => setErr(''), 3000);
    }
  }

  async function resetPassword(id: string) {
    if (!resetPwd.trim()) { setErr('请输入新密码'); return; }
    if (resetPwd.length < 6) { setErr('密码至少6位'); return; }
    if (!confirm(`确定把此员工的密码重置为「${resetPwd}」？重置后员工需重新登录。`)) return;
    const res = await fetch('/api/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, newPassword: resetPwd }),
    });
    const data = await res.json();
    if (res.ok) {
      setResettingId(null); setResetPwd('');
      setMsg(data.message || '密码已重置'); setTimeout(() => setMsg(''), 2500);
    } else {
      setErr(data.error); setTimeout(() => setErr(''), 3000);
    }
  }

  return (
    <div className="page">
      <h2>员工管理</h2>
      {msg && <div className="alert success">{msg}</div>}
      {err && <div className="alert error">{err}</div>}
      {users.map((u) => (
        <div key={u.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setEditing(u.id); setEditName(u.name); }} style={{ fontSize: 12, color: '#185FA5', padding: '5px 10px', background: '#E6F1FB', borderRadius: 6 }}>改名</button>
                <button onClick={() => { setResettingId(u.id); setResetPwd(''); }} style={{ fontSize: 12, color: '#A36B00', padding: '5px 10px', background: '#FAEEDA', borderRadius: 6 }}>重置密码</button>
              </div>
            )}
          </div>
          {resettingId === u.id && (
            <div style={{ marginTop: 10, padding: 10, background: '#FAEEDA', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#854F0B', marginBottom: 6 }}>为「{u.name}」设新密码（至少6位）</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" className="form-input" style={{ flex: 1, marginBottom: 0 }} value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} placeholder="新密码" autoFocus />
                <button onClick={() => resetPassword(u.id)} style={{ fontSize: 13, color: '#fff', padding: '6px 12px', background: '#A36B00', borderRadius: 6 }}>确认</button>
                <button onClick={() => { setResettingId(null); setResetPwd(''); }} style={{ fontSize: 13, color: '#666', padding: '6px 12px', background: '#f0f0f0', borderRadius: 6 }}>取消</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
