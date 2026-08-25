export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { addToCartSchema } from '@/lib/validations/cart';
import { getSessionFromRequest } from '@/lib/auth/session';
import { validateItemAvailability, validateModifiers } from '@/lib/db/server-pricing';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) throw new AppError('Session required. Please scan the QR code.', 401);

    const cart = await prisma.cart.findUnique({
      where: { sessionId: session.id },
      include: { tenant: { select: { taxRate: true } }, items: {
          include: {
            menuItem: { select: { name: true, price: true, isAvailable: true } },
            modifiers: {
              include: {
                modifier: { select: { name: true, price: true } },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.status !== 'ACTIVE') {
      return NextResponse.json({
        success: true,
        data: { id: null, items: [], subtotal: 0, tax: 0, total: 0 },
        correlationId: createCorrelationId(),
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { taxRate: true },
    });

    let subtotal = 0;
    const formattedItems = cart.items.map((item) => {
      const itemPrice = Number(item.menuItem.price);
      const modifierTotal = item.modifiers.reduce(
        (sum, m) => sum + Number(m.modifier.price), 0
      );
      const lineTotal = (itemPrice + modifierTotal) * item.quantity;
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
          price: Number(m.modifier.price),
        })),
        lineTotal: Math.round(lineTotal * 100) / 100,
      };
    });

    const taxRate = tenant ? Number(tenant.taxRate) / 100 : 0;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        id: cart.id,
        items: formattedItems,
        subtotal: Math.round(subtotal * 100) / 100,
        tax,
        total,
      },
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) throw new AppError('Session required.', 401);

    const body = await request.json();
    const { menuItemId, quantity, modifierIds, notes } = addToCartSchema.parse(body);

    const menuItem = await validateItemAvailability(menuItemId, session.tenantId);
    const modifiers = await validateModifiers(modifierIds ?? [], session.tenantId);

    // Use upsert to prevent Unique Constraint (409) errors if user rapidly double-clicks
    let cart = await prisma.cart.upsert({
      where: { sessionId: session.id },
      update: {},
      create: {
        tenantId: session.tenantId,
        sessionId: session.id,
        status: 'ACTIVE',
      },
    });

    // If the cart was previously checked out (they placed an order), reset it for a new order
    if (cart.status === 'CHECKED_OUT') {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      cart = await prisma.cart.update({
        where: { id: cart.id },
        data: { status: 'ACTIVE' }
      });
    }

    const cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        menuItemId: menuItem.id,
        quantity,
        unitPrice: menuItem.price,
        notes: notes ?? null,
        modifiers: modifiers.length > 0
          ? {
              create: modifiers.map((mod) => ({
                modifierId: mod.id,
                price: mod.price,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        menuItemId: true,
        quantity: true,
        unitPrice: true,
        notes: true,
      },
    });

    // Fetch full cart to return identical structure to GET
    const fullCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { tenant: { select: { taxRate: true } }, items: {
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

    const taxRate = fullCart?.tenant?.taxRate ? Number(fullCart.tenant.taxRate) / 100 : 0.05;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = subtotal + tax;

    return NextResponse.json(
      {
        success: true,
        data: { id: cart.id, items: formattedItems, subtotal, tax, total },
        correlationId: createCorrelationId(),
      },
      { status: 201 }
    );
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
