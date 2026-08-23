/**
 * @fileoverview Zustand store for customer cart state.
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
  pendingRequests: number;
  error: string | null;
  
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

const getHeaders = () => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('customer_session_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
};

const getBasicHeaders = () => {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('customer_session_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
};

export const useCartStore = create<CartState>((set, get) => ({
  cartId: null,
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  pendingRequests: 0,
  error: null,
  
  fetchCart: async () => {
    if (!(typeof window !== 'undefined' ? !!localStorage.getItem('customer_session_token') : false)) return;
    
    set(state => ({ pendingRequests: state.pendingRequests + 1, error: null }));
    try {
      const response = await fetch('/api/cart', {
        headers: getBasicHeaders(),
        credentials: 'include'
      });
      const data = await response.json();
      
      if (!data.success) {
        if (response.status !== 404) throw new Error(data.error);
        set(state => ({ pendingRequests: Math.max(0, state.pendingRequests - 1) }));
        return;
      }

      set(state => {
        const remaining = Math.max(0, state.pendingRequests - 1);
        if (remaining === 0) {
          return {
            cartId: data.data.id,
            items: data.data.items,
            subtotal: data.data.subtotal,
            tax: data.data.tax,
            total: data.data.total,
            pendingRequests: 0,
          };
        }
        return { pendingRequests: remaining };
      });
    } catch (error) {
      set(state => ({ 
        pendingRequests: Math.max(0, state.pendingRequests - 1),
        error: error instanceof Error ? error.message : 'Failed to fetch cart' 
      }));
    }
  },

  addItem: async (menuItemId, quantity, modifierIds = [], notes, itemMeta) => {
    const { items } = get();
    const hasSession = typeof window !== 'undefined' ? !!localStorage.getItem('customer_session_token') : false;
    const existing = items.find(i => i.menuItemId === menuItemId && i.modifiers.length === modifierIds.length);

    if (existing) {
      return get().updateItem(existing.id, existing.quantity + quantity, notes);
    }

    if (!hasSession) {
      const price = itemMeta?.price ?? 0;
      const name = itemMeta?.name ?? 'Item';
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
      const newItems = [...items, newItem];
      set({ items: newItems, ...calcTotals(newItems) });
      return;
    }

    set(state => ({ pendingRequests: state.pendingRequests + 1, error: null }));
    
    const price = itemMeta?.price ?? 0;
    const name = itemMeta?.name ?? 'Item';
    const optimisticItems = [...items, {
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
    set({ items: optimisticItems, ...calcTotals(optimisticItems) });

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ menuItemId, quantity, modifierIds, notes }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to add item');

      set(state => {
        const remaining = Math.max(0, state.pendingRequests - 1);
        if (remaining === 0) {
          return {
            cartId: data.data.id,
            items: data.data.items,
            subtotal: data.data.subtotal,
            tax: data.data.tax,
            total: data.data.total,
            pendingRequests: 0,
          };
        }
        return { pendingRequests: remaining };
      });
    } catch (error) {
      set(state => ({
        items, // revert
        ...calcTotals(items),
        pendingRequests: Math.max(0, state.pendingRequests - 1),
        error: error instanceof Error ? error.message : 'Failed to add item',
      }));
    }
  },

  updateItem: async (itemId, quantity, notes) => {
    const { items } = get();
    const hasSession = typeof window !== 'undefined' ? !!localStorage.getItem('customer_session_token') : false;

    if (!hasSession) {
      let newItems: CartItem[];
      if (quantity <= 0) {
        newItems = items.filter(i => i.id !== itemId);
      } else {
        newItems = items.map(i =>
          i.id === itemId ? { ...i, quantity, lineTotal: quantity * (i.unitPrice + i.modifiers.reduce((s, m) => s + m.price, 0)) } : i
        );
      }
      set({ items: newItems, ...calcTotals(newItems) });
      return;
    }

    set(state => ({ pendingRequests: state.pendingRequests + 1, error: null }));

    const originalItems = items;
    const optimisticItems = items.map(i => 
      i.id === itemId ? { ...i, quantity, lineTotal: quantity * (i.unitPrice + i.modifiers.reduce((s, m) => s + m.price, 0)) } : i
    );
    set({ items: optimisticItems, ...calcTotals(optimisticItems) });

    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ quantity, notes }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to update item');

      set(state => {
        const remaining = Math.max(0, state.pendingRequests - 1);
        if (remaining === 0) {
          return {
            items: data.data.items,
            subtotal: data.data.subtotal,
            tax: data.data.tax,
            total: data.data.total,
            pendingRequests: 0,
          };
        }
        return { pendingRequests: remaining };
      });
    } catch (error) {
      set(state => ({
        items: originalItems,
        ...calcTotals(originalItems),
        pendingRequests: Math.max(0, state.pendingRequests - 1),
        error: error instanceof Error ? error.message : 'Failed to update item',
      }));
    }
  },

  removeItem: async (itemId) => {
    const { items } = get();
    const hasSession = typeof window !== 'undefined' ? !!localStorage.getItem('customer_session_token') : false;

    if (!hasSession) {
      const newItems = items.filter(i => i.id !== itemId);
      set({ items: newItems, ...calcTotals(newItems) });
      return;
    }

    set(state => ({ pendingRequests: state.pendingRequests + 1, error: null }));

    const originalItems = items;
    const optimisticItems = items.filter(i => i.id !== itemId);
    set({ items: optimisticItems, ...calcTotals(optimisticItems) });

    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getBasicHeaders(),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to remove item');

      set(state => {
        const remaining = Math.max(0, state.pendingRequests - 1);
        if (remaining === 0) {
          return {
            items: data.data.items,
            subtotal: data.data.subtotal,
            tax: data.data.tax,
            total: data.data.total,
            pendingRequests: 0,
          };
        }
        return { pendingRequests: remaining };
      });
    } catch (error) {
      set(state => ({
        items: originalItems,
        ...calcTotals(originalItems),
        pendingRequests: Math.max(0, state.pendingRequests - 1),
        error: error instanceof Error ? error.message : 'Failed to remove item',
      }));
    }
  },

  clearError: () => set({ error: null }),
}));
