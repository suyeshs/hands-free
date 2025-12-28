/**
 * Kitchen Display System Store
 * Manages kitchen orders and item statuses
 */

import { create } from 'zustand';
import {
  KitchenOrder,
  KitchenStation,
  KitchenStats,
  KitchenItemStatus,
} from '../types/kds';
import { backendApi } from '../lib/backendApi';

interface KDSStore {
  // State
  activeOrders: KitchenOrder[];
  completedOrders: KitchenOrder[];
  selectedStation: KitchenStation;
  autoRefresh: boolean;
  refreshInterval: number; // In milliseconds
  isLoading: boolean;
  error: string | null;

  // Actions - Order management
  setActiveOrders: (orders: KitchenOrder[]) => void;
  addOrder: (order: KitchenOrder) => void;
  updateOrder: (orderId: string, updates: Partial<KitchenOrder>) => void;
  removeOrder: (orderId: string) => void; // Cancel/delete an order
  moveToCompleted: (orderId: string) => void;

  // Actions - Item management
  markItemStatus: (
    orderId: string,
    itemId: string,
    status: KitchenItemStatus
  ) => void;
  markItemReady: (orderId: string, itemId: string) => Promise<void>;
  markAllItemsReady: (orderId: string) => Promise<void>;

  // Actions - Order operations
  markOrderComplete: (orderId: string) => Promise<void>;
  refreshOrders: (tenantId?: string) => Promise<void>;
  fetchOrders: (tenantId: string, station?: string) => Promise<void>;

  // Actions - Settings
  setSelectedStation: (station: KitchenStation) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;

  // Actions - Loading & Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getFilteredOrders: () => KitchenOrder[];
  getOrderById: (orderId: string) => KitchenOrder | undefined;
  getStats: () => KitchenStats;
  getUrgentOrders: () => KitchenOrder[];

  // Check if all KOTs for a table are completed (none in activeOrders)
  areAllKotsCompletedForTable: (tableNumber: number) => boolean;

  // Clear all orders (for testing/cleanup)
  clearAllOrders: () => void;
}

