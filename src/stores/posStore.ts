/**
 * Point of Sale Store
 * Manages menu, cart, and order state
 */

import { create } from 'zustand';
import {
  MenuItem,
  CartItem,
  Order,
  OrderType,
  PaymentMethod,
  MenuCategory,
  CartModifier,
} from '../types/pos';
import { backendApi } from '../lib/backendApi';
import { transformPOSToKitchenOrder, createKitchenOrderWithId, validateKitchenOrder } from '../lib/orderTransformations';
import { useKDSStore } from './kdsStore';
import { useMenuStore } from './menuStore';
import { printerService } from '../lib/printerService';
import { usePrinterStore } from './printerStore';
import { posWebSocketClient } from '../lib/posWebSocketClient';

interface POSStore {
  // Menu state
  menuItems: MenuItem[];
  selectedCategory: MenuCategory | 'all';
  searchQuery: string;

  // Cart state
  cart: CartItem[];
  orderType: OrderType;
  tableNumber: number | null;
  notes: string;

  // Order state
  currentOrder: Order | null;
  recentOrders: Order[];
  isLoading: boolean;
  error: string | null;

  // Menu actions
  setMenuItems: (items: MenuItem[]) => void;
  setSelectedCategory: (category: MenuCategory | 'all') => void;
  setSearchQuery: (query: string) => void;
  fetchMenu: (tenantId: string) => Promise<void>;

  // Cart actions
  addToCart: (menuItem: MenuItem, quantity: number, modifiers: CartModifier[], specialInstructions?: string) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateModifiers: (cartItemId: string, modifiers: CartModifier[]) => void;
  clearCart: () => void;

  // Order actions
  setOrderType: (type: OrderType) => void;
  setTableNumber: (tableNumber: number | null) => void;
  setNotes: (notes: string) => void;
  submitOrder: (tenantId: string, paymentMethod: PaymentMethod) => Promise<Order>;
  updateLastOrderNumber: (orderNumber: string) => void;

  // Computed
  getCartTotal: () => { subtotal: number; tax: number; total: number };
  getFilteredMenu: () => MenuItem[];
}

// NOTE: Menu items are now loaded from menuStore (synced from HandsFree API)
// No longer using mock data

