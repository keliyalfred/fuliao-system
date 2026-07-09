import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { ExpenseClient } from '@/components/ExpenseClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'FINANCE') redirect('/home');
  return (<div className="app-shell"><TopBar title="财务凭证" userName={session.name} roleLabel="财务" /><ExpenseClient /><TabBar role="FINANCE" /></div>);
}
