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
import { getAggregatorOrdersFromCloud } from '../lib/handsfreeApi';

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
  markOutForDelivery: (orderId: string) => Promise<void>;
  markDelivered: (orderId: string) => Promise<void>;
  markCompleted: (orderId: string) => Promise<void>;

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

  markReady: async (orderId) => {
    console.log('[AggregatorStore] Mark ready:', orderId);
    const readyAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'ready' as AggregatorOrderStatus, readyAt }
          : order
      ),
    }));

    // Persist status change
    if (isTauri()) {
      aggregatorOrderDb.updateStatus(orderId, 'ready', { readyAt }).catch((err) => {
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
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'delivered' as AggregatorOrderStatus, deliveredAt }
          : order
      ),
    }));

    // Persist status change
    if (isTauri()) {
      aggregatorOrderDb.updateStatus(orderId, 'delivered', { deliveredAt }).catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });
    }
  },

  markCompleted: async (orderId) => {
    console.log('[AggregatorStore] Mark completed:', orderId);
    const deliveredAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((order) =>
        order.orderId === orderId
          ? { ...order, status: 'completed' as AggregatorOrderStatus, deliveredAt }
          : order
      ),
    }));

    // Persist status change
    if (isTauri()) {
      aggregatorOrderDb.updateStatus(orderId, 'completed', { deliveredAt }).catch((err) => {
        console.error('[AggregatorStore] Failed to persist order status:', err);
      });
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
        const cloudOrders: AggregatorOrder[] = cloudData.map((o) => ({
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
