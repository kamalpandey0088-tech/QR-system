import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCustomerSession, createSessionCookieHeader } from '@/lib/auth/session';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { rateLimiter } from '@/lib/security/rate-limiter';

const createSessionSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  tableNumber: z.string().max(20).trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const rateLimit = rateLimiter.check(ip, 'api');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const body = await request.json();
    const { tenantId, tableNumber } = createSessionSchema.parse(body);
    
    const { sessionToken, sessionId } = await createCustomerSession(tenantId, tableNumber);
    
    const response = NextResponse.json(
      {
        success: true,
        data: { sessionId, tableNumber: tableNumber ?? null },
        correlationId: createCorrelationId(),
      },
      { status: 201 }
    );
    
    response.headers.set('Set-Cookie', createSessionCookieHeader(sessionToken));
    
    return response;
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
