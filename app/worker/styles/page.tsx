import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { StylesListClient } from '@/components/StylesListClient';
export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'WORKER') redirect('/home');
  return (<div className="app-shell"><TopBar title="裁片查看" userName={session.name} roleLabel="师傅" /><StylesListClient baseUrl="/worker/styles" canCreate={false} /><TabBar role="WORKER" /></div>);
}
