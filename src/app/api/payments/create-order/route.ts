import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { getSessionFromRequest } from '@/lib/auth/session';

const createPaymentSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
});

function getRazorpayInstance(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) throw new AppError('Session required', 401);

    const body = await request.json();
    const { orderId } = createPaymentSchema.parse(body);

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        sessionId: session.id,
        tenantId: session.tenantId,
        status: 'PENDING',
      },
      select: { id: true, total: true, orderNumber: true },
    });

    if (!order) throw new AppError('Order not found or already paid', 404);

    const razorpay = getRazorpayInstance();
    if (!razorpay) throw new AppError('Online payments are not configured. Please use cash.', 400);

    const amount = Math.round(Number(order.total) * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: order.id,
      notes: { orderId: order.id, tenantId: session.tenantId },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentTransactionId: razorpayOrder.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount,
        currency: 'INR',
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      },
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
