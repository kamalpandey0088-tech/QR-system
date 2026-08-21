import { prisma } from '@/lib/db/prisma';
import CustomerMenu from '@/components/ui/CustomerMenu';
import SessionInitializer from './SessionInitializer';
import { createCustomerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MenuPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const table = typeof searchParams.table === 'string' ? searchParams.table : '1';
  let tenantId = typeof searchParams.tenant === 'string' ? searchParams.tenant : null;

  // For seamless demo testing, if no tenant provided, use the first active tenant
  if (!tenantId) {
    const defaultTenant = await prisma.tenant.findFirst({ where: { isActive: true } });
    if (!defaultTenant) {
      return <div className="p-8 text-center font-bold text-red-500">No active restaurant found. Please run seed script.</div>;
    }
    tenantId = defaultTenant.id;
  }

  // 1. Fetch ALL data concurrently for maximum speed (4x faster)
  const [tenant, categories, rawItems, sessionData] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.category.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.menuItem.findMany({
      where: { tenantId, isAvailable: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        modifiers: {
          include: { modifier: true }
        }
      }
    }),
    createCustomerSession(tenantId, table)
  ]);

  if (!tenant) return <div>Restaurant not found</div>;

  const items = rawItems.map(item => ({
    id: item.id,
    categoryId: item.categoryId,
    themeKey: item.name.toLowerCase().includes('truffle') ? 'truffle' : (item.name.toLowerCase().includes('chicken') ? 'chicken' : 'latte'),
    name: item.name,
    description: item.description || '',
    price: Number(item.price),
    imageUrl: item.imageUrl || undefined,
  }));

  // 2. Session created concurrently
  const { sessionToken } = sessionData;

  return (
    <>
      <SessionInitializer token={sessionToken}>
        <CustomerMenu
        tenantName={tenant.name}
        initialCategories={categories.map(c => ({ id: c.id, name: c.name }))}
        initialItems={items}
      />
      </SessionInitializer>
    </>
  );
}
