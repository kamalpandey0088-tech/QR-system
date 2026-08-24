
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const user = await requirePermission('VIEW_DASHBOARD');
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ success: false, data: { message: 'Select a tenant' }, correlationId: createCorrelationId() }, { status: 400 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    // Fetch today's orders with items
    const todayOrders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: startOfToday } },
      include: { items: true }
    });

    // Fetch month's orders (just need totals)
    const monthOrders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: startOfMonth } },
      select: { total: true, status: true, paidAt: true }
    });

    // Active orders count
    const activeOrderCount = await prisma.order.count({
      where: { 
        tenantId, 
        status: { in: ['PENDING', 'PAID', 'PREPARING', 'READY'] } 
      }
    });

    // Calculations
    const isPaid = (o: any) => ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(o.status) && o.paidAt !== null;
    const todayRevenue = todayOrders.filter(isPaid).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const monthRevenue = monthOrders.filter(isPaid).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const todayOrderCount = todayOrders.length;
    const monthOrderCount = monthOrders.length;

    // Top selling items today
    const itemMap = new Map<string, number>();
    todayOrders.forEach(order => {
      order.items.forEach(item => {
        itemMap.set(item.itemName, (itemMap.get(item.itemName) || 0) + item.quantity);
      });
    });
    const topSellingItems = Array.from(itemMap.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Orders by status today
    const statusMap = new Map<string, number>();
    todayOrders.forEach(order => {
      statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
    });
    const ordersByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { items: true }
    });

    // Last 7 days revenue (Sparkline Data)
    const last7DaysOrders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, total: true, status: true, paidAt: true }
    });

    const last7DaysMap = new Map<string, number>();
    // Initialize last 7 days with 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      last7DaysMap.set(d.toISOString().split('T')[0]!, 0);
    }

    last7DaysOrders.forEach(o => {
      if (!isPaid(o)) return;
      const dateKey = new Date(o.createdAt).toISOString().split('T')[0]!;
      if (last7DaysMap.has(dateKey)) {
        last7DaysMap.set(dateKey, last7DaysMap.get(dateKey)! + Number(o.total || 0));
      }
    });

    const last7DaysRevenue = Array.from(last7DaysMap.entries()).map(([date, revenue]) => ({ date, revenue }));

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue,
        monthRevenue,
        todayOrderCount,
        monthOrderCount,
        activeOrderCount,
        topSellingItems,
        ordersByStatus,
        recentOrders,
        last7DaysRevenue
      }
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
