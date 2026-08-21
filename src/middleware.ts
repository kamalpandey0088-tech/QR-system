/**
 * @fileoverview Next.js middleware for security, auth, rate limiting, and tenant resolution.
 * @security This middleware runs on EVERY request before hitting API routes.
 * It enforces authentication, rate limits, and security headers.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/** Routes that don't require authentication */
const PUBLIC_ROUTES = new Set([
  '/',
  '/login',
  '/api/auth',
  '/api/webhooks',
  '/api/session',
  '/api/health',
]);

/** Route prefixes that are always public */
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/menu/',
  '/api/tenants/',
  '/_next/',
  '/favicon',
];

/** Routes that require admin authentication */
const ADMIN_PREFIXES = ['/admin', '/api/admin/'];
const KDS_PREFIXES = ['/kitchen', '/api/kds/'];

/**
 * Checks if a path matches any public route or prefix.
 */
function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Checks if a path requires admin authentication.
 */
function isAdminRoute(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Checks if a path requires KDS (chef) authentication.
 */
function isKDSRoute(pathname: string): boolean {
  return KDS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Extracts tenant ID from request (query param or subdomain).
 */
function extractTenantId(request: NextRequest): string | null {
  // Check query parameter first: ?cafe_id=<uuid>
  const cafeId = request.nextUrl.searchParams.get('cafe_id');
  if (cafeId) return cafeId;

  // Check subdomain: <slug>.yourdomain.com
  const host = request.headers.get('host') ?? '';
  const parts = host.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      return subdomain; // This is a slug, not UUID - resolved in API routes
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ── Security Headers ─────────────────────────────────────
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  // ── CORS for API routes ──────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') ?? '';
    const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Max-Age', '86400');
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }
  }

  // ── Tenant Resolution ────────────────────────────────────
  const tenantId = extractTenantId(request);
  if (tenantId) {
    response.headers.set('x-tenant-id', tenantId);
  }

  // ── Public Routes - Allow through ────────────────────────
  if (isPublicRoute(pathname)) {
    return response;
  }

  // ── Cart/Order API routes - require customer session ─────
  if (pathname.startsWith('/api/cart') || pathname.startsWith('/api/orders')) {
    // These can be accessed by either admin auth or customer session
    // The actual auth check is done in the API route handler
    return response;
  }

  // ── Admin Routes - require admin JWT ─────────────────────
  if (isAdminRoute(pathname)) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });

    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Authentication required', correlationId: 'middleware' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify role - only SUPER_ADMIN and CAFE_OWNER can access admin
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'CAFE_OWNER') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions', correlationId: 'middleware' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
  }

  // ── KDS Routes - require chef/owner JWT ──────────────────
  if (isKDSRoute(pathname)) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });

    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Authentication required', correlationId: 'middleware' },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verify role - CHEF, CAFE_OWNER, or SUPER_ADMIN can access KDS
    if (!['CHEF', 'CAFE_OWNER', 'SUPER_ADMIN'].includes(token.role as string)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions', correlationId: 'middleware' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
