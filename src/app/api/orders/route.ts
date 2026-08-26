import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { createOrderSchema, orderListQuerySchema } from '@/lib/validations/order';
import { getSessionFromRequest } from '@/lib/auth/session';
import { calculateCartTotal } from '@/lib/db/server-pricing';
import { auth } from '@/lib/auth/auth-options';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) throw new AppError('Session required.', 401);

    
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const rateLimit = rateLimiter.check(ip, 'api');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const body = await request.json();
    const { paymentMethod } = createOrderSchema.parse(body);

    const cart = await prisma.cart.findUnique({
      where: { sessionId: session.id },
      include: {
        items: {
          include: {
            menuItem: { select: { id: true, name: true, price: true, isAvailable: true } },
            modifiers: {
              include: {
                modifier: { select: { id: true, name: true, price: true, isAvailable: true } },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.status !== 'ACTIVE' || cart.items.length === 0) {
      throw new AppError('Cart is empty or already checked out', 400);
    }

    const totals = await calculateCartTotal(cart.id, session.tenantId);
    const idempotencyKey = nanoid(32);
    
    // Completely free "cash on counter" alternative route
    const initialStatus = 'PENDING';

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: session.tenantId,
          sessionId: session.id,
          status: initialStatus as 'PAID' | 'PENDING',
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          tableNumber: session.tableNumber,
          paymentMethod,
          idempotencyKey,
          paidAt: null, // Cash is unpaid until collected by staff
          items: {
            create: cart.items.map((item) => ({
              menuItemId: item.menuItem.id,
              tenantId: session.tenantId,
              itemName: item.menuItem.name,
              quantity: item.quantity,
              unitPrice: item.menuItem.price,
              notes: item.notes,
              modifiers: {
                create: item.modifiers.map((mod) => ({
                  modifierName: mod.modifier.name,
                  price: mod.modifier.price,
                })),
              },
            })),
          },
        },
        include: {
          items: {
            include: { modifiers: true },
          },
        },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CHECKED_OUT' },
      });

      return newOrder;
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          total: Number(order.total),
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt.toISOString(),
        },
        correlationId: createCorrelationId(),
      },
      { status: 201 }
    );
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminSession = await auth();
    const customerSession = await getSessionFromRequest(request);

    let orders;

    if (adminSession?.user?.tenantId) {
      const query = orderListQuerySchema.parse(
        Object.fromEntries(request.nextUrl.searchParams)
      );

      const where: Record<string, unknown> = { tenantId: adminSession.user.tenantId };
      if (query.status) where.status = query.status;

      orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
        include: {
          items: { include: { modifiers: true } },
        },
      });
    } else if (customerSession) {
      orders = await prisma.order.findMany({
        where: {
          sessionId: customerSession.id,
          tenantId: customerSession.tenantId,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { modifiers: true } },
        },
      });
    } else {
      throw new AppError('Authentication required', 401);
    }

    const formatted = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      total: Number(order.total),
      tableNumber: order.tableNumber,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        notes: item.notes,
        modifiers: item.modifiers.map((m) => ({
          modifierName: m.modifierName,
          price: Number(m.price),
        })),
      })),
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
