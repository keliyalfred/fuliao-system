'use client';

import { useRouter } from 'next/navigation';

export function TopBar({ title, userName, roleLabel, showBack = true }: {
  title: string; userName: string; roleLabel: string; showBack?: boolean;
}) {
  const router = useRouter();

  return (
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
        <a href="/api/auth/logout" style={{ fontSize: 13, color: '#A32D2D' }}>退出</a>
      </div>
    </div>
  );
}
