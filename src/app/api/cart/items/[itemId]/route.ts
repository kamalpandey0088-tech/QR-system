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

    const fullCart = await prisma.cart.findUnique({
      where: { id: cartItem.cartId },
      include: {
        items: {
          include: {
            menuItem: { select: { name: true, price: true, isAvailable: true } },
            modifiers: { include: { modifier: { select: { name: true, price: true } } } },
          },
        },
      },
    });

    let subtotal = 0;
    const formattedItems = (fullCart?.items || []).map((item) => {
      const itemPrice = Number(item.unitPrice);
      const modifierTotal = item.modifiers.reduce((sum, mod) => sum + Number(mod.price), 0);
      const lineTotal = item.quantity * (itemPrice + modifierTotal);
      subtotal += lineTotal;
      return {
        id: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        isAvailable: item.menuItem.isAvailable,
        quantity: item.quantity,
        unitPrice: itemPrice,
        notes: item.notes,
        modifiers: item.modifiers.map((m) => ({
          id: m.modifierId,
          modifierName: m.modifier.name,
          price: Number(m.price),
        })),
        lineTotal: Math.round(lineTotal * 100) / 100,
      };
    });

    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + tax;

    return NextResponse.json({
      success: true,
      data: { id: cartItem.cartId, items: formattedItems, subtotal, tax, total },
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

    const fullCart = await prisma.cart.findUnique({
      where: { id: cartItem.cartId },
      include: {
        items: {
          include: {
            menuItem: { select: { name: true, price: true, isAvailable: true } },
            modifiers: { include: { modifier: { select: { name: true, price: true } } } },
          },
        },
      },
    });

    let subtotal = 0;
    const formattedItems = (fullCart?.items || []).map((item) => {
      const itemPrice = Number(item.unitPrice);
      const modifierTotal = item.modifiers.reduce((sum, mod) => sum + Number(mod.price), 0);
      const lineTotal = item.quantity * (itemPrice + modifierTotal);
      subtotal += lineTotal;
      return {
        id: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        isAvailable: item.menuItem.isAvailable,
        quantity: item.quantity,
        unitPrice: itemPrice,
        notes: item.notes,
        modifiers: item.modifiers.map((m) => ({
          id: m.modifierId,
          modifierName: m.modifier.name,
          price: Number(m.price),
        })),
        lineTotal: Math.round(lineTotal * 100) / 100,
      };
    });

    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + tax;

    return NextResponse.json({
      success: true,
      data: { id: cartItem.cartId, items: formattedItems, subtotal, tax, total },
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
