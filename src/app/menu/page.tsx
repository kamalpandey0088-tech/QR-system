import { prisma } from '@/lib/db/prisma';
import CustomerMenu from '@/components/ui/CustomerMenu';
import SessionInitializer from './SessionInitializer';
import { createCustomerSession, getSessionFromRequest } from '@/lib/auth/session';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MenuPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const table = typeof searchParams.table === 'string' ? searchParams.table : '1';
  let tenantId = typeof searchParams.tenant === 'string' ? searchParams.tenant : null;

  // Domain-based routing
  if (!tenantId) {
    const host = headers().get('host') || '';
    // Look up by exact domain first
    let dbTenant = await prisma.tenant.findFirst({ where: { domain: host, isActive: true } });
    
    // Fallback: If no domain matches (e.g. testing on vercel app), just grab the first active tenant
    if (!dbTenant) {
      dbTenant = await prisma.tenant.findFirst({ where: { isActive: true } });
    }
    
    if (!dbTenant) {
      return <div className="p-8 text-center font-bold text-red-500">No active restaurant found. Please check database.</div>;
    }
    tenantId = dbTenant.id;
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
    (async () => {
      const cookieStore = cookies();
      const token = cookieStore.get('customer_session')?.value;
      if (token) {
        const existing = await prisma.customerSession.findUnique({ where: { sessionToken: token } });
        if (existing && existing.tenantId === tenantId && new Date() < existing.expiresAt) {
          if (table && existing.tableNumber !== table) {
            await prisma.customerSession.update({ where: { id: existing.id }, data: { tableNumber: table } });
          }
          return { sessionToken: token, sessionId: existing.id };
        }
      }
      return createCustomerSession(tenantId, table);
    })()
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
