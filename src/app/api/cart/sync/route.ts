export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { getSessionFromRequest } from '@/lib/auth/session';
import { validateItemAvailability, validateModifiers } from '@/lib/db/server-pricing';

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) throw new AppError('Session required.', 401);

    const body = await request.json();
    const { items } = body; 
    
    if (!Array.isArray(items)) throw new AppError('Invalid items array', 400);

    // Get or create active cart
    let cart = await prisma.cart.findUnique({
      where: { sessionId: session.id }
    });

    if (!cart || cart.status === 'CHECKED_OUT') {
      if (cart && cart.status === 'CHECKED_OUT') {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      cart = await prisma.cart.upsert({
        where: { sessionId: session.id },
        update: { status: 'ACTIVE' },
        create: {
          tenantId: session.tenantId,
          sessionId: session.id,
          status: 'ACTIVE',
        },
      });
    }

    // Delete existing items to replace them with the sync state
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    const warnings: Array<{ itemId?: string, reason: string }> = [];

    // Insert new items
    for (const item of items) {
      if (item.quantity <= 0) continue;
      
      let menuItem;
      try {
         menuItem = await validateItemAvailability(item.menuItemId, session.tenantId);
      } catch(e) {
         warnings.push({ itemId: item.menuItemId, reason: (e instanceof Error ? e.message : 'Item is unavailable') });
         continue; // skip invalid items
      }

      const modifierIds = item.modifiers ? item.modifiers.map((m: any) => m.id) : [];
      let modifiers: any[] = [];
      try {
         modifiers = await validateModifiers(modifierIds, session.tenantId);
      } catch(e) {
         warnings.push({ itemId: item.menuItemId, reason: (e instanceof Error ? e.message : 'One or more modifiers are unavailable') });
      }

      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: menuItem.id,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          notes: item.notes ?? null,
          modifiers: modifiers.length > 0
            ? {
                create: modifiers.map((mod) => ({
                  modifierId: mod.id,
                  price: mod.price,
                })),
              }
            : undefined,
        }
      });
    }

    // Fetch the fresh cart state to return to UI
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
    const total = Math.round((subtotal + tax) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: { id: cart.id, items: formattedItems, subtotal, tax, total, warnings },
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
