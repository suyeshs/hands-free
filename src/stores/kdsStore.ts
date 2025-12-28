/**
 * Kitchen Display System Store
 * Manages kitchen orders and item statuses
 *
 * Uses BroadcastChannel to sync orders between browser tabs on the same device
 * Uses SQLite persistence to maintain orders across view switches in generic mode
 */

import { create } from 'zustand';
import {
  KitchenOrder,
  KitchenStation,
  KitchenStats,
  KitchenItemStatus,
} from '../types/kds';
import { backendApi } from '../lib/backendApi';
import { kdsOrderService } from '../lib/kdsOrderService';

// BroadcastChannel for same-device tab sync
const KDS_CHANNEL_NAME = 'kds-orders-sync';
let kdsChannel: BroadcastChannel | null = null;

// Initialize BroadcastChannel if supported
if (typeof BroadcastChannel !== 'undefined') {
  try {
    kdsChannel = new BroadcastChannel(KDS_CHANNEL_NAME);
    console.log('[KDSStore] BroadcastChannel initialized for tab sync');
  } catch (e) {
    console.warn('[KDSStore] BroadcastChannel not available:', e);
  }
}

// Broadcast order to other tabs
function broadcastToTabs(type: string, payload: any) {
  if (kdsChannel) {
    try {
      kdsChannel.postMessage({ type, payload, timestamp: Date.now() });
    } catch (e) {
      console.warn('[KDSStore] Failed to broadcast to tabs:', e);
    }
  }
}

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
  addOrder: (order: KitchenOrder, fromBroadcast?: boolean) => void;
  updateOrder: (orderId: string, updates: Partial<KitchenOrder>) => void;
  removeOrder: (orderId: string, fromBroadcast?: boolean) => void; // Cancel/delete an order
  moveToCompleted: (orderId: string, fromBroadcast?: boolean) => void;

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

  // Check if at least one KOT for a table has been completed (for billing eligibility)
  hasAnyCompletedKotForTable: (tableNumber: number) => boolean;

  // Get aggregated order status for a table (for POS display)
  getOrderStatusForTable: (tableNumber: number) => {
    status: 'pending' | 'in_progress' | 'ready' | 'completed' | null;
    readyItemCount: number;
    totalItemCount: number;
    hasRunningOrder: boolean;
  };

  // Get item statuses for a table (for POS running order display)
  // Maps item name + quantity to status from KDS
  getItemStatusesForTable: (tableNumber: number) => Map<string, KitchenItemStatus>;

  // SQLite persistence for orders (for generic device mode)
  loadOrdersFromDb: (tenantId: string) => Promise<void>;
  persistOrderToDb: (tenantId: string, order: KitchenOrder) => Promise<void>;
  removeOrderFromDb: (orderId: string) => Promise<void>;

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

  addOrder: (order, fromBroadcast = false) => {
    set((state) => {
      // Skip if order already exists (by id or orderNumber)
      const exists = state.activeOrders.some(
        (o) => o.id === order.id || o.orderNumber === order.orderNumber
      );
      if (exists) {
        console.log('[KDSStore] Skipping duplicate order:', order.orderNumber);
        return state;
      }

      // Broadcast to other tabs (only if not already from a broadcast)
      if (!fromBroadcast) {
        broadcastToTabs('add_order', order);
      }

      console.log('[KDSStore] Adding order:', order.orderNumber, fromBroadcast ? '(from tab sync)' : '');

      // Persist to SQLite (get tenantId from authStore)
      // This is async but we don't wait for it - fire and forget
      import('./authStore').then(({ useAuthStore }) => {
        const tenantId = useAuthStore.getState().user?.tenantId;
        if (tenantId) {
          kdsOrderService.saveOrder(tenantId, order).catch((e) => {
            console.error('[KDSStore] Failed to persist order to SQLite:', e);
          });
        }
      });

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

  removeOrder: (orderId, fromBroadcast = false) => {
    console.log('[KDSStore] Removing order:', orderId);
    if (!fromBroadcast) {
      broadcastToTabs('remove_order', orderId);
    }
    // Also delete from SQLite
    kdsOrderService.deleteOrder(orderId).catch((e) => {
      console.error('[KDSStore] Failed to delete order from SQLite:', e);
    });
    set((state) => ({
      activeOrders: state.activeOrders.filter((order) => order.id !== orderId),
    }));
  },

  moveToCompleted: (orderId, fromBroadcast = false) => {
    set((state) => {
      const order = state.activeOrders.find((o) => o.id === orderId);
      if (!order) return state;

      if (!fromBroadcast) {
        broadcastToTabs('move_to_completed', orderId);
      }

      // Update status in SQLite
      kdsOrderService.updateOrderStatus(orderId, 'completed', {
        completedAt: new Date().toISOString(),
      }).catch((e) => {
        console.error('[KDSStore] Failed to update order status in SQLite:', e);
      });

      return {
        activeOrders: state.activeOrders.filter((o) => o.id !== orderId),
        completedOrders: [order, ...state.completedOrders].slice(0, 50), // Keep last 50
      };
    });
  },

  // Item management
  markItemStatus: (orderId, itemId, status) => {
    // Also persist to SQLite
    kdsOrderService.updateItemStatus(orderId, itemId, status).catch((e) => {
      console.error('[KDSStore] Failed to update item status in SQLite:', e);
    });

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

      // Get the order to extract item name and table info for notification
      const order = get().activeOrders.find((o) => o.id === orderId);
      const item = order?.items.find((i) => i.id === itemId);

      // Call backend API
      const { order: updatedOrder } = await backendApi.markKitchenItemReady(orderId, itemId);

      // Update local state with server response
      get().updateOrder(orderId, updatedOrder);

      // Persist item status to SQLite
      kdsOrderService.updateItemStatus(orderId, itemId, 'ready').catch((e) => {
        console.error('[KDSStore] Failed to persist item status to SQLite:', e);
      });

      // Broadcast item ready notification to service staff
      if (order && item) {
        try {
          const { orderSyncService } = await import('../lib/orderSyncService');
          orderSyncService.broadcastItemReady(
            orderId,
            itemId,
            item.name,
            order.orderNumber,
            order.tableNumber ?? undefined,
            undefined // assignedStaffId - could be looked up from floorPlanStore if needed
          );
          console.log('[KDSStore] ✓ Broadcast item ready:', item.name);
        } catch (broadcastError) {
          console.error('[KDSStore] Failed to broadcast item ready:', broadcastError);
        }
      }

      // NOTE: We do NOT auto-complete orders when all items are ready
      // For dine-in, customers may add more items to their table order
      // Staff must manually bump/complete the KOT when ready to serve

    } catch (error) {
      console.error('[KDSStore] Failed to mark item ready:', error);
      // Optimistically update UI anyway
      get().markItemStatus(orderId, itemId, 'ready');

      // Still try to broadcast even if backend failed
      const order = get().activeOrders.find((o) => o.id === orderId);
      const item = order?.items.find((i) => i.id === itemId);
      if (order && item) {
        try {
          const { orderSyncService } = await import('../lib/orderSyncService');
          orderSyncService.broadcastItemReady(
            orderId,
            itemId,
            item.name,
            order.orderNumber,
            order.tableNumber ?? undefined,
            undefined
          );
        } catch (broadcastError) {
          console.error('[KDSStore] Failed to broadcast item ready:', broadcastError);
        }
      }
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

      console.log('[KDSStore] Order source:', order.source, 'orderNumber:', order.orderNumber, 'tableNumber:', order.tableNumber);

      // Update local KDS state FIRST (optimistic update)
      get().updateOrder(orderId, { status: 'completed' });
      get().moveToCompleted(orderId);

      // IMPORTANT: Broadcast status update to other devices via WebSocket
      // Do this BEFORE backend API call so sync happens even if backend fails
      try {
        const { orderSyncService } = await import('../lib/orderSyncService');
        console.log('[KDSStore] Broadcasting order completion...');
        await orderSyncService.broadcastStatusUpdate(orderId, 'completed', {
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber ?? undefined,
          orderType: order.orderType,
        });
        console.log('[KDSStore] ✓ Broadcast order completion to other devices');
      } catch (broadcastError) {
        console.error('[KDSStore] Failed to broadcast order completion:', broadcastError);
      }

      // Call backend API (non-blocking, best-effort)
      try {
        await backendApi.completeKitchenOrder(orderId);
        console.log('[KDSStore] ✓ Backend API updated');
      } catch (apiError) {
        console.warn('[KDSStore] Backend API failed (non-critical):', apiError);
      }

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

  hasAnyCompletedKotForTable: (tableNumber) => {
    const { completedOrders } = get();
    // Check if at least one KOT for this table has been completed
    // This allows billing to start after the first KOT is done
    const completedKots = completedOrders.filter(
      (order) =>
        order.orderType === 'dine-in' &&
        order.tableNumber === tableNumber
    );
    return completedKots.length > 0;
  },

  getOrderStatusForTable: (tableNumber) => {
    const { activeOrders } = get();

    // Find all active orders for this table
    const tableOrders = activeOrders.filter(
      (order) =>
        order.orderType === 'dine-in' &&
        order.tableNumber === tableNumber &&
        order.status !== 'completed'
    );

    // If no orders, return null status
    if (tableOrders.length === 0) {
      return {
        status: null,
        readyItemCount: 0,
        totalItemCount: 0,
        hasRunningOrder: false,
      };
    }

    // Aggregate all items from all KOTs for this table
    const allItems = tableOrders.flatMap((order) => order.items);
    const totalItemCount = allItems.length;
    const readyItemCount = allItems.filter((item) => item.status === 'ready').length;
    const inProgressCount = allItems.filter((item) => item.status === 'in_progress').length;
    const pendingCount = allItems.filter((item) => item.status === 'pending').length;
    const hasRunningOrder = tableOrders.some((order) => order.isRunningOrder);

    // Determine aggregate status
    let status: 'pending' | 'in_progress' | 'ready' | 'completed';
    if (readyItemCount === totalItemCount) {
      status = 'ready';
    } else if (inProgressCount > 0 || readyItemCount > 0) {
      status = 'in_progress';
    } else if (pendingCount === totalItemCount) {
      status = 'pending';
    } else {
      status = 'in_progress'; // Default to in_progress if mixed state
    }

    return {
      status,
      readyItemCount,
      totalItemCount,
      hasRunningOrder,
    };
  },

  getItemStatusesForTable: (tableNumber) => {
    const { activeOrders, completedOrders } = get();
    const itemStatusMap = new Map<string, KitchenItemStatus>();

    // Check both active and completed orders for this table
    const allTableOrders = [
      ...activeOrders.filter(
        (order) =>
          order.orderType === 'dine-in' &&
          order.tableNumber === tableNumber
      ),
      ...completedOrders.filter(
        (order) =>
          order.orderType === 'dine-in' &&
          order.tableNumber === tableNumber
      ),
    ];

    // Build a map of item name -> status
    // Using item name as key since POS cart items don't have KDS item IDs
    for (const order of allTableOrders) {
      for (const item of order.items) {
        // Use item name + index as key to handle duplicates
        const key = `${item.name}`;
        const existingStatus = itemStatusMap.get(key);

        // Priority: ready > in_progress > pending
        // If item appears multiple times, use the "best" status
        if (!existingStatus) {
          itemStatusMap.set(key, item.status);
        } else if (
          item.status === 'ready' ||
          (item.status === 'in_progress' && existingStatus === 'pending')
        ) {
          itemStatusMap.set(key, item.status);
        }
      }
    }

    return itemStatusMap;
  },

  // SQLite persistence methods
  loadOrdersFromDb: async (tenantId: string) => {
    try {
      console.log('[KDSStore] Loading orders from SQLite for tenant:', tenantId);
      const { active, completed } = await kdsOrderService.getAllOrders(tenantId);

      // Calculate elapsed time and urgency for each order
      const activeWithTiming = active.map((order) => {
        const elapsedMinutes = Math.floor(
          (Date.now() - new Date(order.acceptedAt || order.createdAt).getTime()) /
            (1000 * 60)
        );
        return {
          ...order,
          elapsedMinutes,
          isUrgent: elapsedMinutes > (order.estimatedPrepTime || 15),
        };
      });

      set({
        activeOrders: activeWithTiming,
        completedOrders: completed,
      });
      console.log(`[KDSStore] Loaded ${active.length} active, ${completed.length} completed orders from SQLite`);
    } catch (error) {
      console.error('[KDSStore] Failed to load orders from SQLite:', error);
    }
  },

  persistOrderToDb: async (tenantId: string, order: KitchenOrder) => {
    try {
      await kdsOrderService.saveOrder(tenantId, order);
      console.log('[KDSStore] Persisted order to SQLite:', order.orderNumber);
    } catch (error) {
      console.error('[KDSStore] Failed to persist order to SQLite:', error);
    }
  },

  removeOrderFromDb: async (orderId: string) => {
    try {
      await kdsOrderService.deleteOrder(orderId);
      console.log('[KDSStore] Removed order from SQLite:', orderId);
    } catch (error) {
      console.error('[KDSStore] Failed to remove order from SQLite:', error);
    }
  },

  clearAllOrders: () => {
    console.log('[KDSStore] Clearing all orders');
    broadcastToTabs('clear_all', null);
    set({ activeOrders: [], completedOrders: [] });
  },
}));

// Listen for broadcasts from other tabs
if (kdsChannel) {
  kdsChannel.onmessage = (event) => {
    const { type, payload } = event.data;
    console.log('[KDSStore] Received tab broadcast:', type);

    switch (type) {
      case 'add_order':
        // Add order from another tab (with fromBroadcast=true to prevent echo)
        useKDSStore.getState().addOrder(payload, true);
        break;
      case 'remove_order':
        useKDSStore.getState().removeOrder(payload, true);
        break;
      case 'move_to_completed':
        useKDSStore.getState().moveToCompleted(payload, true);
        break;
      case 'clear_all':
        useKDSStore.setState({ activeOrders: [], completedOrders: [] });
        break;
      default:
        console.log('[KDSStore] Unknown broadcast type:', type);
    }
  };
}
