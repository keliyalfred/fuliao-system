import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { CutterActionClient } from './CutterActionClient';

export default async function CutterAction() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'CUTTER' && session.role !== 'MANAGER') redirect('/home');
  return (
    <div className="app-shell">
      <TopBar title="裁片录入" userName={session.name} roleLabel="裁床" />
      <CutterActionClient />
    </div>
  );
}
