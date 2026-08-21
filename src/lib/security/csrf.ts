/**
 * @fileoverview CSRF protection using double-submit cookie pattern.
 * @security Prevents cross-site request forgery attacks.
 */

import crypto from 'node:crypto';

/**
 * Generates a cryptographically random CSRF token.
 * Uses Node.js crypto for secure random generation.
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates a CSRF token against the cookie token.
 * Uses constant-time comparison to prevent timing attacks.
 * @security timingSafeEqual prevents attackers from determining
 * correct characters through response time analysis.
 */
export function validateCSRFToken(
  requestToken: string | null | undefined,
  cookieToken: string | null | undefined
): boolean {
  if (!requestToken || !cookieToken) {
    return false;
  }

  if (requestToken.length !== cookieToken.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(requestToken, 'utf8'),
      Buffer.from(cookieToken, 'utf8')
    );
  } catch {
    return false;
  }
}
