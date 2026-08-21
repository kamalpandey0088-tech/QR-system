import { auth } from '@/lib/auth/auth-options';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }
  
  if (session.user.role !== 'OWNER' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/kitchen'); // Chefs/Staff are pushed to KDS
  }

  return <>{children}</>;
}
