import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { updateThemeSchema } from '@/lib/validations/tenant';
import { requireTenantAccess, requirePermission } from '@/lib/auth/rbac';
import { isValidUUID } from '@/lib/security/sanitize';

export async function GET(
  _request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    if (!isValidUUID(tenantId)) throw new AppError('Invalid tenant ID', 400);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true, upiId: true, themeConfig: true, currency: true },
    });

    if (!tenant) throw new AppError('Restaurant not found', 404);

    return NextResponse.json({ success: true, data: tenant, correlationId: createCorrelationId() });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    if (!isValidUUID(tenantId)) throw new AppError('Invalid tenant ID', 400);

    await requireTenantAccess(tenantId);
    await requirePermission('MANAGE_MENU');

    const body = await request.json();
    const { themeConfig } = updateThemeSchema.parse(body);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { themeConfig },
      select: { id: true, name: true, themeConfig: true },
    });

    return NextResponse.json({ success: true, data: tenant, correlationId: createCorrelationId() });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
