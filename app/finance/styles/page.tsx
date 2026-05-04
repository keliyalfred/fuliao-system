import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { StylesListClient } from '@/components/StylesListClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'FINANCE') redirect('/home');
  return (<div className="app-shell"><TopBar title="款式与成本" userName={session.name} roleLabel="财务" /><StylesListClient baseUrl="/finance/styles" canCreate={false} /><TabBar role="FINANCE" /></div>);
}
