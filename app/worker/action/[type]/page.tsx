import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { WorkerActionClient } from './WorkerActionClient';

const VALID_TYPES = ['OUT', 'RETURN', 'DEFECT', 'WASTE', 'DEFECT_TO_WASTE', 'DEFECT_RETURN_SUPPLIER', 'SPECIAL'];
const LABELS: Record<string, string> = {
  OUT: '领料', RETURN: '退料', DEFECT: '报次品', WASTE: '报废品',
  DEFECT_TO_WASTE: '次品转废品', DEFECT_RETURN_SUPPLIER: '次品退供应商',
  SPECIAL: '专机辅料领取',
};

// 允许所有角色访问（专机入口所有人可用）
const ROLE_LABELS: Record<string, string> = {
  WORKER: '师傅', BOSS: '老板', MANAGER: '厂长', CUTTER: '裁床',
  FINANCE: '财务', PURCHASER: '采购', PACKER: '打包', WAREHOUSE: '仓库',
};

export default async function Action({ params }: { params: { type: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!VALID_TYPES.includes(params.type)) notFound();

  // 所有角色都可以使用所有操作
  return (
    <div className="app-shell">
      <TopBar title={LABELS[params.type] || params.type} userName={session.name} roleLabel={ROLE_LABELS[session.role] || ''} />
      <WorkerActionClient type={params.type} />
    </div>
  );
}
