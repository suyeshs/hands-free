/**
 * Aggregator Order Store
 * Manages live orders from Zomato and Swiggy
 */

import { create } from 'zustand';
import {
  AggregatorOrder,
  AggregatorFilter,
  AggregatorOrderStatus,
  AggregatorStats,
} from '../types/aggregator';
import { transformAggregatorToKitchenOrder, createKitchenOrderWithId, validateKitchenOrder } from '../lib/orderTransformations';
import { useKDSStore } from './kdsStore';
import { printerService } from '../lib/printerService';
import { usePrinterStore } from './printerStore';
import { useAggregatorSettingsStore } from './aggregatorSettingsStore';

interface AggregatorStore {
  // State
  orders: AggregatorOrder[];
  selectedOrder: AggregatorOrder | null;
  filter: AggregatorFilter;
  isLoading: boolean;
  error: string | null;

  // WebSocket connection state
  isConnected: boolean;
  reconnectAttempts: number;

  // Actions - Order management
  setOrders: (orders: AggregatorOrder[]) => void;
  addOrder: (order: AggregatorOrder) => void;
  updateOrder: (orderId: string, updates: Partial<AggregatorOrder>) => void;
  removeOrder: (orderId: string) => void;
  setSelectedOrder: (order: AggregatorOrder | null) => void;

  // Actions - Filtering
  setFilter: (filter: Partial<AggregatorFilter>) => void;
  resetFilter: () => void;

  // Actions - Order operations (to be called via API)
  acceptOrder: (orderId: string, prepTime?: number) => Promise<void>;
  rejectOrder: (orderId: string, reason: string) => Promise<void>;
  markPreparing: (orderId: string) => Promise<void>;
  markReady: (orderId: string) => Promise<void>;

  // Actions - WebSocket
  setConnected: (connected: boolean) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;

  // Actions - Loading & Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getFilteredOrders: () => AggregatorOrder[];
  getOrderById: (orderId: string) => AggregatorOrder | undefined;
  getStats: () => AggregatorStats;
}

const defaultFilter: AggregatorFilter = {
  aggregator: 'all',
  status: 'all',
};

