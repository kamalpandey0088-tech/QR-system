import { createOrderSchema } from "../src/lib/validations/order";
import { rateLimiter } from "../src/lib/security/rate-limiter";
import { GET as DashboardGET } from "../src/app/api/admin/dashboard/route";
import { POST as OrderPOST } from "../src/app/api/orders/route";
import { getSessionFromRequest } from "../src/lib/auth/session";
import { auth } from "../src/lib/auth/auth-options";

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { isValidTransition } from '../src/types';
import { calculateCartTotal } from '../src/lib/db/server-pricing';
import { prisma } from '../src/lib/db/prisma';
import { requirePermission, requireTenantAccess } from '@/lib/auth/rbac';

// Mock the prisma client and auth


vi.mock('../src/lib/db/prisma', () => ({
  prisma: {
    cart: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    tenant: { findUnique: vi.fn() },
    menuItem: { findFirst: vi.fn() },
    modifier: { findMany: vi.fn() },
    order: { findFirst: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), count: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    orderItem: { groupBy: vi.fn() },
    paymentWebhookLog: { findFirst: vi.fn() },
    refundLog: { create: vi.fn() },
    systemAlert: { count: vi.fn() },
    $transaction: vi.fn()
  }
}));

// We need the ACTUAL calculateCartTotal logic to run, not mock it, so the tax test passes
vi.mock('../src/lib/db/server-pricing', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    calculateCartTotal: vi.fn().mockImplementation(actual.calculateCartTotal)
  };
});

vi.mock('@/lib/auth/rbac', () => ({
  requirePermission: vi.fn(),
  requireTenantAccess: vi.fn()
}));

vi.mock('../src/lib/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

vi.mock('../src/lib/auth/auth-options', () => ({
  auth: vi.fn(),
}));



describe('State Machine Transitions', () => {
  it('Order status transitions follow the defined state machine', () => {
    expect(isValidTransition('PREPARING', 'READY')).toBe(true);
    expect(isValidTransition('READY', 'PREPARING')).toBe(false);
    expect(isValidTransition('PENDING', 'PAID')).toBe(true);
    expect(isValidTransition('COMPLETED', 'PENDING')).toBe(false);
  });
});

describe('Tax Calculation Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculateCartTotal applies tenant-specific taxRate (e.g., 8%) instead of hardcoded 5%', async () => {
    vi.mocked(prisma.cart.findFirst).mockResolvedValue({
      id: 'cart-1',
      items: [{ quantity: 2, menuItem: { price: new Prisma.Decimal(100), isAvailable: true }, modifiers: [] }]
    } as any);

    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      taxRate: new Prisma.Decimal(8) // 8% tax rate
    } as any);

    const result = await calculateCartTotal('cart-1', 'tenant-1');
    expect(Number(result.subtotal)).toBe(200); // 2 * 100
    expect(Number(result.tax)).toBe(16); // 8% of 200
    expect(Number(result.total)).toBe(216);
  });
});

describe('Refund Concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue({ tenantId: 'tenant-1' } as any);
    vi.mocked(requireTenantAccess).mockResolvedValue(true as any);
  });

  it('Refund atomic claim blocks double-processing when count is 0', async () => {
    // Import the handler
    const { POST } = await import('../src/app/api/orders/[orderId]/refund/route');
    
    // Mock an order that is PAID
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant-1',
      status: 'PAID',
      total: new Prisma.Decimal(100),
      paymentMethod: 'CASH',
      paymentTransactionId: null
    } as any);

    // FIRST REQUEST: Simulate the claim failing (e.g. another request just claimed it so updateMany returns 0)
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 } as any);

    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Duplicate', amount: 50 })
    });
    
    const res = await POST(req, { params: Promise.resolve({ orderId: '123e4567-e89b-42d3-a456-426614174000' }) });
    const data = await res.json();

    // The route should return a 409 Conflict because the claim returned 0 rows
    expect(res.status).toBe(409);
    expect(data.error).toBe('Order already refunded or in wrong state for refund');
  });
  
  it('Refund fails early if Razorpay webhook log is missing', async () => {
    const { POST } = await import('../src/app/api/orders/[orderId]/refund/route');
    
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant-1',
      status: 'PAID',
      total: new Prisma.Decimal(100),
      paymentMethod: 'RAZORPAY',
      paymentTransactionId: 'pay_123'
    } as any);

    // Return null for the webhook log lookup
    vi.mocked(prisma.paymentWebhookLog.findFirst).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Requesting refund', amount: 100 })
    });
    
    const res = await POST(req, { params: Promise.resolve({ orderId: '123e4567-e89b-42d3-a456-426614174000' }) });
    const data = await res.json();

    // The route should return a 400 because the log wasn't found BEFORE the atomic claim
    expect(res.status).toBe(400);
    expect(data.error).toBe('Payment webhook log not found. Cannot process refund automatically.');
    
    // Ensure updateMany (atomic claim) was never called
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });
});

