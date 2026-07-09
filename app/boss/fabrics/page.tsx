import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { FabricAdminClient } from '@/components/FabricAdminClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'BOSS') redirect('/home');
  return (<div className="app-shell"><TopBar title="布料管理" userName={session.name} roleLabel="老板" /><FabricAdminClient canEdit={true} canOperate={true} canDeleteMove={true} /><TabBar role="BOSS" /></div>);
}
