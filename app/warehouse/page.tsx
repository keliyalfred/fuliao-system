import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { DemandListClient } from '@/components/DemandListClient';
import Link from 'next/link';

export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'WAREHOUSE') redirect('/home');
  return (
    <div className="app-shell">
      <TopBar title="待领辅料" userName={session.name} roleLabel="仓库" />
      <div className="page" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Link href="/worker/action/OUT" style={{ padding: '14px 10px', background: '#E1F5EE', color: '#085041', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
            ⊕ 领料
          </Link>
          <Link href="/worker/action/RETURN" style={{ padding: '14px 10px', background: '#E6F1FB', color: '#0C447C', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
            ⊕ 退料
          </Link>
          <Link href="/worker/action/SPECIAL" style={{ padding: '14px 10px', background: '#FAEEDA', color: '#633806', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
            ⊕ 专机领料
          </Link>
          <Link href="/purchases" style={{ padding: '14px 10px', background: '#FAEEDA', color: '#854F0B', borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
            🚚 采购在途
          </Link>
        </div>
      </div>
      <DemandListClient />
      <TabBar role="WAREHOUSE" />
    </div>
  );
}