describe('Order Security & Revenue', () => {
  it('Order creation ignores client-supplied tableNumber', () => {
    // Verified: Zod schema in src/lib/validations/order.ts (createOrderSchema) does not accept tableNumber.
    // The tableNumber is strictly extracted from session.tableNumber in the POST handler.
    
    const parseResult = createOrderSchema.safeParse({ items: [], tableNumber: 'spoofed' });
    expect((parseResult as any).data?.tableNumber).toBeUndefined();
  });

  it('Cash orders are created as PENDING, never PAID', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({ id: 'session-1', tenantId: 'tenant-1', tableNumber: '5', expiresAt: new Date() });
    
    vi.mocked(prisma.cart.findUnique).mockResolvedValue({
      id: 'cart-1', status: 'ACTIVE', items: [{ quantity: 1, menuItem: { id: 'm-1', name: 'Coffee', price: new Prisma.Decimal(10), isAvailable: true }, modifiers: [] }]
    } as any);

    vi.mocked(calculateCartTotal).mockResolvedValue({ subtotal: new Prisma.Decimal(10), tax: new Prisma.Decimal(1), total: new Prisma.Decimal(11) } as any);
    
    // Simulate Prisma transaction returning the order with PENDING status
    let capturedOrderCreateData: any;
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      // Mock the tx object passed to the callback
      const mockTx = {
        order: {
          create: vi.fn().mockImplementation((args) => {
            capturedOrderCreateData = args.data;
            return { ...args.data, id: 'order-1', orderNumber: 1, createdAt: new Date() };
          }),
        },
        cart: { update: vi.fn() }
      };
      return callback(mockTx as any);
    });

    const req = new NextRequest('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ paymentMethod: 'CASH' }) });
    const res = await OrderPOST(req);
    const data = await res.json();
    
    expect(res.status).toBe(201);
    expect(data.data.status).toBe('PENDING'); // Assert response
    expect(capturedOrderCreateData.status).toBe('PENDING'); // Assert database insertion logic
    expect(capturedOrderCreateData.paidAt).toBe(null); // Explicitly unpaid
  });
});

describe('Dashboard Revenue', () => {
  it('Dashboard revenue calculations exclude PENDING/unpaid orders', async () => {
    vi.mocked(requirePermission).mockResolvedValue({ tenantId: 'tenant-1' } as any);
    
    // The actual route uses JS array filtering:
    // const isPaid = (o: any) => ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(o.status) && o.paidAt !== null;
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      { id: 'o-1', status: 'PENDING', total: new Prisma.Decimal(100), paidAt: null, createdAt: new Date(), items: [] },
      { id: 'o-2', status: 'PAID', total: new Prisma.Decimal(200), paidAt: new Date(), createdAt: new Date(), items: [] },
      { id: 'o-3', status: 'CANCELLED', total: new Prisma.Decimal(300), paidAt: null, createdAt: new Date(), items: [] },
      { id: 'o-4', status: 'COMPLETED', total: new Prisma.Decimal(400), paidAt: new Date(), createdAt: new Date(), items: [] }
    ] as any);
    
    vi.mocked(prisma.order.count).mockResolvedValue(0);
    vi.mocked(prisma.systemAlert.count).mockResolvedValue(0);

    const req = new NextRequest('http://localhost/api/admin/dashboard');
    const res = await DashboardGET();
    const result = await res.json();
    
    // Total should be 200 (PAID) + 400 (COMPLETED) = 600. PENDING (100) and CANCELLED (300) are excluded.
    expect(result.data.todayRevenue).toBe(600);
  });
});

describe('Rate Limiting', () => {
  it('Requests beyond the configured rate limit return HTTP 429', () => {
    const ip = '192.168.1.100';
    // Exhaust the rate limit (100 requests per window for api)
    for (let i = 0; i < 100; i++) {
      rateLimiter.check(ip, 'api');
    }
    const finalCheck = rateLimiter.check(ip, 'api');
    expect(finalCheck.allowed).toBe(false);
    expect(finalCheck.retryAfter).toBeGreaterThan(0);
  });
});
