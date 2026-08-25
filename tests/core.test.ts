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
    cart: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    tenant: { findUnique: vi.fn() },
    menuItem: { findFirst: vi.fn() },
    modifier: { findMany: vi.fn() },
    order: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    paymentWebhookLog: { findFirst: vi.fn() },
    refundLog: { create: vi.fn() }
  }
}));

vi.mock('@/lib/auth/rbac', () => ({
  requirePermission: vi.fn(),
  requireTenantAccess: vi.fn()
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
    
    const res = await POST(req, { params: { orderId: '123e4567-e89b-42d3-a456-426614174000' } });
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
    
    const res = await POST(req, { params: { orderId: '123e4567-e89b-42d3-a456-426614174000' } });
    const data = await res.json();

    // The route should return a 400 because the log wasn't found BEFORE the atomic claim
    expect(res.status).toBe(400);
    expect(data.error).toBe('Payment webhook log not found. Cannot process refund automatically.');
    
    // Ensure updateMany (atomic claim) was never called
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });
});
