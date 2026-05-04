import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { EcTaxClient } from '@/components/EcTaxClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'FINANCE') redirect('/home');
  return (<div className="app-shell"><TopBar title="电商报税" userName={session.name} roleLabel="财务" /><EcTaxClient /><TabBar role="FINANCE" /></div>);
}
