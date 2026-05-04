import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { StylesListClient } from '@/components/StylesListClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'CUTTER') redirect('/home');
  return (<div className="app-shell"><TopBar title="裁片录入" userName={session.name} roleLabel="裁床" /><StylesListClient baseUrl="/cutter/styles" canCreate={true} /><TabBar role="CUTTER" /></div>);
}
