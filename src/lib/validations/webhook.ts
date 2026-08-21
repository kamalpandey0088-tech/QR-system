/**
 * @fileoverview Zod validation schemas for payment webhook payloads.
 * @security Webhook payloads are validated AFTER signature verification.
 * These schemas ensure the payload structure matches expected format.
 */

import { z } from 'zod';

/** Razorpay payment entity */
const razorpayPaymentEntitySchema = z.object({
  id: z.string().min(1),
  entity: z.literal('payment'),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  status: z.string(),
  order_id: z.string().min(1),
  method: z.string().optional(),
  description: z.string().optional().nullable(),
  notes: z.record(z.string(), z.string()).optional(),
  email: z.string().optional(),
  contact: z.string().optional(),
});

/** Razorpay webhook event */
export const razorpayWebhookSchema = z.object({
  entity: z.literal('event'),
  account_id: z.string().min(1),
  event: z.string().min(1),
  contains: z.array(z.string()),
  payload: z.object({
    payment: z.object({
      entity: razorpayPaymentEntitySchema,
    }),
  }),
  created_at: z.number(),
});

/** Razorpay order creation response */
export const razorpayOrderResponseSchema = z.object({
  id: z.string().min(1),
  entity: z.literal('order'),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  status: z.string(),
  receipt: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

/** Payment verification - client sends these after completing Razorpay checkout */
export const paymentVerificationSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
});

/** Refund initiation - admin only */
export const refundInitiationSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  reason: z
    .string()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason too long')
    .trim(),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(999999.99, 'Amount exceeds maximum')
    .optional(),
});

export type RazorpayWebhookPayload = z.infer<typeof razorpayWebhookSchema>;
export type RazorpayOrderResponse = z.infer<typeof razorpayOrderResponseSchema>;
export type PaymentVerificationInput = z.infer<typeof paymentVerificationSchema>;
export type RefundInitiationInput = z.infer<typeof refundInitiationSchema>;
