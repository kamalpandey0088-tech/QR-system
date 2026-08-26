/**
 * @fileoverview TypeScript type definitions and constants for the POS/KDS platform.
 * @security Order state machine enforced here prevents invalid transitions.
 */

import type { Prisma } from '@prisma/client';

// ── Re-export Prisma enums for use throughout the app ────────

export { Role, CartStatus, OrderStatus } from '@prisma/client';

// ── API Response Types ───────────────────────────────────────

/** Standardized API success response */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  correlationId: string;
}

/** Standardized API error response */
export interface ApiErrorResponse {
  success: false;
  error: string;
  correlationId: string;
  /** Field-level validation errors */
  fieldErrors?: Record<string, string[]>;
}

/** Union type for all API responses */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Theme Configuration ──────────────────────────────────────

/** White-label theme configuration stored in tenant's theme_config JSONB */
export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  fontFamily: string;
  borderRadius: string;
  buttonStyle: 'rounded' | 'pill' | 'square';
}

// ── Order State Machine ──────────────────────────────────────

/**
 * Valid order status transitions.
 * @security Enforced server-side to prevent invalid state changes.
 * Example: An order cannot go from COMPLETED back to PENDING.
 */
export const ORDER_STATE_MACHINE: Record<string, readonly string[]> = {
  PENDING: ['PAID', 'PREPARING', 'CANCELLED'] as const,
  PAID: ['PREPARING', 'REFUNDED', 'CANCELLED'] as const,
  PREPARING: ['READY'] as const,
  READY: ['COMPLETED'] as const,
  COMPLETED: [] as const,
  CANCELLED: ['PAID'] as const,
  REFUNDED: [] as const,
};

/**
 * Checks if a status transition is valid according to the state machine.
 */
export function isValidTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const validTransitions = ORDER_STATE_MACHINE[currentStatus];
  if (!validTransitions) return false;
  return validTransitions.includes(newStatus);
}

// ── Socket Event Types ───────────────────────────────────────

/** WebSocket event names used between server and clients */
export const SOCKET_EVENTS = {
  // Server -> KDS
  ORDER_NEW: 'order:new',
  ORDER_PAID: 'order:paid',
  // Server -> Customer
  ORDER_PREPARING: 'order:preparing',
  ORDER_READY: 'order:ready',
  ORDER_COMPLETED: 'order:completed',
  ORDER_CANCELLED: 'order:cancelled',
  // KDS -> Server
  ORDER_ACCEPT: 'order:accept',
  ORDER_MARK_READY: 'order:mark-ready',
  // Menu updates
  MENU_ITEM_UPDATED: 'menu:item-updated',
  MENU_ITEM_UNAVAILABLE: 'menu:item-unavailable',
  // Connection
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  AUTH_ERROR: 'auth:error',
} as const;

// ── KDS Types ────────────────────────────────────────────────

/** Order data formatted for KDS display */
export interface KDSOrder {
  id: string;
  orderNumber: number;
  tableNumber: string | null;
  status: string;
  items: KDSOrderItem[];
  createdAt: string;
  paidAt: string | null;
}

/** Order item data for KDS */
export interface KDSOrderItem {
  id: string;
  itemName: string;
  quantity: number;
  notes: string | null;
  modifiers: Array<{
    modifierName: string;
  }>;
}

// ── Dashboard Types ──────────────────────────────────────────

/** Aggregated statistics for the admin dashboard */
export interface DashboardStats {
  todayRevenue: number;
  todayOrderCount: number;
  activeOrderCount: number;
  topSellingItems: Array<{
    itemName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  ordersByStatus: Record<string, number>;
  systemAlertCount?: number;
}

// ── Cart Types ───────────────────────────────────────────────

/** Cart with fully nested items and modifiers for display */
export interface CartWithItems {
  id: string;
  tenantId: string;
  status: string;
  items: Array<{
    id: string;
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    unitPrice: number;
    notes: string | null;
    modifiers: Array<{
      id: string;
      modifierName: string;
      price: number;
    }>;
    lineTotal: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

// ── Session Types ────────────────────────────────────────────

/** Authenticated admin/staff user from NextAuth session */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
}

// ── Printer Types ────────────────────────────────────────────

/** ESC/POS print job payload */
export interface PrintJob {
  tenantId: string;
  orderNumber: number;
  tableNumber: string | null;
  items: Array<{
    name: string;
    quantity: number;
    notes: string | null;
    modifiers: string[];
  }>;
  timestamp: string;
}
