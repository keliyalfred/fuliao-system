import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { BossDashboardClient } from '../boss/BossDashboardClient';

export default async function ManagerHome() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'MANAGER') redirect('/home');

  return (
    <div className="app-shell">
      <TopBar title="生产管理" userName={session.name} roleLabel="厂长" />
      <BossDashboardClient />
      <TabBar role="MANAGER" />
    </div>
  );
}
