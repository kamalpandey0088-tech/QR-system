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
    
    // 1. Delete PENDING orders older than 1 hour (frees up database storage and table space)
    const thirtyMinsAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const staleOrders = await prisma.order.deleteMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: thirtyMinsAgo }
      }
    });

    // 2. Delete expired customer sessions older than 1 day
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleSessions = await prisma.customerSession.deleteMany({
      where: {
        expiresAt: { lt: oneDayAgo }
      }
    });

    // 3. Delete old payment webhook logs (older than 30 days) to prevent log bloat
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const staleLogs = await prisma.paymentWebhookLog.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Database cleanup completed successfully',
      deletedStaleOrders: staleOrders.count,
      deletedStaleSessions: staleSessions.count,
      deletedStaleLogs: staleLogs.count,
    });
  } catch (error) {
    console.error('CRON Cleanup Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
