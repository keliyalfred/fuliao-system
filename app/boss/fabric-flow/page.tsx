import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { FabricFlowClient } from '@/components/FabricFlowClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'BOSS') redirect('/home');
  return (<div className="app-shell"><TopBar title="布料流水" userName={session.name} roleLabel="老板" /><FabricFlowClient /><TabBar role="BOSS" /></div>);
}
