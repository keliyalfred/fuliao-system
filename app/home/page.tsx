import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function HomeRedirect() {
  const session = await getSession();
  if (!session) redirect('/login');

  switch (session.role) {
    case 'BOSS': redirect('/boss');
    case 'MANAGER': redirect('/manager');
    case 'FINANCE': redirect('/finance');
    case 'PURCHASER': redirect('/purchaser');
    case 'WORKER': redirect('/worker');
    case 'CUTTER': redirect('/cutter');
    case 'PACKER': redirect('/packer');
    case 'WAREHOUSE': redirect('/warehouse');
    default: redirect('/login');
  }
}
