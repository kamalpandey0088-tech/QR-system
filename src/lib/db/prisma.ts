import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  // Validate DATABASE_URL exists at startup
  if (!process.env.DATABASE_URL) {
    throw new Error(
      '[FATAL] DATABASE_URL environment variable is not set. ' +
      'The application cannot start without a database connection. ' +
      'Set DATABASE_URL in your .env file.'
    );
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'warn', 'error'] 
      : ['warn', 'error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
