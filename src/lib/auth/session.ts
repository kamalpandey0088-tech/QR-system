/**
 * @fileoverview Customer session management (separate from admin NextAuth).
 * @security
 * - Sessions use cryptographically random tokens (nanoid 64 chars)
 * - Stored in HTTP-Only, SameSite=Strict cookies (immune to XSS/CSRF)
 * - Sessions are tenant-scoped and time-limited
 * - Expired sessions are never returned
 */

import { nanoid } from 'nanoid';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { prisma } from '@/lib/db/prisma';
import { AppError } from '@/lib/errors';
import { isValidUUID } from '@/lib/security/sanitize';

const SESSION_COOKIE_NAME = 'customer_session';
const SESSION_TOKEN_LENGTH = 64;

/**
 * Creates a new customer session after QR code scan.
 * @security Token is cryptographically random, 64 characters.
 * Session is bound to a specific tenant to prevent cross-tenant access.
 */
export async function createCustomerSession(
  tenantId: string,
  tableNumber?: string
): Promise<{ sessionToken: string; sessionId: string }> {
  if (!isValidUUID(tenantId)) {
    throw new AppError('Invalid tenant ID', 400);
  }

  // Verify tenant exists and is active
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, isActive: true },
  });

  if (!tenant || !tenant.isActive) {
    throw new AppError('Restaurant not found or inactive', 404);
  }

  const sessionToken = nanoid(SESSION_TOKEN_LENGTH);
  const maxAge = parseInt(process.env.SESSION_MAX_AGE ?? '86400', 10);
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  const session = await prisma.customerSession.create({
    data: {
      tenantId,
      sessionToken,
      tableNumber: tableNumber ?? null,
      expiresAt,
    },
  });

  return {
    sessionToken,
    sessionId: session.id,
  };
}

/**
 * Validates a customer session token.
 * @security Returns null for expired or invalid tokens. Never throws with token details.
 */
export async function validateCustomerSession(
  sessionToken: string
): Promise<{
  id: string;
  tenantId: string;
  tableNumber: string | null;
  expiresAt: Date;
} | null> {
  if (!sessionToken || sessionToken.length !== SESSION_TOKEN_LENGTH) {
    return null;
  }

  const session = await prisma.customerSession.findUnique({
    where: { sessionToken },
    select: {
      id: true,
      tenantId: true,
      tableNumber: true,
      expiresAt: true,
    },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (new Date() > session.expiresAt) {
    // Clean up expired session
    await prisma.customerSession.delete({
      where: { id: session.id },
    }).catch(() => {
      // Ignore deletion errors for already-deleted sessions
    });
    return null;
  }

  return session;
}

/**
 * Extracts and validates the customer session from the request cookie.
 * @security HTTP-Only cookies cannot be read by JavaScript (XSS protection).
 */
export async function getSessionFromRequest(
  request: Request
): Promise<{
  id: string;
  tenantId: string;
  tableNumber: string | null;
  expiresAt: Date;
} | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookie(cookieHeader);
  let sessionToken = cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    }
  }

  if (!sessionToken) {
    return null;
  }

  return validateCustomerSession(sessionToken);
}

/**
 * Creates the Set-Cookie header for the customer session.
 * @security
 * - HttpOnly: prevents JavaScript access (XSS protection)
 * - SameSite=Strict: prevents CSRF attacks
 * - Secure: only sent over HTTPS in production
 * - Path=/: accessible to all API routes
 */
export function createSessionCookieHeader(
  sessionToken: string
): string {
  const maxAge = parseInt(process.env.SESSION_MAX_AGE ?? '86400', 10);
  const isSecure = process.env.SECURE_COOKIES === 'true';

  return serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure,
    path: '/',
    maxAge,
  });
}

/**
 * Creates a cookie header that deletes the session cookie.
 */
export function createSessionDeleteCookieHeader(): string {
  return serializeCookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Deletes a customer session from the database.
 * Used for logout or account/data deletion requests.
 */
export async function deleteCustomerSession(sessionId: string): Promise<void> {
  if (!isValidUUID(sessionId)) {
    throw new AppError('Invalid session ID', 400);
  }

  await prisma.customerSession.delete({
    where: { id: sessionId },
  }).catch(() => {
    // Session may already be deleted or expired
  });
}
