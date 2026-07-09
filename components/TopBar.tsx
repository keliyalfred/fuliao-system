'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function TopBar({ title, userName, roleLabel, showBack = true }: {
  title: string; userName: string; roleLabel: string; showBack?: boolean;
}) {
  const router = useRouter();
  const [showPwd, setShowPwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  async function submitChangePwd() {
    setPwdErr(''); setPwdMsg('');
    if (!oldPwd || !newPwd) { setPwdErr('请填写旧密码和新密码'); return; }
    if (newPwd.length < 6) { setPwdErr('新密码至少6位'); return; }
    if (newPwd !== confirmPwd) { setPwdErr('两次输入的新密码不一致'); return; }
    const res = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    });
    const data = await res.json();
    if (!res.ok) { setPwdErr(data.error); return; }
    setPwdMsg(data.message + '，即将退出登录');
    setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    setTimeout(() => { window.location.href = '/api/auth/logout'; }, 1500);
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {showBack && (
            <button onClick={() => router.back()} style={{ fontSize: 18, color: '#666', padding: '0 4px' }}>
              ←
            </button>
          )}
          <h1>{title}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="user-chip">{roleLabel} · {userName}</span>
          <button onClick={() => setShowPwd(true)} style={{ fontSize: 12, color: '#185FA5' }}>改密码</button>
          <a href="/api/auth/logout" style={{ fontSize: 13, color: '#A32D2D' }}>退出</a>
        </div>
      </div>
      {showPwd && (
        <div onClick={() => setShowPwd(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 320 }}>
            <h3 style={{ marginBottom: 12 }}>改密码</h3>
            {pwdErr && <div className="alert error" style={{ marginBottom: 10 }}>{pwdErr}</div>}
            {pwdMsg && <div className="alert success" style={{ marginBottom: 10 }}>{pwdMsg}</div>}
            <label className="form-label">旧密码</label>
            <input type="password" className="form-input" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            <label className="form-label">新密码（至少6位）</label>
            <input type="password" className="form-input" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <label className="form-label">确认新密码</label>
            <input type="password" className="form-input" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={submitChangePwd} className="submit-btn" style={{ flex: 1 }}>确认修改</button>
              <button onClick={() => { setShowPwd(false); setPwdErr(''); setPwdMsg(''); }} className="submit-btn red" style={{ width: 80 }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
