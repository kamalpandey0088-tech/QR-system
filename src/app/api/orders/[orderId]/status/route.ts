import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { updateOrderStatusSchema } from '@/lib/validations/order';
import { requirePermission, requireTenantAccess } from '@/lib/auth/rbac';
import { isValidUUID } from '@/lib/security/sanitize';
import { isValidTransition } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await requirePermission('UPDATE_ORDER_STATUS');
    const { orderId } = params;
    if (!isValidUUID(orderId)) throw new AppError('Invalid order ID', 400);

    const body = await request.json();
    const { status: newStatus } = updateOrderStatusSchema.parse(body);

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: user.tenantId ?? undefined,
      },
      select: { id: true, status: true, tenantId: true },
    });

    if (!order) throw new AppError('Order not found', 404);
    await requireTenantAccess(order.tenantId);

    if (!isValidTransition(order.status, newStatus)) {
      throw new AppError(`Cannot transition from ${order.status} to ${newStatus}`, 400);
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus as 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED',
        ...(newStatus === 'PAID' ? { paidAt: new Date() } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        tableNumber: true,
        total: true,
        paidAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedOrder,
        total: Number(updatedOrder.total),
        paidAt: updatedOrder.paidAt?.toISOString() ?? null,
      },
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
