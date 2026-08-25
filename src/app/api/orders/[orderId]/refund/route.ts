import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { refundOrderSchema } from '@/lib/validations/order';
import { requirePermission, requireTenantAccess } from '@/lib/auth/rbac';
import { isValidUUID } from '@/lib/security/sanitize';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await requirePermission('MANAGE_REFUNDS');
    const { orderId } = params;
    if (!isValidUUID(orderId)) throw new AppError('Invalid order ID', 400);

    const body = await request.json();
    const { reason, amount } = refundOrderSchema.parse(body);

    // Fetch order and verify tenant ownership
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId ?? undefined },
      select: {
        id: true,
        tenantId: true,
        status: true,
        total: true,
        paymentTransactionId: true,
        paymentMethod: true,
      },
    });

    if (!order) throw new AppError('Order not found', 404);
    await requireTenantAccess(order.tenantId);

    // Atomic Claim to prevent double-refund race conditions
    const claim = await prisma.order.updateMany({
      where: {
        id: orderId,
        status: { in: ['PAID', 'PREPARING'] },
      },
      data: {
        status: 'REFUNDED',
      },
    });

    if (claim.count === 0) {
      throw new AppError('Order already refunded or in wrong state for refund', 409);
    }

    const refundAmount = amount ?? Number(order.total);
    if (refundAmount > Number(order.total)) {
      throw new AppError('Refund amount exceeds order total', 400);
    }

    let refundTransactionId: string | null = null;

    // Process refund via Razorpay if it was an online payment
    if (order.paymentMethod === 'RAZORPAY' && order.paymentTransactionId) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) throw new AppError('Payment gateway not configured', 500);

      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

      // Find the payment ID from webhook logs
      const webhookLog = await prisma.paymentWebhookLog.findFirst({
        where: {
          provider: 'razorpay',
          transactionId: { startsWith: 'pay_' },
          processed: true,
          // Extract the payment ID from the webhook that actually processed THIS order's Razorpay Order ID
          // The Razorpay webhook payload contains payload.payment.entity.order_id
          // We can find the log that matches our order's paymentTransactionId (which stores the Razorpay Order ID)
          payload: { path: ['payload', 'payment', 'entity', 'order_id'], equals: order.paymentTransactionId }
        },
        orderBy: { createdAt: 'desc' },
      });

      if (webhookLog) {
        const refund = await razorpay.payments.refund(webhookLog.transactionId, {
          amount: Math.round(refundAmount * 100), // Convert to paise
          notes: { orderId: order.id, reason },
        });
        refundTransactionId = refund.id;
      }
    }

    // Create refund log (status was already updated to REFUNDED in the atomic claim)
    await prisma.refundLog.create({
      data: {
        orderId,
        tenantId: order.tenantId,
        amount: refundAmount,
        reason,
        refundTransactionId,
        status: refundTransactionId ? 'PROCESSED' : 'INITIATED',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        refundAmount,
        status: refundTransactionId ? 'PROCESSED' : 'INITIATED',
        refundTransactionId,
      },
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
