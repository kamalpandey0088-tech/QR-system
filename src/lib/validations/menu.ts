/**
 * @fileoverview Zod validation schemas for menu management.
 * @security Prices validated as positive numbers, names sanitized.
 */

import { z } from 'zod';

/** Category creation */
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name too long')
    .trim(),
  description: z.string().max(500).trim().optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

/** Category update */
export const updateCategorySchema = createCategorySchema.partial();

/** Menu item creation */
export const createMenuItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Item name is required')
    .max(200, 'Item name too long')
    .trim(),
  description: z.string().max(1000).trim().optional(),
  /** @security Price MUST be a positive number - prevents negative price attacks */
  price: z
    .number()
    .positive('Price must be positive')
    .max(999999.99, 'Price exceeds maximum')
    .transform((v) => Math.round(v * 100) / 100),
  categoryId: z.string().uuid('Invalid category ID'),
  imageUrl: z.string().url('Invalid image URL').max(500).optional(),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  modifierIds: z
    .array(z.string().uuid('Invalid modifier ID'))
    .max(50, 'Too many modifiers')
    .optional(),
});

/** Menu item update */
export const updateMenuItemSchema = createMenuItemSchema.partial();

/** Toggle availability - simple boolean */
export const toggleAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

/** Modifier creation */
export const createModifierSchema = z.object({
  name: z
    .string()
    .min(1, 'Modifier name is required')
    .max(100, 'Modifier name too long')
    .trim(),
  /** @security Price must be non-negative - free modifiers allowed but not negative */
  price: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(999999.99, 'Price exceeds maximum')
    .transform((v) => Math.round(v * 100) / 100),
  isAvailable: z.boolean().default(true),
});

/** Modifier update */
export const updateModifierSchema = createModifierSchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type ToggleAvailabilityInput = z.infer<typeof toggleAvailabilitySchema>;
export type CreateModifierInput = z.infer<typeof createModifierSchema>;
export type UpdateModifierInput = z.infer<typeof updateModifierSchema>;
