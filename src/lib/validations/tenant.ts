/**
 * @fileoverview Zod validation schemas for tenant management.
 * @security Theme config is strictly typed to prevent XSS via CSS injection.
 */

import { z } from 'zod';

/** CSS color validation - hex only, no url() or expression() allowed */
const cssColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Must be a valid hex color (e.g., #2563eb)')
  .optional();

/** Safe font family - alphanumeric, spaces, commas only */
const fontFamilySchema = z
  .string()
  .max(100)
  .regex(/^[a-zA-Z0-9\s,'-]+$/, 'Invalid font family characters')
  .optional();

/** Theme configuration - strictly typed to prevent CSS injection attacks */
export const themeConfigSchema = z.object({
  primaryColor: cssColorSchema.default('#2563eb'),
  secondaryColor: cssColorSchema.default('#64748b'),
  accentColor: cssColorSchema.default('#f59e0b'),
  backgroundColor: cssColorSchema.default('#ffffff'),
  surfaceColor: cssColorSchema.default('#f8fafc'),
  fontFamily: fontFamilySchema.default('Inter'),
  borderRadius: z
    .enum(['0', '0.25rem', '0.5rem', '0.75rem', '1rem'])
    .default('0.5rem'),
  buttonStyle: z.enum(['rounded', 'pill', 'square']).default('rounded'),
});

/** Create tenant request */
export const createTenantSchema = z.object({
  name: z
    .string()
    .min(2, 'Tenant name must be at least 2 characters')
    .max(100, 'Tenant name too long')
    .trim(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .transform((v) => v.toLowerCase()),
  domain: z
    .string()
    .max(255)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Invalid domain format')
    .optional(),
  logoUrl: z.string().url('Invalid logo URL').max(500).optional(),
  upiId: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format').max(100).optional(),
  themeConfig: themeConfigSchema.optional(),
  currency: z
    .string()
    .length(3, 'Currency must be 3 characters (ISO 4217)')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase ISO 4217 code')
    .default('INR'),
  taxRate: z
    .number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .default(0),
});

/** Update tenant request */
export const updateTenantSchema = createTenantSchema.partial().omit({ slug: true });

/** Update theme only */
export const updateThemeSchema = z.object({
  themeConfig: themeConfigSchema,
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
