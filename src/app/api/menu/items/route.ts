import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handleApiError, createCorrelationId, AppError } from '@/lib/errors';
import { createMenuItemSchema } from '@/lib/validations/menu';
import { requirePermission } from '@/lib/auth/rbac';
import { isValidUUID } from '@/lib/security/sanitize';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenant_id');
    const categoryId = request.nextUrl.searchParams.get('category_id');
    
    if (!tenantId || !isValidUUID(tenantId)) {
      throw new AppError('Valid tenant_id query parameter required', 400);
    }

    const includeAll = request.nextUrl.searchParams.get('include_all') === 'true';

    const where: Record<string, unknown> = {
      tenantId,
    };

    if (!includeAll) {
      where.isAvailable = true;
    }

    if (categoryId) {
      if (!isValidUUID(categoryId)) {
        throw new AppError('Invalid category_id', 400);
      }
      where.categoryId = categoryId;
    }

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        isAvailable: true,
        categoryId: true,
        category: { select: { name: true } },
        modifiers: {
          select: {
            modifier: {
              select: {
                id: true,
                name: true,
                price: true,
                isAvailable: true,
              },
            },
          },
        },
      },
    });

    const formattedItems = items.map((item) => ({
      ...item,
      price: Number(item.price),
      modifiers: item.modifiers
        .map((m) => ({
          id: m.modifier.id,
          name: m.modifier.name,
          price: Number(m.modifier.price),
          isAvailable: m.modifier.isAvailable,
        }))
        .filter((m) => m.isAvailable),
    }));

    return NextResponse.json({
      success: true,
      data: formattedItems,
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
    const data = createMenuItemSchema.parse(body);

    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, tenantId: user.tenantId },
    });
    if (!category) throw new AppError('Category not found', 404);

    // Validate that all provided modifier IDs belong to the caller's tenant
    if (data.modifierIds && data.modifierIds.length > 0) {
      const validModifiers = await prisma.modifier.findMany({
        where: {
          id: { in: data.modifierIds },
          tenantId: user.tenantId,
        },
        select: { id: true },
      });
      if (validModifiers.length !== data.modifierIds.length) {
        throw new AppError('One or more invalid modifiers provided. Modifiers must belong to your restaurant.', 400);
      }
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        tenantId: user.tenantId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        isAvailable: data.isAvailable,
        sortOrder: data.sortOrder,
        ...(data.modifierIds && data.modifierIds.length > 0
          ? {
              modifiers: {
                create: data.modifierIds.map((modId) => ({
                  modifierId: modId,
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        price: true,
        isAvailable: true,
        categoryId: true,
      },
    });

    return NextResponse.json(
      { success: true, data: { ...menuItem, price: Number(menuItem.price) }, correlationId: createCorrelationId() },
      { status: 201 }
    );
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
