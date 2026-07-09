import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { BossDashboardClient } from '../boss/BossDashboardClient';

export default async function FinanceHome() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'FINANCE') redirect('/home');
  return (
    <div className="app-shell">
      <TopBar title="财务管理" userName={session.name} roleLabel="财务" />
      <BossDashboardClient />
      <TabBar role="FINANCE" />
    </div>
  );
}
