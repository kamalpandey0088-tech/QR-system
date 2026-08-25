import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { updateOrderStatusSchema } from '@/lib/validations/order';
import { requirePermission, requireTenantAccess } from '@/lib/auth/rbac';
import { getSessionFromRequest } from '@/lib/auth/session';
import { isValidUUID } from '@/lib/security/sanitize';
import { isValidTransition } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    if (!isValidUUID(orderId)) throw new AppError('Invalid order ID', 400);

    const body = await request.json();
    const { status: newStatus } = updateOrderStatusSchema.parse(body);

    let allowedToUpdate = false;
    let expectedTenantId: string | undefined;

    try {
      // First, try Admin/Staff permissions
      const user = await requirePermission('UPDATE_ORDER_STATUS');
      allowedToUpdate = true;
      expectedTenantId = user.tenantId ?? undefined;
    } catch (e) {
      // If not staff, check if it's the customer who owns the order cancelling a PENDING order
      const customerSession = await getSessionFromRequest(request);
      if (customerSession && newStatus === 'CANCELLED') {
        const checkOrder = await prisma.order.findFirst({ where: { id: orderId }});
        if (checkOrder && checkOrder.sessionId === customerSession.id && checkOrder.status === 'PENDING') {
          allowedToUpdate = true;
          expectedTenantId = checkOrder.tenantId;
        }
      }
    }

    if (!allowedToUpdate) {
      throw new AppError('Unauthorized to update this order status', 403);
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: expectedTenantId,
      },
      select: { id: true, status: true, tenantId: true },
    });

    if (!order) throw new AppError('Order not found', 404);
    await requireTenantAccess(order.tenantId);

    if (!isValidTransition(order.status, newStatus)) {
      throw new AppError(`Cannot transition from ${order.status} to ${newStatus}`, 400);
    }

    // ATOMIC UPDATE: Only update if the status hasn't changed in the milliseconds since we fetched it
    const updatedOrderResponse = await prisma.order.updateMany({
      where: { 
        id: orderId,
        status: order.status // Concurrency lock: Must match what we just validated
      },
      data: {
        status: newStatus as 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED',
        ...(newStatus === 'PAID' ? { paidAt: new Date() } : {}),
      },
      });

    if (updatedOrderResponse.count === 0) {
      throw new AppError('Order status was already changed by another user', 409);
    }

    // Fetch the updated order since updateMany doesn't return the record
    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
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
