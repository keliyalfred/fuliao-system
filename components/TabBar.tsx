'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab { href: string; label: string; icon: string; }

const TABS: Record<string, Tab[]> = {
  BOSS: [
    { href: '/boss', label: '看板', icon: '◉' },
    { href: '/boss/materials', label: '辅料', icon: '▦' },
    { href: '/boss/fabrics', label: '布料', icon: '▤' },
    { href: '/boss/styles', label: '裁片', icon: '✂' },
    { href: '/boss/labor', label: '工价', icon: '¥' },
    { href: '/boss/users', label: '员工', icon: '⊙' },
  ],
  MANAGER: [
    { href: '/manager', label: '首页', icon: '⌂' },
    { href: '/manager/materials', label: '辅料', icon: '▦' },
    { href: '/manager/fabrics', label: '布料', icon: '▤' },
    { href: '/manager/styles', label: '裁片', icon: '✂' },
    { href: '/manager/records', label: '流水', icon: '☰' },
  ],
  FINANCE: [
    { href: '/finance', label: '首页', icon: '⌂' },
    { href: '/finance/expenses', label: '凭证', icon: '◉' },
    { href: '/finance/ec-tax', label: '报税', icon: '▧' },
    { href: '/finance/reports', label: '报表', icon: '▤' },
    { href: '/finance/materials', label: '辅料', icon: '▦' },
  ],
  PURCHASER: [
    { href: '/purchaser', label: '首页', icon: '⌂' },
    { href: '/purchaser/materials', label: '辅料', icon: '▦' },
    { href: '/purchaser/fabrics', label: '布料', icon: '▤' },
    { href: '/purchaser/purchases', label: '采购', icon: '▤' },
  ],
  WORKER: [
    { href: '/worker', label: '操作', icon: '⊕' },
    { href: '/worker/styles', label: '裁片', icon: '✂' },
    { href: '/worker/demands', label: '待领', icon: '⊘' },
    { href: '/worker/materials', label: '辅料', icon: '▦' },
    { href: '/worker/records', label: '记录', icon: '☰' },
  ],
  CUTTER: [
    { href: '/cutter', label: '裁片', icon: '✂' },
    { href: '/cutter/fabrics', label: '布料', icon: '▤' },
    { href: '/cutter/materials', label: '辅料', icon: '▦' },
    { href: '/cutter/records', label: '记录', icon: '☰' },
  ],
  PACKER: [
    { href: '/packer', label: '待领', icon: '⊘' },
    { href: '/packer/materials', label: '辅料', icon: '▦' },
    { href: '/packer/records', label: '记录', icon: '☰' },
  ],
  WAREHOUSE: [
    { href: '/warehouse', label: '待领', icon: '⊘' },
    { href: '/warehouse/materials', label: '辅料', icon: '▦' },
    { href: '/warehouse/records', label: '记录', icon: '☰' },
  ],
};

export function TabBar({ role }: { role: string }) {
  const pathname = usePathname();
  const tabs = TABS[role] || [];

  return (
    <div className="tabbar">
      {tabs.map((t) => {
        const base = `/${role.toLowerCase()}`;
        const active = pathname === t.href || (t.href !== base && pathname.startsWith(t.href));
        return (
          <Link key={t.href} href={t.href} className={active ? 'active' : ''}>
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
