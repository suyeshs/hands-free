/**
 * Out of Stock Store
 * Manages items marked as "86" (out of stock) by kitchen staff
 * Broadcasts alerts to POS and Service Dashboard devices
 */

import { create } from 'zustand';
import type { OutOfStockItem, OutOfStockAlert } from '../types/stock';
import { outOfStockService } from '../lib/outOfStockService';
import { orderSyncService } from '../lib/orderSyncService';
import { useKDSStore } from './kdsStore';

interface OrderContext {
  orderId: string;
  orderNumber: string;
  tableNumber?: number;
}

interface OutOfStockState {
  // State
  outOfStockItems: OutOfStockItem[];
  pendingAlerts: OutOfStockAlert[];
  isLoaded: boolean;

  // Actions - Local
  markOutOfStock: (
    tenantId: string,
    itemName: string,
    portionsOut: number,
    context?: OrderContext,
    staffName?: string
  ) => Promise<void>;
  markBackInStock: (tenantId: string, itemId: string) => Promise<void>;
  acknowledgeAlert: (alertId: string, staffName?: string) => void;
  dismissAlert: (alertId: string) => void;

  // Queries
  isItemOutOfStock: (itemName: string) => boolean;
  getOutOfStockItem: (itemName: string) => OutOfStockItem | undefined;
  getActiveItems: () => OutOfStockItem[];
  getPendingAlerts: () => OutOfStockAlert[];
  getUnacknowledgedAlerts: () => OutOfStockAlert[];

  // SQLite persistence
  loadFromDb: (tenantId: string) => Promise<void>;
  clearAllItems: (tenantId: string) => Promise<void>;

  // Remote sync (called when receiving WebSocket messages)
  applyRemoteOutOfStock: (item: OutOfStockItem, alert: OutOfStockAlert) => void;
  applyRemoteBackInStock: (itemId: string) => void;
}

