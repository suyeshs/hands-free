/**
 * Out of Stock Store
 * Manages items marked as "86" (out of stock) by kitchen staff
 * Broadcasts alerts to POS and Service Dashboard devices
 */

import { create } from 'zustand';
import type { OutOfStockItem, OutOfStockAlert } from '../types/stock';
import { outOfStockService } from '../lib/outOfStockService';
import { orderSyncService } from '../lib/orderSyncService';

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