export const usePOSStore = create<POSStore>((set, get) => ({
  // Initial state
  menuItems: [], // Menu is loaded from menuStore
  selectedCategory: 'all',
  searchQuery: '',
  cart: [],
  orderType: 'dine-in',
  tableNumber: null,
  notes: '',
  currentOrder: null,
  recentOrders: [],
  isLoading: false,
  error: null,

  // Menu actions
  setMenuItems: (items) => set({ menuItems: items }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  fetchMenu: async (_tenantId) => {
    try {
      set({ isLoading: true, error: null });
      // Menu is now loaded from menuStore (synced from HandsFree API)
      // No need to fetch here - menu is loaded during login
      set({ isLoading: false });
    } catch (error) {
      console.error('[POSStore] Failed to fetch menu:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch menu',
        isLoading: false,
      });
    }
  },

  // Cart actions
  addToCart: (menuItem, quantity, modifiers, specialInstructions) => {
    const cartItemId = `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const modifiersTotal = modifiers.reduce((sum, mod) => sum + mod.price, 0);
    const subtotal = (menuItem.price + modifiersTotal) * quantity;

    const newCartItem: CartItem = {
      id: cartItemId,
      menuItem,
      quantity,
      modifiers,
      specialInstructions,
      subtotal,
    };

    set((state) => ({
      cart: [...state.cart, newCartItem],
    }));
  },

  removeFromCart: (cartItemId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== cartItemId),
    }));
  },

  updateQuantity: (cartItemId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(cartItemId);
      return;
    }

    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.id === cartItemId) {
          const modifiersTotal = item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
          const subtotal = (item.menuItem.price + modifiersTotal) * quantity;
          return { ...item, quantity, subtotal };
        }
        return item;
      }),
    }));
  },

  updateModifiers: (cartItemId, modifiers) => {
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.id === cartItemId) {
          const modifiersTotal = modifiers.reduce((sum, mod) => sum + mod.price, 0);
          const subtotal = (item.menuItem.price + modifiersTotal) * item.quantity;
          return { ...item, modifiers, subtotal };
        }
        return item;
      }),
    }));
  },

  clearCart: () => {
    set({
      cart: [],
      orderType: 'dine-in',
      tableNumber: null,
      notes: '',
    });
  },

  // Order actions
  setOrderType: (type) => set({ orderType: type }),
  setTableNumber: (tableNumber) => set({ tableNumber }),
  setNotes: (notes) => set({ notes }),

  submitOrder: async (tenantId, paymentMethod) => {
    const { cart, orderType, tableNumber, notes } = get();
    const totals = get().getCartTotal();

    if (cart.length === 0) {
      throw new Error('Cart is empty');
    }

    const order: Order = {
      orderType,
      tableNumber,
      items: cart,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: 0,
      total: totals.total,
      paymentMethod,
      status: 'pending',
      notes,
      createdAt: new Date().toISOString(),
    };

    try {
      set({ isLoading: true, error: null });

      // Transform POS order to backend format
      const { transformPOSOrderToBackend, validateBackendOrder } = await import('../lib/orderTransformations');
      const backendOrder = transformPOSOrderToBackend(order, tenantId);

      // Validate before submission
      if (!validateBackendOrder(backendOrder)) {
        throw new Error('Invalid order data');
      }

      // Submit to backend via WebSocket or HTTP
      let createdOrder: Order;
      const useWebSocket = posWebSocketClient.isConnected();

      if (useWebSocket) {
        console.log('[POSStore] Submitting order via WebSocket:', backendOrder);

        // Submit via WebSocket - response will come asynchronously via message handler
        posWebSocketClient.submitOrder(backendOrder);

        // Create temporary order (will be updated when WebSocket response arrives)
        createdOrder = {
          ...order,
          id: `temp-${Date.now()}`,
          orderNumber: `#${Math.floor(1000 + Math.random() * 9000)}`,
          status: 'pending', // Will be updated via WebSocket
        };
        console.log('[POSStore] Order submitted via WebSocket (async)');
      } else {
        // Fall back to HTTP API
        console.log('[POSStore] WebSocket not connected, using HTTP API');
        try {
          const { orderId, orderNumber } = await backendApi.submitOrder(tenantId, backendOrder);
          createdOrder = {
            ...order,
            id: orderId,
            orderNumber: orderNumber,
            status: 'confirmed', // Backend confirms immediately
          };
          console.log('[POSStore] Order created via HTTP:', createdOrder);
        } catch (backendError) {
          // If backend fails, fall back to local-only mode
          console.error('[POSStore] Backend submission failed, using local mode:', backendError);
          createdOrder = {
            ...order,
            id: `order-${Date.now()}`,
            orderNumber: `#${Math.floor(1000 + Math.random() * 9000)}`,
          };
        }
      }

      set((state) => ({
        currentOrder: createdOrder,
        recentOrders: [createdOrder, ...state.recentOrders].slice(0, 10),
        isLoading: false,
      }));

      // Phase 2 & 3: Transform to KitchenOrder and send to KDS + KOT printing
      try {
        // Transform POS order to KitchenOrder format
        const kitchenOrderPartial = transformPOSToKitchenOrder(createdOrder, tenantId);

        // Validate transformation
        if (!validateKitchenOrder(kitchenOrderPartial)) {
          console.error('[POSStore] Invalid KitchenOrder transformation');
        } else {
          // Create complete KitchenOrder with ID
          const kitchenOrder = createKitchenOrderWithId(kitchenOrderPartial);

          console.log('[POSStore] KitchenOrder created:', kitchenOrder);

          // Add to KDS store
          useKDSStore.getState().addOrder(kitchenOrder);
          console.log('[POSStore] Order sent to KDS');

          // Trigger KOT printing if auto-print enabled
          const printerConfig = usePrinterStore.getState().config;
          if (printerConfig.autoPrintOnAccept) {
            try {
              console.log('[POSStore] Printing KOT...');
              await printerService.print(kitchenOrder);
              usePrinterStore.getState().addPrintHistory(
                kitchenOrder.id,
                kitchenOrder.orderNumber,
                true
              );
              console.log('[POSStore] KOT printed successfully');
            } catch (printError) {
              // Silent continue - don't fail order if print fails
              console.error('[POSStore] KOT print failed:', printError);
              usePrinterStore.getState().addPrintHistory(
                kitchenOrder.id,
                kitchenOrder.orderNumber,
                false
              );
            }
          }
        }
      } catch (transformError) {
        // Log transformation/KDS errors but don't fail the order
        console.error('[POSStore] Failed to send order to KDS:', transformError);
      }

      // Clear cart after successful order
      get().clearCart();

      return createdOrder;
    } catch (error) {
      console.error('[POSStore] Failed to submit order:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to submit order',
        isLoading: false,
      });
      throw error;
    }
  },

  updateLastOrderNumber: (orderNumber) => {
    set((state) => {
      const lastOrder = state.recentOrders[0];
      if (lastOrder && !lastOrder.orderNumber) {
        // Update the last order with backend-assigned order number
        const updatedRecentOrders = state.recentOrders.map((order, index) =>
          index === 0 ? { ...order, orderNumber } : order
        );
        return { recentOrders: updatedRecentOrders };
      }
      return state;
    });
  },

  // Computed
  getCartTotal: () => {
    const { cart } = get();
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.05; // 5% tax
    const total = subtotal + tax;

    return { subtotal, tax, total };
  },

  getFilteredMenu: () => {
    const { selectedCategory, searchQuery } = get();

    // Get menu items from menuStore instead of local state
    const menuStoreItems = useMenuStore.getState().items;

    // Convert menuStore items to POS MenuItem format
    const menuItems: MenuItem[] = menuStoreItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category_id as MenuCategory,
      price: item.price,
      available: item.active !== false, // Use active field from menuStore
      preparationTime: item.preparation_time,
      tags: item.dietary_tags || [],
      modifiers: [],
      imageUrl: item.image,
    }));

    // Show all items (removed available filter to show full menu)
    let filtered = menuItems;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  },
}));
