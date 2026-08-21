import KitchenDisplay from '@/components/ui/KitchenDisplay';
import { auth } from '@/lib/auth/auth-options';
import { redirect } from 'next/navigation';

export default async function KitchenPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect('/login');
  }

  return <KitchenDisplay tenantId={session.user.tenantId} />;
}
