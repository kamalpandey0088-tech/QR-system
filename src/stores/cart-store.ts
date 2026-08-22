/**
 * @fileoverview Zustand store for customer cart state.
 * 
 * Smart dual-mode cart:
 * - LOCAL mode: works instantly on the demo /menu page with no session needed.
 * - SERVER mode: syncs with the database when the customer has a real QR session cookie.
 *
 * This means the "Add to Order" button always works — whether arriving via QR scan
 * or directly navigating to /menu.
 */

'use client';

import { create } from 'zustand';

interface CartModifier {
  id: string;
  modifierName: string;
  price: number;
}

interface CartItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  isAvailable: boolean;
  modifiers: CartModifier[];
  lineTotal: number;
}

interface CartState {
  cartId: string | null;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  isLoading: boolean;
  error: string | null;
  hasSession: boolean;

  // Actions
  fetchCart: () => Promise<void>;
  addItem: (menuItemId: string, quantity: number, modifierIds?: string[], notes?: string, itemMeta?: { name: string; price: number }) => Promise<void>;
  updateItem: (itemId: string, quantity: number, notes?: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearError: () => void;
}

/** Recalculate totals from items array (used in local mode) */
function calcTotals(items: CartItem[]) {
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
  const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}

export const useCartStore = create<CartState>((set, get) => ({
  cartId: null,
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  isLoading: false,
  error: null,
  hasSession: false,

  fetchCart: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/cart', { credentials: 'include', cache: 'no-store' });
      const data = await response.json();

      // 401 = no session cookie, operate in local mode silently
      if (response.status === 401) {
        set({ isLoading: false, hasSession: false });
        return;
      }

      if (!data.success) throw new Error(data.error ?? 'Failed to fetch cart');

      set({
        cartId: data.data.id,
        items: data.data.items,
        subtotal: data.data.subtotal,
        tax: data.data.tax,
        total: data.data.total,
        isLoading: false,
        hasSession: true,
      });
    } catch {
      // On any failure, fall back to local mode silently
      set({ isLoading: false, hasSession: false });
    }
  },

  addItem: async (menuItemId, quantity, modifierIds = [], notes, itemMeta) => {
    const { hasSession, items } = get();

    // ── LOCAL MODE (no session / demo menu) ─────────────────────────────
    if (!hasSession) {
      const price = itemMeta?.price ?? 0;
      const name = itemMeta?.name ?? 'Item';
      const existing = items.find(i => i.menuItemId === menuItemId);

      let newItems: CartItem[];
      if (existing) {
        newItems = items.map(i =>
          i.menuItemId === menuItemId
            ? { ...i, quantity: i.quantity + quantity, lineTotal: (i.quantity + quantity) * i.unitPrice }
            : i
        );
      } else {
        const newItem: CartItem = {
          id: `local-${Date.now()}`,
          menuItemId,
          menuItemName: name,
          quantity,
          unitPrice: price,
          notes: notes ?? null,
          isAvailable: true,
          modifiers: [],
          lineTotal: price * quantity,
        };
        newItems = [...items, newItem];
      }

      set({ items: newItems, ...calcTotals(newItems) });
      return;
    }

    // ── SERVER MODE (real QR session) ────────────────────────────────────
    set({ isLoading: true, error: null });
    
    // OPTIMISTIC UI: Instantly update the cart visually before network request finishes
    const price = itemMeta?.price ?? 0;
    const name = itemMeta?.name ?? 'Item';
    const existing = items.find(i => i.menuItemId === menuItemId);
    let optimisticItems;
    if (existing) {
      optimisticItems = items.map(i =>
        i.menuItemId === menuItemId
          ? { ...i, quantity: i.quantity + quantity, lineTotal: (i.quantity + quantity) * i.unitPrice }
          : i
      );
    } else {
      optimisticItems = [...items, {
        id: `temp-${Date.now()}`,
        menuItemId,
        menuItemName: name,
        quantity,
        unitPrice: price,
        notes: notes ?? null,
        isAvailable: true,
        modifiers: [],
        lineTotal: price * quantity,
      }];
    }
    set({ items: optimisticItems, ...calcTotals(optimisticItems) });

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ menuItemId, quantity, modifierIds, notes }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to add item');

      // Use the returned cart directly instead of a follow-up GET request
      set({
        cartId: data.data.id,
        items: data.data.items,
        subtotal: data.data.subtotal,
        tax: data.data.tax,
        total: data.data.total,
        isLoading: false,
      });
    } catch (error) {
      // Revert optimistic update on failure
      console.error("[CART_STORE] POST /api/cart failed:", error);
      set({
        items, // back to original
        ...calcTotals(items),
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add item',
      });
    }
  },

  updateItem: async (itemId, quantity, notes) => {
    const { hasSession, items } = get();

    // ── LOCAL MODE ───────────────────────────────────────────────────────
    if (!hasSession) {
      let newItems: CartItem[];
      if (quantity <= 0) {
        newItems = items.filter(i => i.id !== itemId);
      } else {
        newItems = items.map(i =>
          i.id === itemId
            ? { ...i, quantity, notes: notes ?? i.notes, lineTotal: quantity * i.unitPrice }
            : i
        );
      }
      set({ items: newItems, ...calcTotals(newItems) });
      return;
    }

    // ── SERVER MODE ──────────────────────────────────────────────────────
    set({ isLoading: true, error: null });

    // OPTIMISTIC UI:
    const originalItems = items;
    const optimisticItems = items.map(i => 
      i.id === itemId ? { ...i, quantity, lineTotal: quantity * (i.unitPrice + i.modifiers.reduce((s, m) => s + m.price, 0)) } : i
    );
    set({ items: optimisticItems, ...calcTotals(optimisticItems) });

    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quantity, notes }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to update item');

      set({
        items: data.data.items,
        subtotal: data.data.subtotal,
        tax: data.data.tax,
        total: data.data.total,
        isLoading: false,
      });
    } catch (error) {
      set({
        items: originalItems,
        ...calcTotals(originalItems),
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update item',
      });
    }
  },

  removeItem: async (itemId) => {
    const { hasSession, items } = get();

    // ── LOCAL MODE ───────────────────────────────────────────────────────
    if (!hasSession) {
      const newItems = items.filter(i => i.id !== itemId);
      set({ items: newItems, ...calcTotals(newItems) });
      return;
    }

    // ── SERVER MODE ──────────────────────────────────────────────────────
    set({ isLoading: true, error: null });

    // OPTIMISTIC UI:
    const originalItems = items;
    const optimisticItems = items.filter(i => i.id !== itemId);
    set({ items: optimisticItems, ...calcTotals(optimisticItems) });

    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to remove item');

      set({
        items: data.data.items,
        subtotal: data.data.subtotal,
        tax: data.data.tax,
        total: data.data.total,
        isLoading: false,
      });
    } catch (error) {
      set({
        items: originalItems,
        ...calcTotals(originalItems),
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to remove item',
      });
    }
  },

  clearError: () => set({ error: null }),
}));
