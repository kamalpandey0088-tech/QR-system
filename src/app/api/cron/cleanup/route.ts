import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Check for Vercel Cron Secret to protect the endpoint
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const now = new Date();
    
    // 1. Soft-cancel PENDING orders older than 5 minutes (server-side expiry check)
    // We NEVER hard-delete orders. Keep the row for auditing.
    const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const staleOrders = await prisma.order.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: fiveMinsAgo }
      },
      data: {
        status: 'CANCELLED'
      }
    });

    // 2. Delete expired customer sessions older than 1 day
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleSessions = await prisma.customerSession.deleteMany({
      where: {
        expiresAt: { lt: oneDayAgo }
      }
    });

    // 3. We intentionally NEVER delete PaymentWebhookLogs. They are kept permanently for financial auditing.
    // (Removed staleLogs deletion block)

    return NextResponse.json({
      success: true,
      message: 'Database cleanup completed successfully',
      softCancelledStaleOrders: staleOrders.count,
      deletedStaleSessions: staleSessions.count,
    });
  } catch (error) {
    console.error('CRON Cleanup Error:', error);
    try {
      await prisma.systemAlert.create({
        data: {
          severity: 'ERROR',
          message: `Cron cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
          context: { error: String(error) }
        }
      });
    } catch (e) {
      // Ignore inner error
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
