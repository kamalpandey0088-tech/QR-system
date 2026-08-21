import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { updateCartItemSchema } from '@/lib/validations/cart';
import { getSessionFromRequest } from '@/lib/auth/session';
import { isValidUUID } from '@/lib/security/sanitize';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) throw new AppError('Session required', 401);

    const { itemId } = params;
    if (!isValidUUID(itemId)) throw new AppError('Invalid item ID', 400);

    const body = await request.json();
    const { quantity, notes } = updateCartItemSchema.parse(body);

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          sessionId: session.id,
          status: 'ACTIVE',
        },
      },
    });

    if (!cartItem) throw new AppError('Cart item not found', 404);

    const updated = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity, ...(notes !== undefined ? { notes } : {}) },
      select: { id: true, quantity: true, notes: true },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) throw new AppError('Session required', 401);

    const { itemId } = params;
    if (!isValidUUID(itemId)) throw new AppError('Invalid item ID', 400);

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          sessionId: session.id,
          status: 'ACTIVE',
        },
      },
    });

    if (!cartItem) throw new AppError('Cart item not found', 404);

    await prisma.cartItem.delete({ where: { id: itemId } });

    return NextResponse.json({
      success: true,
      data: { deleted: true },
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
