/**
 * @fileoverview Zustand store for customer cart state.
 * Fixed: Debounced Bulk Sync to prevent Optimistic UI Rollbacks during rapid clicking.
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
  _syncWithServer: (fallbackItems?: CartItem[]) => void;
}

/** Recalculate totals from items array */
function calcTotals(items: CartItem[]) {
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
  const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}

const getBasicHeaders = () => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('customer_session_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
};

// Simple global debounce timer
let syncTimeout: NodeJS.Timeout | null = null;

export const useCartStore = create<CartState>((set, get) => ({
  cartId: null,
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  pendingRequests: 0,
  error: null,

  fetchCart: async () => {
    const hasSession = typeof window !== 'undefined' ? !!localStorage.getItem('customer_session_token') : false;
    if (!hasSession) return;
    
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

  _syncWithServer: (fallbackItems?: CartItem[]) => {
    const hasSession = typeof window !== 'undefined' ? !!localStorage.getItem('customer_session_token') : false;
    if (!hasSession) return;

    if (syncTimeout) clearTimeout(syncTimeout);
    
    // Set UI to syncing mode immediately
    set(state => ({ pendingRequests: state.pendingRequests + 1 }));

    syncTimeout = setTimeout(async () => {
      const currentItems = get().items;
      try {
        const response = await fetch('/api/cart/sync', {
          method: 'PUT',
          headers: getBasicHeaders(),
          credentials: 'include',
          body: JSON.stringify({ items: currentItems }),
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error ?? 'Failed to sync cart');

        set(state => {
          const remaining = Math.max(0, state.pendingRequests - 1);
          if (remaining === 0) {
             // We are the final sync! Safely update real IDs.
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
        set(state => {
          const newState: Partial<CartState> = {
            pendingRequests: Math.max(0, state.pendingRequests - 1),
            error: error instanceof Error ? error.message : 'Failed to sync cart',
          };
          if (fallbackItems) {
            newState.items = fallbackItems;
            Object.assign(newState, calcTotals(fallbackItems));
          }
          return newState;
        });
      }
    }, 400); // 400ms debounce
  },

  addItem: async (menuItemId, quantity, modifierIds = [], notes, itemMeta) => {
    const prevState = get();
    const { items } = prevState;
    const existing = items.find(i => i.menuItemId === menuItemId && i.modifiers.length === modifierIds.length);

    if (existing) {
      return get().updateItem(existing.id, existing.quantity + quantity, notes);
    }

    const price = itemMeta?.price ?? 0;
    const name = itemMeta?.name ?? 'Item';
    
    const newItem: CartItem = {
      id: `temp-${Date.now()}`,
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
    get()._syncWithServer(prevState.items);
  },

  updateItem: async (itemId, quantity, notes) => {
    const prevState = get();
    const { items } = prevState;

    let newItems: CartItem[];
    if (quantity <= 0) {
      newItems = items.filter(i => i.id !== itemId);
    } else {
      newItems = items.map(i =>
        i.id === itemId ? { ...i, quantity, lineTotal: quantity * (i.unitPrice + i.modifiers.reduce((s, m) => s + m.price, 0)) } : i
      );
    }
    set({ items: newItems, ...calcTotals(newItems) });
    get()._syncWithServer(prevState.items);
  },

  removeItem: async (itemId) => {
    const prevState = get();
    const { items } = prevState;
    const newItems = items.filter(i => i.id !== itemId);
    set({ items: newItems, ...calcTotals(newItems) });
    get()._syncWithServer(prevState.items);
  },

  clearError: () => set({ error: null }),
}));
