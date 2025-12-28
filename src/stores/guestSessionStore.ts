/**
 * Guest Session Store
 * Manages guest ordering sessions for QR code-based dine-in ordering
 * Sessions are stored in localStorage and expire after 4 hours
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GuestSession,
  GuestCartItem,
} from '../types/guest-order';
import {
  getGuestSessionKey,
  SESSION_EXPIRY_MS,
} from '../types/guest-order';

interface GuestSessionState {
  // Current session
  session: GuestSession | null;
  tableId: string | null;
  tenantId: string | null;

  // Cart state
  cart: GuestCartItem[];
  guestName: string;
  specialInstructions: string;

  // UI state
  isCartOpen: boolean;

  // Actions
  initSession: (tenantId: string, tableId: string) => GuestSession;
  getSession: (tenantId: string, tableId: string) => GuestSession | null;
  updateLastActive: () => void;
  setGuestName: (name: string) => void;
  setSpecialInstructions: (instructions: string) => void;

  // Cart actions
  addToCart: (item: Omit<GuestCartItem, 'id'>) => void;
  updateCartItem: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;

  // UI actions
  setCartOpen: (open: boolean) => void;

  // Order tracking
  addOrderId: (orderId: string) => void;
  getOrderIds: () => string[];

  // Session cleanup
  clearSession: () => void;
  isSessionValid: () => boolean;
}

export const useGuestSessionStore = create<GuestSessionState>()(
  persist(
    (set, get) => ({
      // Initial state
      session: null,
      tableId: null,
      tenantId: null,
      cart: [],
      guestName: '',
      specialInstructions: '',
      isCartOpen: false,

      /**
       * Initialize or resume a guest session
       */
      initSession: (tenantId: string, tableId: string) => {
        const existingSession = get().getSession(tenantId, tableId);

        if (existingSession && get().isSessionValid()) {
          // Resume existing session
          set({
            session: existingSession,
            tableId,
            tenantId,
          });
          get().updateLastActive();
          return existingSession;
        }

        // Create new session
        const newSession: GuestSession = {
          sessionToken: crypto.randomUUID(),
          tableId,
          tenantId,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          orderIds: [],
        };

        set({
          session: newSession,
          tableId,
          tenantId,
          cart: [],
          guestName: '',
          specialInstructions: '',
        });

        // Persist to localStorage with table-specific key
        try {
          const key = getGuestSessionKey(tenantId, tableId);
          localStorage.setItem(key, JSON.stringify(newSession));
        } catch (error) {
          console.error('[GuestSessionStore] Failed to persist session:', error);
        }

        return newSession;
      },

      /**
       * Get existing session from localStorage
       */
      getSession: (tenantId: string, tableId: string) => {
        try {
          const key = getGuestSessionKey(tenantId, tableId);
          const stored = localStorage.getItem(key);
          if (!stored) return null;

          const session = JSON.parse(stored) as GuestSession;

          // Check if session is expired
          const lastActive = new Date(session.lastActiveAt).getTime();
          const now = Date.now();
          if (now - lastActive > SESSION_EXPIRY_MS) {
            // Session expired, remove it
            localStorage.removeItem(key);
            return null;
          }

          return session;
        } catch (error) {
          console.error('[GuestSessionStore] Failed to get session:', error);
          return null;
        }
      },

      /**
       * Update last active timestamp
       */
      updateLastActive: () => {
        const { session, tenantId, tableId } = get();
        if (!session || !tenantId || !tableId) return;

        const updatedSession = {
          ...session,
          lastActiveAt: new Date().toISOString(),
        };

        set({ session: updatedSession });

        try {
          const key = getGuestSessionKey(tenantId, tableId);
          localStorage.setItem(key, JSON.stringify(updatedSession));
        } catch (error) {
          console.error('[GuestSessionStore] Failed to update session:', error);
        }
      },

      setGuestName: (name: string) => {
        set({ guestName: name });
        const { session, tenantId, tableId } = get();
        if (session && tenantId && tableId) {
          const updatedSession = { ...session, guestName: name };
          set({ session: updatedSession });
          try {
            const key = getGuestSessionKey(tenantId, tableId);
            localStorage.setItem(key, JSON.stringify(updatedSession));
          } catch (error) {
            console.error('[GuestSessionStore] Failed to update guest name:', error);
          }
        }
      },

      setSpecialInstructions: (instructions: string) => {
        set({ specialInstructions: instructions });
      },

      /**
       * Add item to cart
       */
      addToCart: (item: Omit<GuestCartItem, 'id'>) => {
        const newItem: GuestCartItem = {
          ...item,
          id: crypto.randomUUID(),
        };

        set((state) => ({
          cart: [...state.cart, newItem],
        }));

        get().updateLastActive();
      },

      /**
       * Update cart item quantity
       */
      updateCartItem: (itemId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeFromCart(itemId);
          return;
        }

        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          ),
        }));

        get().updateLastActive();
      },

      /**
       * Remove item from cart
       */
      removeFromCart: (itemId: string) => {
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== itemId),
        }));

        get().updateLastActive();
      },

      /**
       * Clear entire cart
       */
      clearCart: () => {
        set({ cart: [], specialInstructions: '' });
      },

      /**
       * Calculate cart total
       */
      getCartTotal: () => {
        const { cart } = get();
        return cart.reduce((total, item) => {
          const modifierTotal = item.modifiers?.reduce(
            (sum, mod) => sum + mod.priceAdjustment,
            0
          ) || 0;
          return total + (item.price + modifierTotal) * item.quantity;
        }, 0);
      },

      /**
       * Get total number of items in cart
       */
      getCartItemCount: () => {
        const { cart } = get();
        return cart.reduce((count, item) => count + item.quantity, 0);
      },

      setCartOpen: (open: boolean) => {
        set({ isCartOpen: open });
      },

      /**
       * Add order ID to session
       */
      addOrderId: (orderId: string) => {
        const { session, tenantId, tableId } = get();
        if (!session || !tenantId || !tableId) return;

        const updatedSession = {
          ...session,
          orderIds: [...session.orderIds, orderId],
          lastActiveAt: new Date().toISOString(),
        };

        set({ session: updatedSession });

        try {
          const key = getGuestSessionKey(tenantId, tableId);
          localStorage.setItem(key, JSON.stringify(updatedSession));
        } catch (error) {
          console.error('[GuestSessionStore] Failed to add order ID:', error);
        }
      },

      /**
       * Get all order IDs for current session
       */
      getOrderIds: () => {
        const { session } = get();
        return session?.orderIds || [];
      },

      /**
       * Clear current session
       */
      clearSession: () => {
        const { tenantId, tableId } = get();
        if (tenantId && tableId) {
          try {
            const key = getGuestSessionKey(tenantId, tableId);
            localStorage.removeItem(key);
          } catch (error) {
            console.error('[GuestSessionStore] Failed to clear session:', error);
          }
        }

        set({
          session: null,
          tableId: null,
          tenantId: null,
          cart: [],
          guestName: '',
          specialInstructions: '',
          isCartOpen: false,
        });
      },

      /**
       * Check if current session is still valid
       */
      isSessionValid: () => {
        const { session } = get();
        if (!session) return false;

        const lastActive = new Date(session.lastActiveAt).getTime();
        const now = Date.now();
        return now - lastActive < SESSION_EXPIRY_MS;
      },
    }),
    {
      name: 'guest-session-store',
      // Only persist cart and guest name (session is stored separately per table)
      partialize: (state) => ({
        cart: state.cart,
        guestName: state.guestName,
        specialInstructions: state.specialInstructions,
        tableId: state.tableId,
        tenantId: state.tenantId,
      }),
    }
  )
);
