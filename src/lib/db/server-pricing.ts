import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

interface PriceCalculation {
  subtotal: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
}

interface CartItemForPricing {
  quantity: number;
  unitPrice: Prisma.Decimal;
  modifiers: Array<{ price: Prisma.Decimal }>;
}

/**
 * Calculates cart total using server-side prices from the database.
 * @security NEVER accepts prices from the client. All prices are fetched
 * from the database to prevent price manipulation attacks.
 */
export async function calculateCartTotal(
  cartId: string,
  tenantId: string
): Promise<PriceCalculation> {
  // Fetch cart with items and their modifiers
  const cart = await prisma.cart.findFirst({
    where: {
      id: cartId,
      tenantId: tenantId,
      status: 'ACTIVE',
    },
    include: {
      items: {
        include: {
          menuItem: true,
          modifiers: true,
        },
      },
    },
  });

  if (!cart) {
    throw new Error('Cart not found or already checked out');
  }

  if (cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  // Fetch tenant tax rate
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { taxRate: true },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Calculate subtotal using Decimal arithmetic (never floating point for money)
  let subtotal = new Prisma.Decimal(0);

  for (const item of cart.items) {
    // Verify item is still available
    if (!item.menuItem.isAvailable) {
      throw new Error(`Item "${item.menuItem.name}" is no longer available`);
    }

    // Use the CURRENT database price, not the cart's stored price
    const itemPrice = item.menuItem.price;
    const modifierTotal = item.modifiers.reduce(
      (sum, mod) => sum.add(mod.price),
      new Prisma.Decimal(0)
    );

    const lineTotal = itemPrice.add(modifierTotal).mul(item.quantity);
    subtotal = subtotal.add(lineTotal);
  }

  // Calculate tax
  const taxRate = tenant.taxRate.div(100);
  const tax = subtotal.mul(taxRate).toDecimalPlaces(2);
  const total = subtotal.add(tax).toDecimalPlaces(2);

  return {
    subtotal: subtotal.toDecimalPlaces(2),
    tax,
    total,
  };
}

/**
 * Validates that a menu item is currently available for ordering.
 * @throws Error if item is not available or doesn't belong to tenant
 */
export async function validateItemAvailability(
  menuItemId: string,
  tenantId: string
): Promise<{ id: string; name: string; price: Prisma.Decimal }> {
  const item = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      tenantId: tenantId,
    },
    select: {
      id: true,
      name: true,
      price: true,
      isAvailable: true,
    },
  });

  if (!item) {
    throw new Error('Menu item not found');
  }

  if (!item.isAvailable) {
    throw new Error(`"${item.name}" is currently unavailable`);
  }

  return { id: item.id, name: item.name, price: item.price };
}

/**
 * Validates that all modifiers exist, belong to the tenant, and are available.
 */
export async function validateModifiers(
  modifierIds: string[],
  tenantId: string
): Promise<Array<{ id: string; name: string; price: Prisma.Decimal }>> {
  if (modifierIds.length === 0) return [];

  const modifiers = await prisma.modifier.findMany({
    where: {
      id: { in: modifierIds },
      tenantId: tenantId,
    },
    select: {
      id: true,
      name: true,
      price: true,
      isAvailable: true,
    },
  });

  // Verify all requested modifiers were found
  if (modifiers.length !== modifierIds.length) {
    const foundIds = new Set(modifiers.map((m) => m.id));
    const missing = modifierIds.filter((id) => !foundIds.has(id));
    throw new Error(`Modifiers not found: ${missing.join(', ')}`);
  }

  // Check availability
  const unavailable = modifiers.filter((m) => !m.isAvailable);
  if (unavailable.length > 0) {
    throw new Error(
      `Modifiers unavailable: ${unavailable.map((m) => m.name).join(', ')}`
    );
  }

  return modifiers.map((m) => ({ id: m.id, name: m.name, price: m.price }));
}

/**
 * Creates order item snapshots from cart items.
 * Snapshots capture the price at time of order so historical orders remain accurate.
 */
export function createOrderItemSnapshots(
  cartItems: Array<{
    menuItem: { id: string; name: string; price: Prisma.Decimal };
    quantity: number;
    notes: string | null;
    modifiers: Array<{
      modifier: { name: string; price: Prisma.Decimal };
    }>;
  }>,
  tenantId: string
) {
  return cartItems.map((item) => ({
    menuItemId: item.menuItem.id,
    tenantId: tenantId,
    itemName: item.menuItem.name,
    quantity: item.quantity,
    unitPrice: item.menuItem.price,
    notes: item.notes,
    modifiers: {
      create: item.modifiers.map((mod) => ({
        modifierName: mod.modifier.name,
        price: mod.modifier.price,
      })),
    },
  }));
}