export const useKDSStore = create<KDSStore>((set, get) => ({
  // Initial state
  activeOrders: [],
  completedOrders: [],
  selectedStation: 'all',
  autoRefresh: true,
  refreshInterval: 5000, // 5 seconds
  isLoading: false,
  error: null,

  // Order management
  setActiveOrders: (orders) => set({ activeOrders: orders }),

  addOrder: (order) => {
    set((state) => {
      // Skip if order already exists (by id or orderNumber)
      const exists = state.activeOrders.some(
        (o) => o.id === order.id || o.orderNumber === order.orderNumber
      );
      if (exists) {
        console.log('[KDSStore] Skipping duplicate order:', order.orderNumber);
        return state;
      }
      return { activeOrders: [order, ...state.activeOrders] };
    });
  },

  updateOrder: (orderId, updates) => {
    set((state) => ({
      activeOrders: state.activeOrders.map((order) =>
        order.id === orderId ? { ...order, ...updates } : order
      ),
    }));
  },

  removeOrder: (orderId) => {
    console.log('[KDSStore] Removing order:', orderId);
    set((state) => ({
      activeOrders: state.activeOrders.filter((order) => order.id !== orderId),
    }));
  },

  moveToCompleted: (orderId) => {
    set((state) => {
      const order = state.activeOrders.find((o) => o.id === orderId);
      if (!order) return state;

      return {
        activeOrders: state.activeOrders.filter((o) => o.id !== orderId),
        completedOrders: [order, ...state.completedOrders].slice(0, 50), // Keep last 50
      };
    });
  },

  // Item management
  markItemStatus: (orderId, itemId, status) => {
    set((state) => ({
      activeOrders: state.activeOrders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              items: order.items.map((item) =>
                item.id === itemId ? { ...item, status } : item
              ),
            }
          : order
      ),
    }));
  },

  markItemReady: async (orderId, itemId) => {
    try {
      console.log('[KDSStore] Mark item ready:', orderId, itemId);

      // Call backend API
      const { order } = await backendApi.markKitchenItemReady(orderId, itemId);

      // Update local state with server response
      get().updateOrder(orderId, order);
    } catch (error) {
      console.error('[KDSStore] Failed to mark item ready:', error);
      // Optimistically update UI anyway
      get().markItemStatus(orderId, itemId, 'ready');
    }
  },

  markAllItemsReady: async (orderId) => {
    try {
      console.log('[KDSStore] Mark all items ready:', orderId);

      // Call backend API
      const { order } = await backendApi.markAllKitchenItemsReady(orderId);

      // Update local state with server response
      get().updateOrder(orderId, {
        ...order,
        status: 'ready',
        readyAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[KDSStore] Failed to mark all items ready:', error);
      // Optimistically update UI anyway
      const order = get().activeOrders.find((o) => o.id === orderId);
      if (order) {
        order.items.forEach((item) => {
          get().markItemStatus(orderId, item.id, 'ready');
        });
        get().updateOrder(orderId, { status: 'ready', readyAt: new Date().toISOString() });
      }
    }
  },

  // Order operations
  markOrderComplete: async (orderId) => {
    try {
      console.log('[KDSStore] Mark order complete:', orderId);

      // Get the order to check its source
      const order = get().activeOrders.find((o) => o.id === orderId);
      if (!order) {
        console.error('[KDSStore] Order not found:', orderId);
        return;
      }

      console.log('[KDSStore] Order source:', order.source, 'orderNumber:', order.orderNumber);

      // Call backend API
      await backendApi.completeKitchenOrder(orderId);

      // Update local KDS state
      get().updateOrder(orderId, { status: 'completed' });
      get().moveToCompleted(orderId);

      // Propagate status update to source store
      try {
        if (order.source === 'pos') {
          console.log('[KDSStore] Updating POS order...');
          // Lazy import to avoid circular dependencies
          const { usePOSStore } = await import('./posStore');
          const currentState = usePOSStore.getState();

          // For dine-in orders, also update activeTables
          if (order.orderType === 'dine-in' && order.tableNumber) {
            console.log('[KDSStore] Updating activeTables for table:', order.tableNumber);
            const tableSession = currentState.activeTables[order.tableNumber];
            if (tableSession && tableSession.order) {
              const updatedSession = {
                ...tableSession,
                order: {
                  ...tableSession.order,
                  status: 'completed' as const,
                },
              };
              usePOSStore.setState({
                activeTables: {
                  ...currentState.activeTables,
                  [order.tableNumber]: updatedSession,
                },
              });
              console.log('[KDSStore] ✓ Updated activeTables for table:', order.tableNumber);

              // Persist to SQLite
              try {
                const { tableSessionService } = await import('../lib/tableSessionService');
                // Get tenantId from authStore
                const { useAuthStore } = await import('./authStore');
                const tenantId = useAuthStore.getState().user?.tenantId;
                if (tenantId) {
                  await tableSessionService.saveSession(tenantId, updatedSession);
                  console.log('[KDSStore] ✓ Persisted table session to SQLite');
                }
              } catch (persistError) {
                console.error('[KDSStore] Failed to persist table session:', persistError);
              }
            }
          }

          console.log('[KDSStore] Current POS recentOrders:', currentState.recentOrders.map(o => ({
            orderNumber: o.orderNumber,
            status: o.status
          })));

          // Update in recentOrders if found
          const updatedRecentOrders = currentState.recentOrders.map((posOrder) =>
            posOrder.orderNumber === order.orderNumber
              ? { ...posOrder, status: 'completed' as const }
              : posOrder
          );

          console.log('[KDSStore] Updated recentOrders:', updatedRecentOrders.map(o => ({
            orderNumber: o.orderNumber,
            status: o.status
          })));

          usePOSStore.setState({ recentOrders: updatedRecentOrders });
          console.log('[KDSStore] ✓ Updated POS order status:', order.orderNumber);
        } else if (order.source === 'zomato' || order.source === 'swiggy') {
          console.log('[KDSStore] Updating Aggregator order...');
          // Lazy import to avoid circular dependencies
          const { useAggregatorStore } = await import('./aggregatorStore');
          const currentState = useAggregatorStore.getState();

          console.log('[KDSStore] Current Aggregator orders:', currentState.orders.map(o => ({
            orderNumber: o.orderNumber,
            status: o.status
          })));

          // Find and update the aggregator order
          const matchingOrder = currentState.orders.find(
            (aggOrder) => aggOrder.orderNumber === order.orderNumber
          );

          if (matchingOrder) {
            console.log('[KDSStore] Found matching order:', matchingOrder.orderId);

            // Update using the store's updateOrder method
            const updatedOrders = currentState.orders.map((aggOrder) =>
              aggOrder.orderId === matchingOrder.orderId
                ? { ...aggOrder, status: 'completed' as const, readyAt: new Date().toISOString() }
                : aggOrder
            );

            useAggregatorStore.setState({ orders: updatedOrders });
            console.log('[KDSStore] ✓ Updated Aggregator order status:', order.orderNumber);
          } else {
            console.warn('[KDSStore] No matching aggregator order found for:', order.orderNumber);
          }
        } else if (order.source === 'online') {
          console.log('[KDSStore] Updating Online order...');
          // Lazy import to avoid circular dependencies
          const { useOnlineOrderStore } = await import('./onlineOrderStore');
          const currentState = useOnlineOrderStore.getState();

          console.log('[KDSStore] Current Online orders:', currentState.orders.map(o => ({
            orderNumber: o.orderNumber,
            status: o.status
          })));

          // Find and update the online order
          const matchingOrder = currentState.orders.find(
            (onlineOrder) => onlineOrder.orderNumber === order.orderNumber
          );

          if (matchingOrder) {
            console.log('[KDSStore] Found matching order:', matchingOrder.id);

            // Update using direct state mutation
            const updatedOrders = currentState.orders.map((onlineOrder) =>
              onlineOrder.id === matchingOrder.id
                ? { ...onlineOrder, status: 'completed' as const, completedAt: new Date().toISOString() }
                : onlineOrder
            );

            useOnlineOrderStore.setState({ orders: updatedOrders });
            console.log('[KDSStore] ✓ Updated Online order status:', order.orderNumber);
          } else {
            console.warn('[KDSStore] No matching online order found for:', order.orderNumber);
          }
        }
      } catch (propagateError) {
        // Log but don't fail - KDS update succeeded
        console.error('[KDSStore] Failed to propagate status to source store:', propagateError);
      }
    } catch (error) {
      console.error('[KDSStore] Failed to mark order complete:', error);
      // Optimistically update UI anyway
      get().updateOrder(orderId, { status: 'completed' });
      get().moveToCompleted(orderId);
    }
  },

  fetchOrders: async (tenantId, station) => {
    try {
      set({ isLoading: true, error: null });
      console.log('[KDSStore] Fetching kitchen orders for tenant:', tenantId);

      const { orders } = await backendApi.getKitchenOrders(tenantId, station);

      // Calculate elapsed time and urgency for each order
      const ordersWithTiming = orders.map((order) => ({
        ...order,
        elapsedMinutes: Math.floor(
          (Date.now() - new Date(order.acceptedAt || order.createdAt).getTime()) /
            (1000 * 60)
        ),
        isUrgent: false, // Will be calculated below
      })).map((order) => ({
        ...order,
        isUrgent: order.elapsedMinutes > (order.estimatedPrepTime || 15),
      }));

      // MERGE: Keep locally-added orders (from aggregators) that aren't in API response
      // Local orders have IDs starting with 'kitchen-' from createKitchenOrderWithId
      const currentOrders = get().activeOrders;
      const localOrders = currentOrders.filter(
        (o) => o.id.startsWith('kitchen-') && !ordersWithTiming.some((api) => api.id === o.id)
      );

      // Update elapsed times for local orders too
      const localOrdersWithTiming = localOrders.map((order) => ({
        ...order,
        elapsedMinutes: Math.floor(
          (Date.now() - new Date(order.acceptedAt || order.createdAt).getTime()) /
            (1000 * 60)
        ),
        isUrgent: order.elapsedMinutes > (order.estimatedPrepTime || 15),
      }));

      // Combine: local orders first (newest), then API orders
      const mergedOrders = [...localOrdersWithTiming, ...ordersWithTiming];
      console.log('[KDSStore] Merged orders:', mergedOrders.length, '(local:', localOrdersWithTiming.length, ', API:', ordersWithTiming.length, ')');

      set({ activeOrders: mergedOrders, isLoading: false });
    } catch (error) {
      console.error('[KDSStore] Failed to fetch kitchen orders:', error);
      // On API error, don't wipe local orders - just update their timings
      set((state) => ({
        activeOrders: state.activeOrders.map((order) => ({
          ...order,
          elapsedMinutes: Math.floor(
            (Date.now() - new Date(order.acceptedAt || order.createdAt).getTime()) /
              (1000 * 60)
          ),
        })),
        error: error instanceof Error ? error.message : 'Failed to fetch orders',
        isLoading: false,
      }));
    }
  },

  refreshOrders: async (tenantId) => {
    if (!tenantId) {
      // Just update elapsed times for existing orders
      console.log('[KDSStore] Refresh elapsed times');
      set((state) => ({
        activeOrders: state.activeOrders.map((order) => {
          const elapsedMinutes = Math.floor(
            (Date.now() - new Date(order.acceptedAt || order.createdAt).getTime()) /
              (1000 * 60)
          );
          return {
            ...order,
            elapsedMinutes,
            isUrgent: elapsedMinutes > (order.estimatedPrepTime || 15),
          };
        }),
      }));
    } else {
      // Fetch fresh data from API
      await get().fetchOrders(tenantId, get().selectedStation === 'all' ? undefined : get().selectedStation);
    }
  },

  // Settings
  setSelectedStation: (station) => set({ selectedStation: station }),
  setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),
  setRefreshInterval: (interval) => set({ refreshInterval: interval }),

  // Loading & Error
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Computed
  getFilteredOrders: () => {
    const { activeOrders, selectedStation } = get();

    if (selectedStation === 'all') {
      return activeOrders;
    }

    // Filter orders that have items for the selected station
    return activeOrders.filter((order) =>
      order.items.some(
        (item) => item.station?.toLowerCase() === selectedStation
      )
    );
  },

  getOrderById: (orderId) => {
    return get().activeOrders.find((order) => order.id === orderId);
  },

  getStats: () => {
    const orders = get().activeOrders;
    const pendingItems = orders.reduce(
      (count, order) =>
        count + order.items.filter((item) => item.status === 'pending').length,
      0
    );

    const avgPrepTime =
      orders.length > 0
        ? orders.reduce((sum, order) => sum + order.elapsedMinutes, 0) /
          orders.length
        : 0;

    const oldestOrderMinutes =
      orders.length > 0
        ? Math.max(...orders.map((order) => order.elapsedMinutes))
        : 0;

    return {
      activeOrders: orders.length,
      pendingItems,
      averagePrepTime: Math.round(avgPrepTime),
      oldestOrderMinutes,
    };
  },

  getUrgentOrders: () => {
    return get().activeOrders.filter((order) => order.isUrgent);
  },

  areAllKotsCompletedForTable: (tableNumber) => {
    const { activeOrders } = get();
    // Check if there are any active (non-completed) KDS orders for this table
    const pendingKots = activeOrders.filter(
      (order) =>
        order.orderType === 'dine-in' &&
        order.tableNumber === tableNumber &&
        order.status !== 'completed'
    );
    // Return true only if there are NO pending KOTs for this table
    return pendingKots.length === 0;
  },

  clearAllOrders: () => {
    console.log('[KDSStore] Clearing all orders');
    set({ activeOrders: [], completedOrders: [] });
  },
}));
