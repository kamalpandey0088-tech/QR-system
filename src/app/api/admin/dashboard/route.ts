import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const user = await requirePermission('VIEW_DASHBOARD');
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({
        success: true,
        data: { message: 'Select a tenant to view dashboard' },
        correlationId: createCorrelationId(),
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, activeOrders, ordersByStatus, topItems] = await Promise.all([
      prisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: today },
          status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
        },
        select: { total: true },
      }),
      prisma.order.count({
        where: { tenantId, status: { in: ['PAID', 'PREPARING', 'READY'] } },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { tenantId, createdAt: { gte: today } },
        _count: true,
      }),
      prisma.orderItem.groupBy({
        by: ['itemName'],
        where: {
          tenantId,
          order: {
            createdAt: { gte: today },
            status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
          },
        },
        _sum: { quantity: true, unitPrice: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total), 0);

    const statusCounts: Record<string, number> = {};
    for (const entry of ordersByStatus) {
      statusCounts[entry.status] = entry._count;
    }

    const topSellingItems = topItems.map((item) => ({
      itemName: item.itemName,
      totalQuantity: item._sum.quantity ?? 0,
      totalRevenue: Number(item._sum.unitPrice ?? 0),
    }));

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        todayOrderCount: todayOrders.length,
        activeOrderCount: activeOrders,
        topSellingItems,
        ordersByStatus: statusCounts,
      },
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