export const useOutOfStockStore = create<OutOfStockState>((set, get) => ({
  outOfStockItems: [],
  pendingAlerts: [],
  isLoaded: false,

  /**
   * Mark an item as out of stock
   * Creates the OOS record and broadcasts alert to all devices
   */
  markOutOfStock: async (
    tenantId: string,
    itemName: string,
    portionsOut: number,
    context?: OrderContext,
    staffName?: string
  ) => {
    // Check if already out of stock
    const existing = get().outOfStockItems.find(
      (i) => i.isActive && i.itemName.toLowerCase() === itemName.toLowerCase()
    );
    if (existing) {
      console.log(`[OutOfStockStore] Item "${itemName}" is already marked as 86'd`);
      return;
    }

    const newItem: OutOfStockItem = {
      id: crypto.randomUUID(),
      itemName,
      portionsOut,
      createdAt: new Date().toISOString(),
      createdByStaffName: staffName,
      isActive: true,
    };

    const alert: OutOfStockAlert = {
      id: crypto.randomUUID(),
      outOfStockItemId: newItem.id,
      itemName,
      portionsOut,
      orderContext: context,
      createdAt: new Date().toISOString(),
      acknowledged: false,
    };

    // Update local state
    set((state) => ({
      outOfStockItems: [...state.outOfStockItems, newItem],
      pendingAlerts: [...state.pendingAlerts, alert],
    }));

    // Persist to SQLite
    try {
      await outOfStockService.saveItem(tenantId, newItem);
    } catch (error) {
      console.error('[OutOfStockStore] Failed to persist to SQLite:', error);
    }

    // Broadcast to other devices
    try {
      orderSyncService.broadcastOutOfStock(newItem, alert);
    } catch (error) {
      console.error('[OutOfStockStore] Failed to broadcast:', error);
    }

    // Update item quantity in the KDS order
    if (context?.orderId) {
      try {
        const kdsStore = useKDSStore.getState();
        const order = kdsStore.getOrderById(context.orderId);

        if (order) {
          // Find the item and update its quantity
          const updatedItems = order.items.map((item) => {
            if (item.name.toLowerCase() === itemName.toLowerCase()) {
              // Calculate new quantity
              // portionsOut === -1 means "all out" - set to 0
              const newQuantity = portionsOut === -1
                ? 0
                : Math.max(0, item.quantity - portionsOut);

              console.log(`[OutOfStockStore] Reducing "${item.name}" from ${item.quantity} to ${newQuantity}`);

              return {
                ...item,
                quantity: newQuantity,
                // Mark as ready/completed if quantity becomes 0 (nothing to prepare)
                status: newQuantity === 0 ? 'ready' as const : item.status,
              };
            }
            return item;
          });

          // Filter out items with quantity 0 (optional - keep them for audit trail)
          // For now, keep them but marked as ready

          // Update the order in KDS store
          kdsStore.updateOrder(context.orderId, { items: updatedItems });

          console.log(`[OutOfStockStore] Updated KDS order ${context.orderNumber} with reduced quantities`);

          // Broadcast the updated order to other devices
          try {
            const updatedOrder = { ...order, items: updatedItems };
            orderSyncService.broadcastOrderUpdate(updatedOrder);
            console.log(`[OutOfStockStore] Broadcast updated order to other devices`);
          } catch (broadcastError) {
            console.error('[OutOfStockStore] Failed to broadcast order update:', broadcastError);
          }
        }
      } catch (kdsError) {
        console.error('[OutOfStockStore] Failed to update KDS order:', kdsError);
      }
    }

    // Also update the POS active table order if applicable
    // This handles the case where POS is on the same device as KDS
    if (context?.tableNumber) {
      try {
        const { usePOSStore } = await import('./posStore');
        const posStore = usePOSStore.getState();
        const tableNumber = context.tableNumber;

        if (posStore.activeTables[tableNumber]) {
          const session = posStore.activeTables[tableNumber];
          if (session?.order?.items) {
            // Find and update matching items
            const updatedItems = session.order.items.map((orderItem) => {
              if (orderItem.menuItem.name.toLowerCase() === itemName.toLowerCase()) {
                const newQuantity = portionsOut === -1
                  ? 0
                  : Math.max(0, orderItem.quantity - portionsOut);

                // Calculate unit price from current subtotal to preserve modifiers
                const unitPrice = orderItem.quantity > 0 ? orderItem.subtotal / orderItem.quantity : orderItem.menuItem.price;

                console.log(`[OutOfStockStore] Reducing POS item "${orderItem.menuItem.name}" from ${orderItem.quantity} to ${newQuantity}`);

                return {
                  ...orderItem,
                  quantity: newQuantity,
                  subtotal: unitPrice * newQuantity,
                };
              }
              return orderItem;
            }).filter((orderItem) => orderItem.quantity > 0);

            const subtotal = updatedItems.reduce((sum, i) => sum + i.subtotal, 0);

            const updatedSession = {
              ...session,
              order: {
                ...session.order,
                items: updatedItems,
                subtotal,
                total: subtotal,
              },
            };

            usePOSStore.setState({
              activeTables: {
                ...posStore.activeTables,
                [tableNumber]: updatedSession,
              },
            });

            // Persist the updated session to SQLite
            try {
              const { tableSessionService } = await import('../lib/tableSessionService');
              await tableSessionService.saveSession(tenantId, updatedSession);
              console.log(`[OutOfStockStore] Updated local POS table ${tableNumber} order after 86 (persisted)`);
            } catch (persistError) {
              console.error('[OutOfStockStore] Failed to persist table session after 86:', persistError);
            }
          }
        }
      } catch (posError) {
        console.error('[OutOfStockStore] Failed to update local POS order:', posError);
      }
    }

    console.log(`[OutOfStockStore] Marked "${itemName}" as 86'd (${portionsOut} portions)`);
  },

  /**
   * Mark an item as back in stock
   * Removes the OOS record and broadcasts to all devices
   */
  markBackInStock: async (_tenantId: string, itemId: string) => {
    const item = get().outOfStockItems.find((i) => i.id === itemId);
    if (!item) {
      console.warn(`[OutOfStockStore] Item ${itemId} not found`);
      return;
    }

    // Update local state
    set((state) => ({
      outOfStockItems: state.outOfStockItems.map((i) =>
        i.id === itemId ? { ...i, isActive: false } : i
      ),
      // Clear related alerts
      pendingAlerts: state.pendingAlerts.filter((a) => a.outOfStockItemId !== itemId),
    }));

    // Update in SQLite
    try {
      await outOfStockService.markBackInStock(itemId);
    } catch (error) {
      console.error('[OutOfStockStore] Failed to update SQLite:', error);
    }

    // Broadcast to other devices
    try {
      orderSyncService.broadcastBackInStock(itemId, item.itemName);
    } catch (error) {
      console.error('[OutOfStockStore] Failed to broadcast back in stock:', error);
    }

    console.log(`[OutOfStockStore] Marked "${item.itemName}" as back in stock`);
  },

  /**
   * Acknowledge an alert (mark as seen)
   */
  acknowledgeAlert: (alertId: string, staffName?: string) => {
    set((state) => ({
      pendingAlerts: state.pendingAlerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              acknowledged: true,
              acknowledgedAt: new Date().toISOString(),
              acknowledgedByStaffName: staffName,
            }
          : a
      ),
    }));
  },

  /**
   * Dismiss an alert (remove from pending)
   */
  dismissAlert: (alertId: string) => {
    set((state) => ({
      pendingAlerts: state.pendingAlerts.filter((a) => a.id !== alertId),
    }));
  },

  /**
   * Check if an item is currently out of stock
   */
  isItemOutOfStock: (itemName: string) => {
    return get().outOfStockItems.some(
      (i) => i.isActive && i.itemName.toLowerCase() === itemName.toLowerCase()
    );
  },

  /**
   * Get an out-of-stock item by name
   */
  getOutOfStockItem: (itemName: string) => {
    return get().outOfStockItems.find(
      (i) => i.isActive && i.itemName.toLowerCase() === itemName.toLowerCase()
    );
  },

  /**
   * Get all active out-of-stock items
   */
  getActiveItems: () => {
    return get().outOfStockItems.filter((i) => i.isActive);
  },

  /**
   * Get all pending alerts
   */
  getPendingAlerts: () => {
    return get().pendingAlerts;
  },

  /**
   * Get alerts that haven't been acknowledged yet
   */
  getUnacknowledgedAlerts: () => {
    return get().pendingAlerts.filter((a) => !a.acknowledged);
  },

  /**
   * Load out-of-stock items from SQLite
   */
  loadFromDb: async (tenantId: string) => {
    try {
      const items = await outOfStockService.getActiveItems(tenantId);
      set({
        outOfStockItems: items,
        isLoaded: true,
      });
      console.log(`[OutOfStockStore] Loaded ${items.length} active OOS items from SQLite`);
    } catch (error) {
      console.error('[OutOfStockStore] Failed to load from SQLite:', error);
      set({ isLoaded: true });
    }
  },

  /**
   * Clear all items (for testing/reset)
   */
  clearAllItems: async (tenantId: string) => {
    try {
      await outOfStockService.clearAllItems(tenantId);
      set({
        outOfStockItems: [],
        pendingAlerts: [],
      });
    } catch (error) {
      console.error('[OutOfStockStore] Failed to clear items:', error);
    }
  },

  // Remote sync methods (called when receiving WebSocket messages from other devices)

  /**
   * Apply out-of-stock notification from another device
   */
  applyRemoteOutOfStock: (item: OutOfStockItem, alert: OutOfStockAlert) => {
    // Check if we already have this item
    const existing = get().outOfStockItems.find((i) => i.id === item.id);
    if (existing) {
      console.log(`[OutOfStockStore] OOS item ${item.id} already exists, skipping`);
      return;
    }

    set((state) => ({
      outOfStockItems: [...state.outOfStockItems, item],
      pendingAlerts: [...state.pendingAlerts, alert],
    }));

    console.log(`[OutOfStockStore] Applied remote OOS: "${item.itemName}"`);

    // Also update the POS active table order if the 86'd item is in an order
    // This is needed because POS tracks orders separately from KDS
    if (alert.orderContext?.tableNumber) {
      import('./posStore').then(({ usePOSStore }) => {
        const posStore = usePOSStore.getState();
        const tableNumber = alert.orderContext?.tableNumber;
        if (tableNumber && posStore.activeTables[tableNumber]) {
          const session = posStore.activeTables[tableNumber];
          if (session?.order?.items) {
            // Find and update matching items
            const updatedItems = session.order.items.map((orderItem) => {
              if (orderItem.menuItem.name.toLowerCase() === item.itemName.toLowerCase()) {
                // portionsOut === -1 means "all out" - set to 0
                const newQuantity = item.portionsOut === -1
                  ? 0
                  : Math.max(0, orderItem.quantity - item.portionsOut);

                // Calculate unit price from current subtotal to preserve modifiers
                const unitPrice = orderItem.quantity > 0 ? orderItem.subtotal / orderItem.quantity : orderItem.menuItem.price;

                console.log(`[OutOfStockStore] Reducing POS item "${orderItem.menuItem.name}" from ${orderItem.quantity} to ${newQuantity}`);

                return {
                  ...orderItem,
                  quantity: newQuantity,
                  subtotal: unitPrice * newQuantity,
                };
              }
              return orderItem;
            }).filter((orderItem) => orderItem.quantity > 0); // Remove items with 0 quantity

            // Recalculate order totals
            const subtotal = updatedItems.reduce((sum, i) => sum + i.subtotal, 0);

            usePOSStore.setState({
              activeTables: {
                ...posStore.activeTables,
                [tableNumber]: {
                  ...session,
                  order: {
                    ...session.order,
                    items: updatedItems,
                    subtotal,
                    total: subtotal, // Will be recalculated with tax on checkout
                  },
                },
              },
            });

            console.log(`[OutOfStockStore] Updated POS table ${tableNumber} order after 86`);
          }
        }
      }).catch((err) => {
        console.error('[OutOfStockStore] Failed to update POS order:', err);
      });
    }
  },

  /**
   * Apply back-in-stock notification from another device
   */
  applyRemoteBackInStock: (itemId: string) => {
    const item = get().outOfStockItems.find((i) => i.id === itemId);

    set((state) => ({
      outOfStockItems: state.outOfStockItems.map((i) =>
        i.id === itemId ? { ...i, isActive: false } : i
      ),
      pendingAlerts: state.pendingAlerts.filter((a) => a.outOfStockItemId !== itemId),
    }));

    if (item) {
      console.log(`[OutOfStockStore] Applied remote back in stock: "${item.itemName}"`);
    }
  },
}));
