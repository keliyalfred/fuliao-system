import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { StyleDetailClient } from '@/components/StyleDetailClient';
export default async function Page({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'MANAGER') redirect('/home');
  return (<div className="app-shell"><TopBar title="款式详情" userName={session.name} roleLabel="厂长" /><StyleDetailClient styleId={params.id} canEdit={false} /><TabBar role="MANAGER" /></div>);
}
