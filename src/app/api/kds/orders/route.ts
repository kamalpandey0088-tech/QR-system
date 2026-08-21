
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const user = await requirePermission('VIEW_KDS');
    if (!user.tenantId) throw new AppError('Tenant context required', 400);

    const orders = await prisma.order.findMany({
      where: {
        tenantId: user.tenantId,
        status: { in: ['PAID', 'PREPARING', 'READY'] },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          include: { modifiers: true },
        },
      },
    });

    const formatted = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      status: order.status,
      items: order.items.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        notes: item.notes,
        modifiers: item.modifiers.map((m) => ({
          modifierName: m.modifierName,
        })),
      })),
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
