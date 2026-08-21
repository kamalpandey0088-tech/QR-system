/**
 * @fileoverview Zod validation schemas for cart operations.
 * @security Quantities must be positive integers. Prices are NEVER accepted from client.
 */

import { z } from 'zod';

/** Add item to cart - note: price is NOT accepted from client, only item ID */
export const addToCartSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  /** @security Quantity must be a positive integer between 1-99 */
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity cannot exceed 99'),
  modifierIds: z
    .array(z.string().uuid('Invalid modifier ID'))
    .max(20, 'Too many modifiers per item')
    .optional()
    .default([]),
  notes: z
    .string()
    .max(500, 'Notes too long')
    .trim()
    .optional(),
});

/** Update cart item quantity */
export const updateCartItemSchema = z.object({
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity cannot exceed 99'),
  notes: z
    .string()
    .max(500, 'Notes too long')
    .trim()
    .optional(),
});

/** Cart item ID parameter */
export const cartItemIdSchema = z.object({
  itemId: z.string().uuid('Invalid cart item ID'),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
