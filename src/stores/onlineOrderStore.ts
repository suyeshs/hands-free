/**
 * Online Order Store
 * Manages online orders from restaurant website/app
 */

import { create } from 'zustand';
import {
  OnlineOrder,
  OnlineOrderFilter,
  OnlineOrderStatus,
  OnlineOrderStats,
} from '../types/online';
import { transformOnlineToKitchenOrder, createKitchenOrderWithId, validateKitchenOrder } from '../lib/orderTransformations';
import { useKDSStore } from './kdsStore';
import { printerService } from '../lib/printerService';
import { usePrinterStore } from './printerStore';

interface OnlineOrderStore {
  // State
  orders: OnlineOrder[];
  selectedOrder: OnlineOrder | null;
  filter: OnlineOrderFilter;
  isLoading: boolean;
  error: string | null;

  // Actions - Order management
  setOrders: (orders: OnlineOrder[]) => void;
  addOrder: (order: OnlineOrder) => void;
  updateOrder: (orderId: string, updates: Partial<OnlineOrder>) => void;
  removeOrder: (orderId: string) => void;
  setSelectedOrder: (order: OnlineOrder | null) => void;

  // Actions - Filtering
  setFilter: (filter: Partial<OnlineOrderFilter>) => void;
  resetFilter: () => void;

  // Actions - Order operations
  confirmOrder: (orderId: string, prepTime?: number) => Promise<void>;
  rejectOrder: (orderId: string, reason: string) => Promise<void>;
  markPreparing: (orderId: string) => Promise<void>;
  markReady: (orderId: string) => Promise<void>;

  // Actions - Loading & Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getFilteredOrders: () => OnlineOrder[];
  getOrderById: (orderId: string) => OnlineOrder | undefined;
  getStats: () => OnlineOrderStats;
}

const defaultFilter: OnlineOrderFilter = {
  status: 'all',
};

export const useOnlineOrderStore = create<OnlineOrderStore>((set, get) => ({
  // Initial state
  orders: [],
  selectedOrder: null,
  filter: defaultFilter,
  isLoading: false,
  error: null,

  // Order management
  setOrders: (orders) => set({ orders }),

  addOrder: (order) => {
    set((state) => ({
      orders: [order, ...state.orders],
    }));
  },

  updateOrder: (orderId, updates) => {
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, ...updates } : order
      ),
    }));
  },

  removeOrder: (orderId) => {
    set((state) => ({
      orders: state.orders.filter((order) => order.id !== orderId),
    }));
  },

  setSelectedOrder: (order) => set({ selectedOrder: order }),

  // Filtering
  setFilter: (filter) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  resetFilter: () => set({ filter: defaultFilter }),

  // Order operations
  confirmOrder: async (orderId, prepTime = 20) => {
    console.log('[OnlineOrderStore] Confirm order:', orderId, prepTime);

    // Find the order
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) {
      console.error('[OnlineOrderStore] Order not found:', orderId);
      return;
    }

    // Update local state
    const confirmedAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'confirmed' as OnlineOrderStatus, confirmedAt }
          : o
      ),
    }));

    // Transform to KitchenOrder and send to KDS + KOT printing
    try {
      // Transform online order to KitchenOrder format
      const kitchenOrderPartial = transformOnlineToKitchenOrder({
        ...order,
        status: 'confirmed',
        confirmedAt,
      });

      // Override prep time if provided
      if (prepTime) {
        kitchenOrderPartial.estimatedPrepTime = prepTime;
      }

      // Validate transformation
      if (!validateKitchenOrder(kitchenOrderPartial)) {
        console.error('[OnlineOrderStore] Invalid KitchenOrder transformation');
      } else {
        // Create complete KitchenOrder with ID
        const kitchenOrder = createKitchenOrderWithId(kitchenOrderPartial);

        console.log('[OnlineOrderStore] KitchenOrder created:', kitchenOrder);

        // Add to KDS store
        useKDSStore.getState().addOrder(kitchenOrder);
        console.log('[OnlineOrderStore] Order sent to KDS');

        // Trigger KOT printing if auto-print enabled
        const printerConfig = usePrinterStore.getState().config;
        if (printerConfig.autoPrintOnAccept) {
          try {
            console.log('[OnlineOrderStore] Printing KOT...');
            await printerService.print(kitchenOrder);
            usePrinterStore.getState().addPrintHistory(
              kitchenOrder.id,
              kitchenOrder.orderNumber,
              true
            );
            console.log('[OnlineOrderStore] KOT printed successfully');
          } catch (printError) {
            // Silent continue - don't fail order if print fails
            console.error('[OnlineOrderStore] KOT print failed:', printError);
            usePrinterStore.getState().addPrintHistory(
              kitchenOrder.id,
              kitchenOrder.orderNumber,
              false
            );
          }
        }
      }
    } catch (transformError) {
      // Log transformation/KDS errors but don't fail the confirmation
      console.error('[OnlineOrderStore] Failed to send order to KDS:', transformError);
    }
  },

  rejectOrder: async (orderId, reason) => {
    console.log('[OnlineOrderStore] Reject order:', orderId, reason);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId
          ? { ...order, status: 'cancelled' as OnlineOrderStatus }
          : order
      ),
    }));
  },

  markPreparing: async (orderId) => {
    console.log('[OnlineOrderStore] Mark preparing:', orderId);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId
          ? { ...order, status: 'preparing' as OnlineOrderStatus }
          : order
      ),
    }));
  },

  markReady: async (orderId) => {
    console.log('[OnlineOrderStore] Mark ready:', orderId);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId
          ? { ...order, status: 'ready' as OnlineOrderStatus }
          : order
      ),
    }));
  },

  // Loading & Error
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Computed
  getFilteredOrders: () => {
    const { orders, filter } = get();
    let filtered = orders;

    // Filter by status
    if (filter.status !== 'all') {
      filtered = filtered.filter((order) => order.status === filter.status);
    }

    // Sort by creation date (newest first)
    return filtered.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },

  getOrderById: (orderId) => {
    return get().orders.find((order) => order.id === orderId);
  },

  getStats: () => {
    const orders = get().orders;
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      preparing: orders.filter((o) => o.status === 'preparing').length,
      ready: orders.filter((o) => o.status === 'ready').length,
    };
  },
}));
