import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { PurchasesPanelClient } from '@/components/PurchasesPanelClient';

const ROLE_LABELS: Record<string, string> = {
  BOSS: '老板', MANAGER: '厂长', FINANCE: '财务', PURCHASER: '采购',
  WORKER: '车间', CUTTER: '裁床', PACKER: '打包', WAREHOUSE: '仓库',
};

export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div className="app-shell">
      <TopBar title="采购在途" userName={session.name} roleLabel={ROLE_LABELS[session.role] || session.role} />
      <PurchasesPanelClient role={session.role} />
      <TabBar role={session.role} />
    </div>
  );
}
