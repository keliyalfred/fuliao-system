import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { LaborCostClient } from '@/components/LaborCostClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'BOSS') redirect('/home');
  return (<div className="app-shell"><TopBar title="工价管理" userName={session.name} roleLabel="老板" /><LaborCostClient /><TabBar role="BOSS" /></div>);
}
