import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { StyleDetailClient } from '@/components/StyleDetailClient';
export default async function Page({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'CUTTER') redirect('/home');
  return (<div className="app-shell"><TopBar title="裁片录入" userName={session.name} roleLabel="裁床" /><StyleDetailClient styleId={params.id} canEdit={true} /><TabBar role="CUTTER" /></div>);
}
