import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { getSessionFromRequest } from '@/lib/auth/session';
import { isValidUUID } from '@/lib/security/sanitize';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) throw new AppError('Session required', 401);

    const { orderId } = params;
    if (!isValidUUID(orderId)) throw new AppError('Invalid order ID', 400);

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        sessionId: session.id, // Only allow access if the order belongs to this QR session
        tenantId: session.tenantId,
      },
      include: {
        items: true,
        tenant: {
          select: { name: true, themeConfig: true }
        }
      },
    });

    if (!order) throw new AppError('Order not found', 404);

    return NextResponse.json({
      success: true,
      data: order,
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
