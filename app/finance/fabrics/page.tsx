import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { FabricAdminClient } from '@/components/FabricAdminClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'FINANCE') redirect('/home');
  return (<div className="app-shell"><TopBar title="布料查看" userName={session.name} roleLabel="财务" /><FabricAdminClient canEdit={false} canOperate={false} /><TabBar role="FINANCE" /></div>);
}
