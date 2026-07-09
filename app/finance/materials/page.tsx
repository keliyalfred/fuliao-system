import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { MaterialAdminClient } from '@/components/MaterialAdminClient';
export default async function FinanceMaterials() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'FINANCE') redirect('/home');
  return (
    <div className="app-shell">
      <TopBar title="辅料录入" userName={session.name} roleLabel="财务" />
      <MaterialAdminClient />
      <TabBar role="FINANCE" />
    </div>
  );
}
