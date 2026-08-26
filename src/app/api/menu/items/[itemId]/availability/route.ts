import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { toggleAvailabilitySchema } from '@/lib/validations/menu';
import { requirePermission } from '@/lib/auth/rbac';
import { isValidUUID } from '@/lib/security/sanitize';

export async function PATCH(request: NextRequest, props: { params: Promise<{ itemId: string }> }) {
  const params = await props.params;
  try {
    const user = await requirePermission('TOGGLE_AVAILABILITY');
    if (!user.tenantId) throw new AppError('Tenant context required', 400);

    const { itemId } = params;
    if (!isValidUUID(itemId)) {
      throw new AppError('Invalid item ID', 400);
    }

    const body = await request.json();
    const { isAvailable } = toggleAvailabilitySchema.parse(body);

    const existingItem = await prisma.menuItem.findFirst({
      where: { id: itemId, tenantId: user.tenantId },
    });

    if (!existingItem) {
      throw new AppError('Menu item not found', 404);
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable },
      select: {
        id: true,
        name: true,
        isAvailable: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedItem,
      correlationId: createCorrelationId(),
    });
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
