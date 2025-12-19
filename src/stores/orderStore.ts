import { create } from "zustand";
import { CartItem, MenuItem, OrderModifier } from "../types";
import { getCurrentPlatform } from "../lib/platform";
import { backendApi } from "../lib/backendApi";

interface OrderStore {
  // Current cart state
  cartItems: CartItem[];
  selectedTable: string | null;
  isVoiceMode: boolean;
  isSubmitting: boolean;
  submitError: string | null;

  // Actions
  addItem: (item: MenuItem, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  addModifier: (itemId: string, modifier: OrderModifier) => void;
  removeModifier: (itemId: string, modifierName: string) => void;
  setSpecialInstructions: (itemId: string, instructions: string) => void;
  clearCart: () => void;
  setSelectedTable: (tableId: string | null) => void;
  toggleVoiceMode: () => void;

  // Order submission
  submitOrder: (tenantId: string, orderType: 'dine_in' | 'takeaway' | 'delivery') => Promise<{ orderId: string; orderNumber: string } | null>;
  setSubmitting: (submitting: boolean) => void;
  setSubmitError: (error: string | null) => void;

  // Computed values
  getCartTotal: () => number;
  getCartItemCount: () => number;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  cartItems: [],
  selectedTable: null,
  isVoiceMode: false,
  isSubmitting: false,
  submitError: null,

  addItem: (item: MenuItem, quantity = 1) => {
    set((state) => {
      const existingItem = state.cartItems.find(
        (cartItem) => cartItem.menu_item.id === item.id
      );

      if (existingItem) {
        return {
          cartItems: state.cartItems.map((cartItem) =>
            cartItem.menu_item.id === item.id
              ? { ...cartItem, quantity: cartItem.quantity + quantity }
              : cartItem
          ),
        };
      }

      return {
        cartItems: [
          ...state.cartItems,
          {
            menu_item: item,
            quantity,
            modifiers: [],
            special_instructions: undefined,
          },
        ],
      };
    });
  },

  removeItem: (itemId: string) => {
    set((state) => ({
      cartItems: state.cartItems.filter(
        (item) => item.menu_item.id !== itemId
      ),
    }));
  },

  updateQuantity: (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(itemId);
      return;
    }

    set((state) => ({
      cartItems: state.cartItems.map((item) =>
        item.menu_item.id === itemId ? { ...item, quantity } : item
      ),
    }));
  },

  addModifier: (itemId: string, modifier: OrderModifier) => {
    set((state) => ({
      cartItems: state.cartItems.map((item) =>
        item.menu_item.id === itemId
          ? {
              ...item,
              modifiers: [...item.modifiers, modifier],
            }
          : item
      ),
    }));
  },

  removeModifier: (itemId: string, modifierName: string) => {
    set((state) => ({
      cartItems: state.cartItems.map((item) =>
        item.menu_item.id === itemId
          ? {
              ...item,
              modifiers: item.modifiers.filter(
                (mod) => mod.name !== modifierName
              ),
            }
          : item
      ),
    }));
  },

  setSpecialInstructions: (itemId: string, instructions: string) => {
    set((state) => ({
      cartItems: state.cartItems.map((item) =>
        item.menu_item.id === itemId
          ? { ...item, special_instructions: instructions }
          : item
      ),
    }));
  },

  clearCart: () => {
    set({ cartItems: [], selectedTable: null });
  },

  setSelectedTable: (tableId: string | null) => {
    set({ selectedTable: tableId });
  },

  toggleVoiceMode: () => {
    set((state) => ({ isVoiceMode: !state.isVoiceMode }));
  },

  setSubmitting: (submitting: boolean) => {
    set({ isSubmitting: submitting });
  },

  setSubmitError: (error: string | null) => {
    set({ submitError: error });
  },

  // Submit order to backend API (for web platform)
  submitOrder: async (tenantId: string, orderType: 'dine_in' | 'takeaway' | 'delivery') => {
    const platform = getCurrentPlatform();
    const { cartItems, selectedTable } = get();

    // Validate cart
    if (cartItems.length === 0) {
      set({ submitError: 'Cart is empty' });
      return null;
    }

    set({ isSubmitting: true, submitError: null });

    try {
      console.log('[OrderStore] Submitting order to API...');

      // Prepare order payload
      const orderPayload = {
        orderType,
        tableId: selectedTable,
        items: cartItems.map((item) => ({
          menuItemId: item.menu_item.id,
          name: item.menu_item.name,
          quantity: item.quantity,
          price: item.menu_item.price,
          modifiers: item.modifiers,
          specialInstructions: item.special_instructions,
        })),
        subtotal: get().getCartTotal(),
        total: get().getCartTotal(), // TODO: Add tax and discounts
        status: 'pending',
      };

      // Submit to API (web) or SQLite (Tauri)
      if (platform === 'web') {
        const result = await backendApi.submitOrder(tenantId, orderPayload);

        console.log('[OrderStore] Order submitted successfully:', result);

        // Clear cart on success
        get().clearCart();

        set({ isSubmitting: false, submitError: null });

        return result;
      } else {
        // For Tauri, use SQLite database service
        // TODO: Implement SQLite order submission in Phase 3
        console.log('[OrderStore] Tauri order submission not yet implemented');
        set({
          isSubmitting: false,
          submitError: 'Order submission for Tauri not yet implemented',
        });
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit order';
      console.error('[OrderStore] Failed to submit order:', error);

      set({
        isSubmitting: false,
        submitError: errorMessage,
      });

      return null;
    }
  },

  getCartTotal: () => {
    const { cartItems } = get();
    return cartItems.reduce((total, item) => {
      const itemTotal = item.quantity * item.menu_item.price;
      const modifiersTotal = item.modifiers.reduce(
        (sum, mod) => sum + mod.price_adjustment * item.quantity,
        0
      );
      return total + itemTotal + modifiersTotal;
    }, 0);
  },

  getCartItemCount: () => {
    const { cartItems } = get();
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  },
}));