export const useAggregatorStore = create<AggregatorStore>((set, get) => ({
  // Initial state
  orders: [],
  selectedOrder: null,
  filter: defaultFilter,
  isLoading: false,
  error: null,
  isConnected: false,
  reconnectAttempts: 0,

  // Order management
  setOrders: (orders) => set({ orders }),

  addOrder: (order) => {
    set((state) => ({
      orders: [order, ...state.orders],
    }));

    // Phase 4: Auto-accept evaluation
    try {
      const { shouldAutoAccept, showAcceptNotification } = useAggregatorSettingsStore.getState();
      const matchResult = shouldAutoAccept(order);

      if (matchResult.matched && matchResult.rule) {
        console.log('[AggregatorStore] Auto-accepting order:', order.orderId, matchResult.reason);

        // Auto-accept the order asynchronously
        setTimeout(() => {
          get().acceptOrder(order.orderId, matchResult.prepTime || matchResult.rule!.prepTime);
        }, 100);

        // Show notification if enabled
        if (showAcceptNotification) {
          console.log(`[AggregatorStore] Auto-accepted: ${order.orderNumber} (Rule: ${matchResult.rule.name})`);
          // TODO: Show toast notification when UI component is available
        }
      }
    } catch (autoAcceptError) {
      // Log error but don't fail order addition
      console.error('[AggregatorStore] Auto-accept evaluation failed:', autoAcceptError);
    }
  },

  updateOrder: (orderId, updates) => {
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId ? { ...order, ...updates } : order
      ),
    }));
  },

  removeOrder: (orderId) => {
    set((state) => ({
      orders: state.orders.filter((order) => order.orderId !== orderId),
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

  // Order operations (placeholders - will be implemented with API calls)
  acceptOrder: async (orderId, prepTime = 20) => {
    console.log('[AggregatorStore] Accept order:', orderId, prepTime);

    // Find the order
    const order = get().orders.find((o) => o.orderId === orderId);
    if (!order) {
      console.error('[AggregatorStore] Order not found:', orderId);
      return;
    }

    // Update local state
    const acceptedAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((o) =>
        o.orderId === orderId
          ? { ...o, status: 'confirmed' as AggregatorOrderStatus, acceptedAt }
          : o
      ),
    }));

    // Phase 2 & 3: Transform to KitchenOrder and send to KDS + KOT printing
    try {
      // Transform aggregator order to KitchenOrder format
      const kitchenOrderPartial = transformAggregatorToKitchenOrder({
        ...order,
        status: 'confirmed',
        acceptedAt,
      });

      // Override prep time if provided
      if (prepTime) {
        kitchenOrderPartial.estimatedPrepTime = prepTime;
      }

      // Validate transformation
      if (!validateKitchenOrder(kitchenOrderPartial)) {
        console.error('[AggregatorStore] Invalid KitchenOrder transformation');
      } else {
        // Create complete KitchenOrder with ID
        const kitchenOrder = createKitchenOrderWithId(kitchenOrderPartial);

        console.log('[AggregatorStore] KitchenOrder created:', kitchenOrder);

        // Add to KDS store
        useKDSStore.getState().addOrder(kitchenOrder);
        console.log('[AggregatorStore] Order sent to KDS');

        // Trigger KOT printing if auto-print enabled
        const printerConfig = usePrinterStore.getState().config;
        if (printerConfig.autoPrintOnAccept) {
          try {
            console.log('[AggregatorStore] Printing KOT...');
            await printerService.print(kitchenOrder);
            usePrinterStore.getState().addPrintHistory(
              kitchenOrder.id,
              kitchenOrder.orderNumber,
              true
            );
            console.log('[AggregatorStore] KOT printed successfully');
          } catch (printError) {
            // Silent continue - don't fail order if print fails
            console.error('[AggregatorStore] KOT print failed:', printError);
            usePrinterStore.getState().addPrintHistory(
              kitchenOrder.id,
              kitchenOrder.orderNumber,
              false
            );
          }
        }
      }
    } catch (transformError) {
      // Log transformation/KDS errors but don't fail the acceptance
      console.error('[AggregatorStore] Failed to send order to KDS:', transformError);
    }
  },

  rejectOrder: async (orderId, reason) => {
    // TODO: Phase 4 - Call backend API
    console.log('[AggregatorStore] Reject order:', orderId, reason);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'cancelled' as AggregatorOrderStatus }
          : order
      ),
    }));
  },

  markPreparing: async (orderId) => {
    // TODO: Phase 4 - Call backend API
    console.log('[AggregatorStore] Mark preparing:', orderId);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'preparing' as AggregatorOrderStatus }
          : order
      ),
    }));
  },

  markReady: async (orderId) => {
    // TODO: Phase 4 - Call backend API
    console.log('[AggregatorStore] Mark ready:', orderId);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'ready' as AggregatorOrderStatus }
          : order
      ),
    }));
  },

  // WebSocket
  setConnected: (connected) => set({ isConnected: connected }),
  incrementReconnectAttempts: () =>
    set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),

  // Loading & Error
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Computed
  getFilteredOrders: () => {
    const { orders, filter } = get();
    let filtered = orders;

    // Filter by aggregator
    if (filter.aggregator !== 'all') {
      filtered = filtered.filter(
        (order) => order.aggregator === filter.aggregator
      );
    }

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
    return get().orders.find((order) => order.orderId === orderId);
  },

  getStats: () => {
    const orders = get().orders;
    return {
      total: orders.length,
      new: orders.filter((o) => o.status === 'pending').length,
      preparing: orders.filter((o) => o.status === 'preparing').length,
      ready: orders.filter((o) => o.status === 'ready').length,
    };
  },
}));
