import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { IssuesListClient } from '@/components/IssuesListClient';

export default async function ManagerRecords() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'MANAGER') redirect('/home');

  return (
    <div className="app-shell">
      <TopBar title="辅料流水" userName={session.name} roleLabel="厂长" />
      <IssuesListClient showMoney={false} />
      <TabBar role="MANAGER" />
    </div>
  );
}
