/**
 * Aggregator Order Sync Service
 * Handles background sync of aggregator orders between local SQLite and D1 cloud
 */

import { aggregatorOrderDb } from './aggregatorOrderDb';
import { syncAggregatorOrders, AggregatorOrderSyncPayload } from './handsfreeApi';
import { useTenantStore } from '../stores/tenantStore';
import { AggregatorOrder } from '../types/aggregator';
import { isTauri } from './platform';

// Sync interval (5 minutes)
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

// Batch size for sync
const SYNC_BATCH_SIZE = 50;

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

/**
 * Transform AggregatorOrder to sync payload
 */
function orderToSyncPayload(order: AggregatorOrder): AggregatorOrderSyncPayload {
  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    aggregator: order.aggregator,
    aggregatorOrderId: order.aggregatorOrderId,
    aggregatorStatus: order.aggregatorStatus,
    status: order.status,
    orderType: order.orderType,
    customerName: order.customer?.name,
    customerPhone: order.customer?.phone || undefined,
    customerAddress: order.customer?.address || undefined,
    items: (order.cart?.items || []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      specialInstructions: item.specialInstructions || undefined,
    })),
    subtotal: order.cart?.subtotal || 0,
    tax: order.cart?.tax || 0,
    deliveryFee: order.cart?.deliveryFee || 0,
    platformFee: order.cart?.platformFee || 0,
    discount: order.cart?.discount || 0,
    total: order.cart?.total || 0,
    paymentMethod: order.payment?.method,
    paymentStatus: order.payment?.status,
    isPrepaid: order.payment?.isPrepaid || false,
    specialInstructions: order.specialInstructions || undefined,
    createdAt: order.createdAt,
    acceptedAt: order.acceptedAt || undefined,
    readyAt: order.readyAt || undefined,
    deliveredAt: order.deliveredAt || undefined,
  };
}

// Cloud sync enabled - tenant worker deployed to D1 backend
const CLOUD_SYNC_ENABLED = true;

/**
 * Sync unsynced orders to D1
 */
export async function syncOrdersToCloud(): Promise<{ synced: number; errors: string[] }> {
  // Cloud sync disabled - silently skip
  if (!CLOUD_SYNC_ENABLED) {
    return { synced: 0, errors: [] };
  }

  if (!isTauri()) {
    console.log('[AggregatorSync] Not in Tauri, skipping sync');
    return { synced: 0, errors: [] };
  }

  if (isSyncing) {
    console.log('[AggregatorSync] Sync already in progress, skipping');
    return { synced: 0, errors: [] };
  }

  const tenant = useTenantStore.getState().tenant;
  if (!tenant?.tenantId) {
    console.log('[AggregatorSync] No tenant configured, skipping sync');
    return { synced: 0, errors: [] };
  }

  isSyncing = true;
  let totalSynced = 0;
  const allErrors: string[] = [];

  try {
    console.log('[AggregatorSync] Starting sync...');

    // Get unsynced orders from local DB
    const unsyncedOrders = await aggregatorOrderDb.getUnsynced();

    if (unsyncedOrders.length === 0) {
      console.log('[AggregatorSync] No orders to sync');
      return { synced: 0, errors: [] };
    }

    console.log(`[AggregatorSync] Found ${unsyncedOrders.length} orders to sync`);

    // Sync in batches
    for (let i = 0; i < unsyncedOrders.length; i += SYNC_BATCH_SIZE) {
      const batch = unsyncedOrders.slice(i, i + SYNC_BATCH_SIZE);
      const payloads = batch.map(orderToSyncPayload);

      try {
        const result = await syncAggregatorOrders(tenant.tenantId, payloads);
        totalSynced += result.synced;
        allErrors.push(...result.errors);

        // Mark successfully synced orders
        if (result.synced > 0) {
          const syncedIds = batch.slice(0, result.synced).map((o) => o.orderId);
          await aggregatorOrderDb.markSynced(syncedIds);
        }
      } catch (batchError) {
        console.error('[AggregatorSync] Batch sync failed:', batchError);
        allErrors.push(String(batchError));
      }
    }

    console.log(`[AggregatorSync] Sync complete: ${totalSynced} synced, ${allErrors.length} errors`);
    return { synced: totalSynced, errors: allErrors };
  } catch (error) {
    console.error('[AggregatorSync] Sync failed:', error);
    return { synced: totalSynced, errors: [String(error), ...allErrors] };
  } finally {
    isSyncing = false;
  }
}

/**
 * Start background sync service
 */
export function startSyncService(): void {
  if (syncIntervalId) {
    console.log('[AggregatorSync] Sync service already running');
    return;
  }

  if (!isTauri()) {
    console.log('[AggregatorSync] Not in Tauri, not starting sync service');
    return;
  }

  console.log('[AggregatorSync] Starting sync service...');

  // Initial sync after a short delay
  setTimeout(() => {
    syncOrdersToCloud().catch((err) => {
      console.error('[AggregatorSync] Initial sync failed:', err);
    });
  }, 10000); // 10 second delay for initial sync

  // Periodic sync
  syncIntervalId = setInterval(() => {
    syncOrdersToCloud().catch((err) => {
      console.error('[AggregatorSync] Periodic sync failed:', err);
    });
  }, SYNC_INTERVAL_MS);

  console.log(`[AggregatorSync] Sync service started, interval: ${SYNC_INTERVAL_MS}ms`);
}

/**
 * Stop background sync service
 */
export function stopSyncService(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[AggregatorSync] Sync service stopped');
  }
}

/**
 * Manual sync trigger
 */
export async function triggerSync(): Promise<{ synced: number; errors: string[] }> {
  return syncOrdersToCloud();
}

/**
 * Cleanup old synced orders from local DB
 */
export async function cleanupOldOrders(daysToKeep: number = 30): Promise<number> {
  if (!isTauri()) {
    return 0;
  }

  try {
    const deleted = await aggregatorOrderDb.cleanup(daysToKeep);
    console.log(`[AggregatorSync] Cleaned up ${deleted} old orders`);
    return deleted;
  } catch (error) {
    console.error('[AggregatorSync] Cleanup failed:', error);
    return 0;
  }
}

export const aggregatorSyncService = {
  syncToCloud: syncOrdersToCloud,
  start: startSyncService,
  stop: stopSyncService,
  trigger: triggerSync,
  cleanup: cleanupOldOrders,
};

export default aggregatorSyncService;
