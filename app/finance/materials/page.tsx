import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { MaterialsListClient } from '@/components/MaterialsListClient';

export default async function FinanceMaterials() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'FINANCE') redirect('/home');
  return (
    <div className="app-shell">
      <TopBar title="辅料资产" userName={session.name} roleLabel="财务" />
      <MaterialsListClient showPrice={true} />
      <TabBar role="FINANCE" />
    </div>
  );
}
