import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { MaterialAdminClient } from '@/components/MaterialAdminClient';

export default async function ManagerMaterials() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'MANAGER') redirect('/home');
  return (
    <div className="app-shell">
      <TopBar title="辅料管理" userName={session.name} roleLabel="厂长" />
      <MaterialAdminClient />
      <TabBar role="MANAGER" />
    </div>
  );
}
