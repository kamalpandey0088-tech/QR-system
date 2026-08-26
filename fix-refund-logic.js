const fs = require('fs');
const file = 'src/app/api/orders/[orderId]/refund/route.ts';
let content = fs.readFileSync(file, 'utf8');

// The original logic block we want to replace
const oldCode = `    const refundAmount = amount ?? Number(order.total);
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
    }`;

// 1. Move validation UP. 
// Wait, the atomic claim is currently ABOVE this in the file because I replaced the simple if-check with the atomic claim.
// Let's read the current file state to see exactly what order it's in.
