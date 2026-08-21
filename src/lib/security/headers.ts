/**
 * @fileoverview Security headers for all HTTP responses.
 * @security These headers protect against XSS, clickjacking, MIME sniffing,
 * and enforce HTTPS via HSTS.
 */

/** Security headers applied to every response */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

/**
 * Builds a Content-Security-Policy header value.
 * Allows Razorpay checkout scripts and WebSocket connections.
 */
export function buildCSP(nonce?: string): string {
  const scriptSrc = nonce
    ? `'self' 'nonce-${nonce}' https://checkout.razorpay.com`
    : `'self' 'unsafe-inline' https://checkout.razorpay.com`;

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ws://localhost:* wss://* https://api.razorpay.com`,
    `frame-src https://api.razorpay.com https://checkout.razorpay.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];

  return directives.join('; ');
}

/**
 * Applies all security headers to a Response object.
 */
export function applySecurityHeaders(response: Response, nonce?: string): Response {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  response.headers.set('Content-Security-Policy', buildCSP(nonce));
  return response;
}
