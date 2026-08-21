/**
 * @fileoverview Role-Based Access Control (RBAC) system.
 * @security
 * - All permission checks happen server-side
 * - Roles are read from the signed JWT, not from client input
 * - Tenant access is verified against the JWT's tenantId
 */

import { auth } from '@/lib/auth/auth-options';
import { AppError } from '@/lib/errors';

// ── Permission Definitions ───────────────────────────────────

export const Permission = {
  MANAGE_TENANTS: 'MANAGE_TENANTS',
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_MENU: 'MANAGE_MENU',
  MANAGE_ORDERS: 'MANAGE_ORDERS',
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  VIEW_KDS: 'VIEW_KDS',
  UPDATE_ORDER_STATUS: 'UPDATE_ORDER_STATUS',
  MANAGE_REFUNDS: 'MANAGE_REFUNDS',
  TOGGLE_AVAILABILITY: 'TOGGLE_AVAILABILITY',
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

// ── Role-Permission Matrix ───────────────────────────────────

/**
 * Defines what each role can do.
 * @security This is the single source of truth for authorization.
 * UI elements may be hidden for UX, but enforcement happens HERE.
 */
const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  SUPER_ADMIN: new Set(Object.values(Permission)),
  CAFE_OWNER: new Set([
    Permission.MANAGE_USERS,
    Permission.MANAGE_MENU,
    Permission.MANAGE_ORDERS,
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_KDS,
    Permission.UPDATE_ORDER_STATUS,
    Permission.MANAGE_REFUNDS,
    Permission.TOGGLE_AVAILABILITY,
  ]),
  CHEF: new Set([
    Permission.VIEW_KDS,
    Permission.UPDATE_ORDER_STATUS,
    Permission.TOGGLE_AVAILABILITY,
  ]),
};

// ── Permission Check Functions ───────────────────────────────

/**
 * Checks if a role has a specific permission.
 */
export function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.has(permission);
}

/**
 * Gets the authenticated session or throws 401.
 * @security Always call this before accessing protected resources.
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    throw new AppError('Authentication required', 401);
  }

  return session.user;
}

/**
 * Requires the authenticated user to have a specific permission.
 * @security Permission check is based on the JWT role, not client input.
 * @throws AppError 403 if the user lacks the permission
 */
export async function requirePermission(permission: string) {
  const user = await requireAuth();

  if (!hasPermission(user.role, permission)) {
    throw new AppError('You do not have permission to perform this action', 403);
  }

  return user;
}

/**
 * Requires the authenticated user to have one of the specified roles.
 * @throws AppError 403 if the user's role is not in the allowed list
 */
export async function requireRole(...allowedRoles: string[]) {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    throw new AppError('You do not have the required role', 403);
  }

  return user;
}

/**
 * Verifies the authenticated user belongs to the specified tenant.
 * SuperAdmins can access any tenant.
 * @security Prevents cross-tenant data access by validating JWT tenant claim.
 * @throws AppError 403 if user doesn't belong to the tenant
 */
export async function requireTenantAccess(tenantId: string) {
  const user = await requireAuth();

  // SuperAdmins can access any tenant
  if (user.role === 'SUPER_ADMIN') {
    return user;
  }

  // Non-super users must belong to the specific tenant
  if (user.tenantId !== tenantId) {
    throw new AppError('Access denied: wrong tenant', 403);
  }

  return user;
}
