import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { createCategorySchema } from '@/lib/validations/menu';
import { requirePermission } from '@/lib/auth/rbac';
import { isValidUUID } from '@/lib/security/sanitize';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenant_id');
    if (!tenantId || !isValidUUID(tenantId)) {
      throw new AppError('Valid tenant_id query parameter required', 400);
    }

    const categories = await prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: categories,
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('MANAGE_MENU');
    if (!user.tenantId) throw new AppError('Tenant context required', 400);

    const body = await request.json();
    const data = createCategorySchema.parse(body);

    const category = await prisma.category.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
      },
    });

    return NextResponse.json(
      { success: true, data: category, correlationId: createCorrelationId() },
      { status: 201 }
    );
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
