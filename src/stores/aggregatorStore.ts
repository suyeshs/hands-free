/**
 * Aggregator Order Store
 * Manages live orders from Zomato and Swiggy
 * Persists orders to local SQLite database
 */

import { create } from 'zustand';
import {
  AggregatorOrder,
  AggregatorFilter,
  AggregatorOrderStatus,
  AggregatorStats,
  AggregatorSource,
} from '../types/aggregator';
import { transformAggregatorToKitchenOrder, createKitchenOrderWithId, validateKitchenOrder } from '../lib/orderTransformations';
import { useKDSStore } from './kdsStore';
import { printerService } from '../lib/printerService';
import { usePrinterStore } from './printerStore';
import { useAggregatorSettingsStore } from './aggregatorSettingsStore';
import { aggregatorOrderDb } from '../lib/aggregatorOrderDb';
import { isTauri } from '../lib/platform';
import { getAggregatorOrdersFromCloud, archiveAggregatorOrderInCloud, archiveAllAggregatorOrdersInCloud } from '../lib/handsfreeApi';
import { useTenantStore } from './tenantStore';

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
  mergeOrders: (apiOrders: AggregatorOrder[]) => void;
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
  markReady: (orderId: string, tenantId?: string) => Promise<void>;
  markPickedUp: (orderId: string) => Promise<void>;
  markOutForDelivery: (orderId: string) => Promise<void>;
  markDelivered: (orderId: string) => Promise<void>;
  markCompleted: (orderId: string) => Promise<void>;
  dismissOrder: (orderId: string) => Promise<void>;

  // Actions - WebSocket
  setConnected: (connected: boolean) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;

  // Actions - Loading & Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Actions - Persistence
  loadOrdersFromDb: () => Promise<void>;
  fetchFromCloud: (tenantId: string) => Promise<void>;
  archiveAllOrders: (tenantId: string) => Promise<{ archived: number }>;

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

  // Merge orders from API with existing local orders
  // This preserves locally-extracted orders (from Tauri) while adding API orders
  mergeOrders: (apiOrders) => {
    set((state) => {
      // Create a map of existing orders by orderId and orderNumber for dedup
      const existingByOrderId = new Map(state.orders.map((o) => [o.orderId, o]));
      const existingByOrderNumber = new Map(state.orders.map((o) => [o.orderNumber, o]));

      // Filter API orders to only include ones we don't have
      const newApiOrders = apiOrders.filter((apiOrder) => {
        const existsById = existingByOrderId.has(apiOrder.orderId);
        const existsByNumber = existingByOrderNumber.has(apiOrder.orderNumber);
        return !existsById && !existsByNumber;
      });

      // Update existing orders with fresher API data (if status changed)
      const updatedOrders = state.orders.map((existing) => {
        const apiVersion = apiOrders.find(
          (api) => api.orderId === existing.orderId || api.orderNumber === existing.orderNumber
        );
        // If API has newer status, update it (but keep local data intact)
        if (apiVersion && apiVersion.status !== existing.status) {
          return { ...existing, status: apiVersion.status };
        }
        return existing;
      });

      const merged = [...updatedOrders, ...newApiOrders];
      console.log(
        `[AggregatorStore] Merged: ${state.orders.length} existing + ${newApiOrders.length} new from API = ${merged.length} total`
      );

      return { orders: merged };
    });
  },

  addOrder: (order) => {
    // Check if order already exists
    const exists = get().orders.some(
      (o) => o.orderNumber === order.orderNumber || o.orderId === order.orderId
    );
    if (exists) {
      console.log('[AggregatorStore] Skipping duplicate order:', order.orderNumber);
      return;
    }

    // Add to state
    set((state) => ({ orders: [order, ...state.orders] }));

    // Persist to local database (async, non-blocking)
    if (isTauri()) {
      aggregatorOrderDb.save(order).catch((err) => {
        console.error('[AggregatorStore] Failed to persist order:', err);
      });
    }

    // IMMEDIATELY send order to KDS - no manual acceptance needed
    // All aggregator orders go directly to kitchen for preparation
    console.log('[AggregatorStore] Auto-sending order to KDS:', order.orderId);

    // Get default prep time from settings, or use 15 minutes default
    const { defaultPrepTime } = useAggregatorSettingsStore.getState();
    const prepTime = defaultPrepTime || 15;

    // Accept the order asynchronously (this sends to KDS)
    setTimeout(() => {
      get().acceptOrder(order.orderId, prepTime);
    }, 100);

    // Play loud notification sound for new delivery order
    import('./notificationStore').then(({ useNotificationStore }) => {
      const { playSound } = useNotificationStore.getState();
      // Play new_order sound (loud notification)
      playSound('new_order');
      console.log('[AggregatorStore] Played new order notification sound');
    }).catch((soundError) => {
      console.warn('[AggregatorStore] Could not play notification sound:', soundError);
    });
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

    // Persist status change to database
    if (isTauri()) {
      aggregatorOrderDb.updateStatus(orderId, 'confirmed', { acceptedAt }).catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });
    }

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

        // Broadcast to other devices (KDS tablets, etc.) via cloud WebSocket
        try {
          const { orderSyncService } = await import('../lib/orderSyncService');
          const result = await orderSyncService.broadcastOrder(
            { orderId: order.orderId, orderNumber: order.orderNumber } as any,
            kitchenOrder
          );
          const paths = [];
          if (result.cloud) paths.push('cloud');
          if (result.lan > 0) paths.push(`${result.lan} LAN`);
          if (paths.length > 0) {
            console.log(`[AggregatorStore] Order broadcast to: ${paths.join(', ')}`);
          }
        } catch (syncError) {
          console.warn('[AggregatorStore] Broadcast failed (non-critical):', syncError);
        }

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
    console.log('[AggregatorStore] Reject order:', orderId, reason);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'cancelled' as AggregatorOrderStatus }
          : order
      ),
    }));

    // Persist status change
    if (isTauri()) {
      aggregatorOrderDb.updateStatus(orderId, 'cancelled').catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });
    }
  },

  markPreparing: async (orderId) => {
    console.log('[AggregatorStore] Mark preparing:', orderId);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'preparing' as AggregatorOrderStatus }
          : order
      ),
    }));

    // Persist status change
    if (isTauri()) {
      aggregatorOrderDb.updateStatus(orderId, 'preparing').catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });
    }
  },

  markReady: async (orderId, tenantId) => {
    console.log('[AggregatorStore] Mark ready:', orderId);
    const readyAt = new Date().toISOString();

    // Find the order for sales recording
    const order = get().orders.find((o) => o.orderId === orderId);

    // Update status to pending_pickup (awaiting delivery partner)
    set((state) => ({
      orders: state.orders.map((o) =>
        o.orderId === orderId
          ? { ...o, status: 'pending_pickup' as AggregatorOrderStatus, readyAt }
          : o
      ),
    }));

    // Persist status change
    if (isTauri()) {
      aggregatorOrderDb.updateStatus(orderId, 'pending_pickup', { readyAt }).catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });

      // Record sales transaction (async, non-blocking)
      if (order && tenantId) {
        import('../lib/aggregatorSalesService').then(({ recordAggregatorSale }) => {
          recordAggregatorSale(tenantId, { ...order, readyAt }).catch((err) => {
            console.error('[AggregatorStore] Failed to record aggregator sale:', err);
          });
        }).catch((err) => {
          console.error('[AggregatorStore] Failed to load aggregatorSalesService:', err);
        });
      }
    }
  },

  markPickedUp: async (orderId) => {
    console.log('[AggregatorStore] Mark picked up:', orderId);
    const pickedUpAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'picked_up' as AggregatorOrderStatus, pickedUpAt }
          : order
      ),
    }));

    // Persist status change
    if (isTauri()) {
      aggregatorOrderDb.updateStatus(orderId, 'picked_up', { pickedUpAt }).catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });
    }
  },

  markOutForDelivery: async (orderId) => {
    console.log('[AggregatorStore] Mark out for delivery:', orderId);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'out_for_delivery' as AggregatorOrderStatus }
          : order
      ),
    }));

    // Persist status change
    if (isTauri()) {
      aggregatorOrderDb.updateStatus(orderId, 'out_for_delivery').catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });
    }
  },

  markDelivered: async (orderId) => {
    console.log('[AggregatorStore] Mark delivered:', orderId);
    const deliveredAt = new Date().toISOString();

    // Update status and remove from active list (auto-archive delivered orders)
    set((state) => ({
      orders: state.orders.filter((order) => order.orderId !== orderId),
    }));

    // Persist status change and archive locally
    if (isTauri()) {
      // First update the status
      await aggregatorOrderDb.updateStatus(orderId, 'delivered', { deliveredAt }).catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });

      // Then archive it
      aggregatorOrderDb.archive(orderId).catch((err) => {
        console.error('[AggregatorStore] Failed to archive delivered order locally:', err);
      });
    }

    // Archive in cloud D1 (delivered orders should be archived)
    try {
      const tenantId = useTenantStore.getState().tenant?.tenantId;
      if (tenantId) {
        archiveAggregatorOrderInCloud(tenantId, orderId).catch((err) => {
          console.error('[AggregatorStore] Failed to archive delivered order in cloud:', err);
        });
      }
    } catch (err) {
      console.error('[AggregatorStore] Failed to get tenant for cloud archive:', err);
    }
  },

  markCompleted: async (orderId) => {
    console.log('[AggregatorStore] Mark completed:', orderId);
    const deliveredAt = new Date().toISOString();

    // Update status and remove from active list (auto-archive completed orders)
    set((state) => ({
      orders: state.orders.filter((order) => order.orderId !== orderId),
    }));

    // Persist status change and archive locally
    if (isTauri()) {
      // First update the status
      await aggregatorOrderDb.updateStatus(orderId, 'completed', { deliveredAt }).catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });

      // Then archive it
      aggregatorOrderDb.archive(orderId).catch((err) => {
        console.error('[AggregatorStore] Failed to archive completed order locally:', err);
      });
    }

    // Archive in cloud D1 (completed orders should be archived)
    try {
      const tenantId = useTenantStore.getState().tenant?.tenantId;
      if (tenantId) {
        archiveAggregatorOrderInCloud(tenantId, orderId).catch((err) => {
          console.error('[AggregatorStore] Failed to archive completed order in cloud:', err);
        });
      }
    } catch (err) {
      console.error('[AggregatorStore] Failed to get tenant for cloud archive:', err);
    }
  },

  dismissOrder: async (orderId) => {
    console.log('[AggregatorStore] Dismiss order:', orderId);

    // Remove from active orders in store immediately
    set((state) => ({
      orders: state.orders.filter((order) => order.orderId !== orderId),
    }));

    // Archive locally (instead of delete - preserves order history)
    if (isTauri()) {
      aggregatorOrderDb.archive(orderId).catch((err) => {
        console.error('[AggregatorStore] Failed to archive dismissed order locally:', err);
      });
    }

    // Archive in cloud D1 (so it doesn't come back on reload)
    try {
      const tenantId = useTenantStore.getState().tenant?.tenantId;
      if (tenantId) {
        archiveAggregatorOrderInCloud(tenantId, orderId).catch((err) => {
          console.error('[AggregatorStore] Failed to archive dismissed order in cloud:', err);
        });
      }
    } catch (err) {
      console.error('[AggregatorStore] Failed to get tenant for cloud archive:', err);
    }
  },

  // WebSocket
  setConnected: (connected) => set({ isConnected: connected }),
  incrementReconnectAttempts: () =>
    set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),

  // Loading & Error
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Persistence - Load orders from local database
  loadOrdersFromDb: async () => {
    if (!isTauri()) {
      console.log('[AggregatorStore] Not in Tauri, skipping DB load');
      return;
    }

    try {
      set({ isLoading: true });
      console.log('[AggregatorStore] Loading orders from database...');

      // Load active orders first (pending, confirmed, preparing, ready, out_for_delivery)
      const activeOrders = await aggregatorOrderDb.getActive();
      console.log(`[AggregatorStore] Found ${activeOrders.length} active orders in DB`);

      // Also load today's completed orders for reference
      const todaysOrders = await aggregatorOrderDb.getTodays();
      console.log(`[AggregatorStore] Found ${todaysOrders.length} total orders today`);

      // Combine and dedupe (active orders first, then today's remaining)
      const activeIds = new Set(activeOrders.map((o) => o.orderId));
      const additionalTodaysOrders = todaysOrders.filter((o) => !activeIds.has(o.orderId));
      const allOrders = [...activeOrders, ...additionalTodaysOrders];

      // Merge with existing in-memory orders (prioritize newer data)
      set((state) => {
        const existingIds = new Set(state.orders.map((o) => o.orderId));
        const newOrders = allOrders.filter((o) => !existingIds.has(o.orderId));

        console.log(
          `[AggregatorStore] Loaded ${allOrders.length} from DB, ${newOrders.length} new, existing: ${existingIds.size}`
        );

        return {
          orders: [...state.orders, ...newOrders],
          isLoading: false,
        };
      });
    } catch (error) {
      console.error('[AggregatorStore] Failed to load orders from DB:', error);
      set({ isLoading: false, error: String(error) });
    }
  },

  // Fetch orders from cloud and merge with local
  fetchFromCloud: async (tenantId: string) => {
    try {
      console.log('[AggregatorStore] Fetching orders from cloud...');
      set({ isLoading: true });

      // Fetch all orders including delivered/completed for full sync
      const cloudData = await getAggregatorOrdersFromCloud(tenantId, {
        limit: 100,
      });

      if (cloudData && cloudData.length > 0) {
        console.log(`[AggregatorStore] Fetched ${cloudData.length} orders from cloud`);

        // Transform cloud orders to AggregatorOrder format
        // Note: Cloud API already filters out archived orders by default
        const cloudOrders: AggregatorOrder[] = cloudData.map((o: any) => ({
          orderId: o.orderId,
          orderNumber: o.orderNumber,
          aggregator: o.aggregator as AggregatorSource,
          aggregatorOrderId: o.aggregatorOrderId,
          aggregatorStatus: o.aggregatorStatus || o.status || 'pending',
          status: o.status as AggregatorOrderStatus,
          orderType: (o.orderType || 'delivery') as 'delivery' | 'pickup',
          customer: {
            name: o.customerName || 'Customer',
            phone: o.customerPhone || null,
            address: o.customerAddress || null,
          },
          cart: {
            items: (o.items || []).map((item: any, idx: number) => ({
              id: item.id || `item-${idx}`,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
              specialInstructions: item.specialInstructions || null,
              variants: item.variants || [],
              addons: item.addons || [],
            })),
            subtotal: o.subtotal || 0,
            tax: o.tax || 0,
            deliveryFee: o.deliveryFee || 0,
            platformFee: o.platformFee || 0,
            discount: o.discount || 0,
            total: o.total || 0,
          },
          payment: {
            method: o.paymentMethod || 'online',
            status: o.paymentStatus || 'pending',
            isPrepaid: o.isPrepaid || false,
          },
          specialInstructions: o.specialInstructions || null,
          createdAt: o.createdAt,
          acceptedAt: o.acceptedAt || null,
          readyAt: o.readyAt || null,
          deliveredAt: o.deliveredAt || null,
          archivedAt: o.archivedAt || null,
        }));

        // Merge with existing orders (don't duplicate)
        set((state) => {
          const existingIds = new Set(state.orders.map((o) => o.orderId));
          const newOrders = cloudOrders.filter((o) => !existingIds.has(o.orderId));

          console.log(
            `[AggregatorStore] Cloud: ${cloudOrders.length} total, ${newOrders.length} new`
          );

          // Also save new orders to local DB for offline access
          if (isTauri() && newOrders.length > 0) {
            newOrders.forEach((order) => {
              aggregatorOrderDb.save(order).catch((err: Error) => {
                console.error('[AggregatorStore] Failed to save cloud order to local DB:', err);
              });
            });
          }

          return {
            orders: [...state.orders, ...newOrders],
            isLoading: false,
          };
        });
      } else {
        console.log('[AggregatorStore] No orders from cloud or fetch failed');
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('[AggregatorStore] Failed to fetch from cloud:', error);
      set({ isLoading: false, error: String(error) });
    }
  },

  // Archive all orders (for clearing test/old orders)
  archiveAllOrders: async (tenantId: string) => {
    try {
      console.log('[AggregatorStore] Archiving all orders for tenant:', tenantId);
      set({ isLoading: true });

      const currentOrders = get().orders;
      let archivedCount = 0;

      // Try bulk archive endpoint first, fallback to individual archives
      try {
        const result = await archiveAllAggregatorOrdersInCloud(tenantId);
        archivedCount = result.archived;
      } catch (bulkError) {
        // Bulk endpoint not available, archive each order individually
        console.log('[AggregatorStore] Bulk archive not available, archiving individually...');
        for (const order of currentOrders) {
          try {
            await archiveAggregatorOrderInCloud(tenantId, order.orderId);
            archivedCount++;
          } catch (err) {
            console.error('[AggregatorStore] Failed to archive order in cloud:', order.orderId, err);
          }
        }
      }

      // Archive locally in SQLite
      if (isTauri()) {
        for (const order of currentOrders) {
          try {
            await aggregatorOrderDb.archive(order.orderId);
          } catch (err) {
            console.error('[AggregatorStore] Failed to archive order locally:', order.orderId, err);
          }
        }
      }

      // Clear orders from store
      set({ orders: [], isLoading: false });

      console.log('[AggregatorStore] Archived', archivedCount, 'orders');
      return { archived: archivedCount };
    } catch (error) {
      console.error('[AggregatorStore] Failed to archive all orders:', error);
      set({ isLoading: false, error: String(error) });
      throw error;
    }
  },

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
      ready: orders.filter((o) => o.status === 'ready' || o.status === 'pending_pickup').length,
      pendingPickup: orders.filter((o) => o.status === 'pending_pickup').length,
      pickedUp: orders.filter((o) => o.status === 'picked_up').length,
    };
  },
}));
