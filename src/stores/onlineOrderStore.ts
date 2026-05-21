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

const RESTAURANT_API_URL =
  (import.meta as any).env?.VITE_RESTAURANT_API_URL ||
  'https://handsfree-restaurant.suyesh.workers.dev';

async function resolveTenantId(): Promise<string | null> {
  try {
    const { useTenantStore } = await import('./tenantStore');
    const { useAuthStore } = await import('./authStore');
    return (
      useTenantStore.getState().tenant?.tenantId ||
      useAuthStore.getState().user?.tenantId ||
      null
    );
  } catch {
    return null;
  }
}

async function patchOrderStatus(
  orderId: string,
  tenantId: string,
  status: string,
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    const res = await fetch(`${RESTAURANT_API_URL}/api/orders/${orderId}/status?tenantId=${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extra }),
    });
    if (!res.ok) console.warn('[OnlineOrderStore] Status patch returned', res.status);
  } catch (err) {
    console.warn('[OnlineOrderStore] Failed to sync status to D1:', err);
  }
}

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
  markOutForDelivery: (orderId: string) => Promise<void>;
  markDelivered: (orderId: string) => Promise<void>;
  markCompleted: (orderId: string) => Promise<void>;

  // Actions - Loading & Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Actions - Cloud fetch
  fetchFromCloud: () => Promise<void>;

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
    const exists = get().orders.some(
      (o) => o.id === order.id || o.orderNumber === order.orderNumber
    );
    if (exists) {
      console.log('[OnlineOrderStore] Skipping duplicate order:', order.orderNumber);
      return;
    }
    set((state) => ({ orders: [order, ...state.orders] }));
    import('./notificationStore').then(({ useNotificationStore }) => {
      useNotificationStore.getState().playSound('new_order');
    }).catch(() => {});
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

    // Update status to 'confirmed' — order stays in store so the delivery screen can track it
    const confirmedAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId ? { ...o, status: 'confirmed' as OnlineOrderStatus, confirmedAt } : o
      ),
    }));

    // Sync status to D1 (fire-and-forget)
    const tenantId = await resolveTenantId();
    if (tenantId) {
      patchOrderStatus(orderId, tenantId, 'confirmed', { estimatedPrepTime: prepTime });
    }

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
    // Remove immediately — rejected orders don't need to persist in the queue
    set((state) => ({ orders: state.orders.filter((o) => o.id !== orderId) }));

    // Sync status to D1 (fire-and-forget)
    const tenantId = await resolveTenantId();
    if (tenantId) {
      patchOrderStatus(orderId, tenantId, 'cancelled', { cancellationReason: reason });
    }
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
    const readyAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, status: 'ready' as OnlineOrderStatus, readyAt } : order
      ),
    }));
    const tenantId = await resolveTenantId();
    if (tenantId) patchOrderStatus(orderId, tenantId, 'ready');
  },

  markOutForDelivery: async (orderId) => {
    console.log('[OnlineOrderStore] Mark out for delivery:', orderId);
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, status: 'out_for_delivery' as OnlineOrderStatus } : order
      ),
    }));
    const tenantId = await resolveTenantId();
    if (tenantId) patchOrderStatus(orderId, tenantId, 'out_for_delivery');
  },

  markDelivered: async (orderId) => {
    console.log('[OnlineOrderStore] Mark delivered:', orderId);
    const deliveredAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, status: 'delivered' as OnlineOrderStatus, deliveredAt } : order
      ),
    }));
    const tenantId = await resolveTenantId();
    if (tenantId) patchOrderStatus(orderId, tenantId, 'delivered');
  },

  markCompleted: async (orderId) => {
    console.log('[OnlineOrderStore] Mark completed:', orderId);
    const completedAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, status: 'completed' as OnlineOrderStatus, completedAt } : order
      ),
    }));
    const tenantId = await resolveTenantId();
    if (tenantId) patchOrderStatus(orderId, tenantId, 'completed');
  },

  // Loading & Error
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Fetch active web orders from the cloud REST API.
  // Fetches all non-terminal statuses so the delivery screen has full customer + price data.
  // Called on drawer open and on delivery dashboard mount.
  fetchFromCloud: async () => {
    const tenantId = await resolveTenantId();
    if (!tenantId) return;

    set({ isLoading: true });
    try {
      const since = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(); // last 8 hours
      // No status filter — fetch all recent web orders; completed/cancelled filtered below
      const url = `${RESTAURANT_API_URL}/api/orders?tenantId=${tenantId}&source=web&limit=100&startDate=${encodeURIComponent(since)}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('[OnlineOrderStore] Cloud fetch returned', response.status);
        return;
      }
      const data = await response.json() as { success: boolean; orders?: any[] };
      if (!data.success || !data.orders?.length) return;

      const activeStatuses = new Set(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered']);
      const existingIds = new Set(get().orders.map((o) => o.id));

      const mapped: OnlineOrder[] = data.orders
        .filter((o: any) => activeStatuses.has(o.status || 'pending'))
        .map((o: any) => ({
          id: o.id,
          orderNumber: o.order_number || o.orderNumber,
          status: (o.status || 'pending') as OnlineOrderStatus,
          orderType: (o.order_type || o.orderType || 'pickup') as 'delivery' | 'pickup',
          createdAt: o.created_at || o.createdAt,
          customer: {
            name: o.customer_name || o.customerName || 'Guest',
            phone: o.customer_phone || o.customerPhone || '',
          },
          cart: {
            items: (o.items || []).map((item: any, idx: number) => ({
              id: `${o.id}-item-${idx}`,
              name: item.name,
              quantity: item.quantity || 1,
              price: item.price || 0,
              total: (item.price || 0) * (item.quantity || 1),
              specialInstructions: item.special_instructions || item.specialInstructions || null,
            })),
            subtotal: o.subtotal || 0,
            tax: o.tax || 0,
            deliveryFee: o.delivery_fee || o.deliveryFee || 0,
            discount: 0,
            total: o.total || 0,
          },
          payment: {
            method: o.payment_method || o.paymentMethod || 'cash',
            status: o.payment_status || o.paymentStatus || 'pending',
            isPrepaid: (o.payment_method || o.paymentMethod) === 'online',
          },
          specialInstructions: o.notes || null,
        }));

      const newOrders = mapped.filter((o) => !existingIds.has(o.id));
      // Update status for orders already in the store (may have changed server-side)
      const updatedIds = new Set(mapped.filter((o) => existingIds.has(o.id)).map((o) => o.id));

      if (newOrders.length > 0 || updatedIds.size > 0) {
        console.log('[OnlineOrderStore] Cloud fetch:', newOrders.length, 'new,', updatedIds.size, 'updated');
        // Status rank — never downgrade a locally-advanced status back to a stale server value.
        // This prevents confirmed/preparing orders from reverting to 'pending' if the
        // server-side patch failed or was delayed.
        const STATUS_RANK: Record<string, number> = {
          pending: 0, confirmed: 1, preparing: 2, ready: 3,
          out_for_delivery: 4, delivered: 5, completed: 6, cancelled: -1,
        };
        set((state) => {
          const updated = state.orders.map((existing) => {
            if (!updatedIds.has(existing.id)) return existing;
            const fresh = mapped.find((o) => o.id === existing.id);
            if (!fresh) return existing;
            const localRank = STATUS_RANK[existing.status] ?? 0;
            const cloudRank = STATUS_RANK[fresh.status] ?? 0;
            return cloudRank >= localRank ? fresh : { ...fresh, status: existing.status };
          });
          return { orders: [...newOrders, ...updated] };
        });
      }
    } catch (err) {
      console.warn('[OnlineOrderStore] Cloud fetch failed:', err);
    } finally {
      set({ isLoading: false });
    }
  },

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
