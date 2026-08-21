import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './prisma';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a proper UUIDv4.
 * @security Prevents SQL injection via tenant ID parameter.
 */
function validateTenantId(tenantId: string): void {
  if (!tenantId || !UUID_REGEX.test(tenantId)) {
    throw new Error(`Invalid tenant ID format: expected UUIDv4`);
  }
}

/**
 * Executes a function within a tenant-scoped transaction.
 * Sets the PostgreSQL session variable 'app.current_tenant_id' for RLS.
 * The variable is transaction-local (3rd arg = true in set_config),
 * so it cannot leak across pooled connections.
 */
export async function withTenantScope<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  validateTenantId(tenantId);

  return prisma.$transaction(async (tx) => {
    // Set RLS context - transaction-local to prevent leakage
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

/**
 * Creates a Prisma client extension that automatically sets tenant context.
 * Every query through this client is scoped to the specified tenant.
 * @security Double-barrier: application-level filtering + PostgreSQL RLS
 */
export function createTenantClient(tenantId: string) {
  validateTenantId(tenantId);

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
            return query(args);
          });
        },
      },
    },
  });
}
