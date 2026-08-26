import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { createCorrelationId } from '@/lib/errors';
import { sanitizeForLog } from '@/lib/security/sanitize';

export async function POST(request: NextRequest) {
  const correlationId = createCorrelationId();
  try {
    const rawBody = await request.text();
    const receivedSignature = request.headers.get('x-razorpay-signature');
    
    if (!receivedSignature) {
      return NextResponse.json({ success: false, error: 'Missing signature', correlationId }, { status: 400 });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ success: false, error: 'Webhook not configured', correlationId }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(receivedSignature, 'utf8')
    );

    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid signature', correlationId }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event as string;
    const paymentEntity = event.payload?.payment?.entity;
    
    if (!paymentEntity?.id) return NextResponse.json({ success: false, error: 'Invalid payload', correlationId }, { status: 400 });

    const transactionId = paymentEntity.id as string;
    const razorpayOrderId = paymentEntity.order_id as string;

    const existingLog = await prisma.paymentWebhookLog.findUnique({
      where: {
        provider_transactionId_eventType: {
          provider: 'razorpay',
          transactionId,
          eventType,
        },
      },
    });

    if (existingLog?.processed) {
      return NextResponse.json({ success: true, data: { message: 'Already processed' }, correlationId }, { status: 200 });
    }

    await prisma.paymentWebhookLog.upsert({
      where: {
        provider_transactionId_eventType: { provider: 'razorpay', transactionId, eventType },
      },
      create: {
        provider: 'razorpay',
        eventType,
        transactionId,
        payload: event,
        signature: receivedSignature,
        verified: true,
        processed: false,
      },
      update: { verified: true },
    });

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      // Find the order regardless of status (so we can resurrect late payments that were auto-cancelled)
      const order = await prisma.order.findFirst({
        where: { paymentTransactionId: razorpayOrderId },
        select: { id: true, tenantId: true, status: true },
      });

      if (order) {
        if (order.status !== 'PENDING' && order.status !== 'CANCELLED') {
          console.warn(`[WEBHOOK-ALERT] Late payment capture for order ${order.id} which is already ${order.status}. Skipping status override.`);
          // Mark webhook as processed to prevent retries, but DO NOT overwrite the order status
          await prisma.paymentWebhookLog.update({
            where: {
              provider_transactionId_eventType: { provider: 'razorpay', transactionId, eventType },
            },
            data: { processed: true, tenantId: order.tenantId },
          });
        } else {
          // It is PENDING or CANCELLED, safe to mark as PAID
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: { status: 'PAID', paidAt: new Date() },
            });

            await prisma.paymentWebhookLog.update({
              where: {
                provider_transactionId_eventType: { provider: 'razorpay', transactionId, eventType },
              },
              data: { processed: true, tenantId: order.tenantId },
            });
          });
        }
      } else {
        console.error(`[WEBHOOK] No order found for paymentTransactionId ${razorpayOrderId}`);
      }
    }

    return NextResponse.json({ success: true, data: { received: true }, correlationId }, { status: 200 });
  } catch (error) {
    console.error(`[WEBHOOK] correlationId=${correlationId} error=${sanitizeForLog(error)}`);
    return NextResponse.json({ success: false, error: 'Internal error', correlationId }, { status: 500 });
  }
}
