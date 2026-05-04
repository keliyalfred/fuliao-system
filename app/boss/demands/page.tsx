import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { DemandListClient } from '@/components/DemandListClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'BOSS') redirect('/home');
  return (<div className="app-shell"><TopBar title="辅料需求" userName={session.name} roleLabel="老板" /><DemandListClient /><TabBar role="BOSS" /></div>);
}
