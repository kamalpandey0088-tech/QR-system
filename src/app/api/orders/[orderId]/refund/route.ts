import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { refundOrderSchema } from '@/lib/validations/order';
import { requirePermission, requireTenantAccess } from '@/lib/auth/rbac';
import { isValidUUID } from '@/lib/security/sanitize';

export async function POST(request: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
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

    // 1. Validation BEFORE the atomic claim
    const refundAmount = amount ?? Number(order.total);
    if (refundAmount > Number(order.total)) {
      throw new AppError('Refund amount exceeds order total', 400);
    }

    // 2. Pre-fetch webhook log if RAZORPAY, so we can fail early BEFORE the claim
    let webhookLog = null;
    if (order.paymentMethod === 'RAZORPAY' && order.paymentTransactionId) {
      webhookLog = await prisma.paymentWebhookLog.findFirst({
        where: {
          provider: 'razorpay',
          transactionId: { startsWith: 'pay_' },
          processed: true,
          payload: { path: ['payload', 'payment', 'entity', 'order_id'], equals: order.paymentTransactionId }
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!webhookLog) {
        throw new AppError('Payment webhook log not found. Cannot process refund automatically.', 400);
      }
    }

    // 3. Atomic Claim to prevent double-refund race conditions
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

    let refundTransactionId: string | null = null;

    // 4. Process refund via Razorpay
    if (order.paymentMethod === 'RAZORPAY' && webhookLog) {
      try {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) throw new AppError('Payment gateway not configured', 500);

        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

        const refund = await razorpay.payments.refund(webhookLog.transactionId, {
          amount: Math.round(refundAmount * 100), // Convert to paise
          notes: { orderId: order.id, reason },
        });
        refundTransactionId = refund.id;
      } catch (err: any) {
        // If Razorpay fails, we must revert the claim to avoid the stuck REFUNDED state
        await prisma.order.update({
          where: { id: orderId },
          data: { status: order.status }, // revert to original status
        });
        throw new AppError(err.message || 'Razorpay refund failed', 500);
      }
    }

    // 5. Create refund log
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
