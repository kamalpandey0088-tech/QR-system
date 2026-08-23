/**
 * @fileoverview Zod validation schemas for order operations.
 * @security Order status transitions are validated against the state machine.
 * Prices/totals are NEVER accepted from client - always calculated server-side.
 */

import { z } from 'zod';

/**
 * Valid order status transitions (state machine).
 * Each key maps to the set of statuses it can transition TO.
 * @security This prevents invalid state transitions like COMPLETED -> PENDING.
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'REFUNDED', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
} as const;

/** Create order from cart - only needs the payment method */
export const createOrderSchema = z.object({
  paymentMethod: z.enum(['RAZORPAY', 'CASH', 'UPI'], {
    errorMap: () => ({ message: 'Payment method must be RAZORPAY, CASH, or UPI' }),
  }),
  tableNumber: z
    .string()
    .max(20, 'Table number too long')
    .trim()
    .optional(),
});

/** Update order status - validated against state machine */
export const updateOrderStatusSchema = z.object({
  status: z.enum(
    ['PENDING', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED'],
    { errorMap: () => ({ message: 'Invalid order status' }) }
  ),
});

/** Order list query params */
export const orderListQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** Refund request */
export const refundOrderSchema = z.object({
  reason: z
    .string()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason too long')
    .trim(),
  /** @security Amount is optional - if omitted, full refund. If provided, must be positive. */
  amount: z
    .number()
    .positive('Refund amount must be positive')
    .max(999999.99, 'Amount exceeds maximum')
    .optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;
