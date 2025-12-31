/**
 * Sales Transaction Sync Service
 * Handles background sync of POS sales transactions between local SQLite and D1 cloud
 */

import { salesTransactionService, SalesTransaction } from './salesTransactionService';
import { syncSalesTransactions, SalesTransactionSyncPayload } from './handsfreeApi';
import { useTenantStore } from '../stores/tenantStore';
import { isTauri } from './platform';

// Sync interval (5 minutes)
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

// Batch size for sync
const SYNC_BATCH_SIZE = 50;

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

/**
 * Transform SalesTransaction to sync payload
 */
function transactionToSyncPayload(tx: SalesTransaction): SalesTransactionSyncPayload {
  return {
    id: tx.id,
    invoiceNumber: tx.invoiceNumber,
    orderNumber: tx.orderNumber,
    orderType: tx.orderType,
    tableNumber: tx.tableNumber,
    source: tx.source,
    subtotal: tx.subtotal,
    serviceCharge: tx.serviceCharge,
    cgst: tx.cgst,
    sgst: tx.sgst,
    discount: tx.discount,
    roundOff: tx.roundOff,
    grandTotal: tx.grandTotal,
    paymentMethod: tx.paymentMethod,
    paymentStatus: tx.paymentStatus,
    items: tx.items.map((item) => ({
      name: item.menuItem?.name || 'Unknown',
      quantity: item.quantity,
      price: item.menuItem?.price || 0,
      subtotal: item.subtotal,
      modifiers: item.modifiers?.map((m) => m.name) || [],
    })),
    cashierName: tx.cashierName,
    staffId: tx.staffId,
    createdAt: tx.createdAt,
    completedAt: tx.completedAt,
  };
}

// Cloud sync enabled flag
const CLOUD_SYNC_ENABLED = true;

/**
 * Sync unsynced sales transactions to D1
 */
export async function syncSalesToCloud(): Promise<{ synced: number; errors: string[] }> {
  // Cloud sync disabled - silently skip
  if (!CLOUD_SYNC_ENABLED) {
    return { synced: 0, errors: [] };
  }

  if (!isTauri()) {
    console.log('[SalesSync] Not in Tauri, skipping sync');
    return { synced: 0, errors: [] };
  }

  if (isSyncing) {
    console.log('[SalesSync] Sync already in progress, skipping');
    return { synced: 0, errors: [] };
  }

  const tenant = useTenantStore.getState().tenant;
  if (!tenant?.tenantId) {
    console.log('[SalesSync] No tenant configured, skipping sync');
    return { synced: 0, errors: [] };
  }

  isSyncing = true;
  let totalSynced = 0;
  const allErrors: string[] = [];

  try {
    console.log('[SalesSync] Starting sync...');

    // Get unsynced transactions from local DB
    const unsyncedTransactions = await salesTransactionService.getUnsyncedTransactions(tenant.tenantId);

    if (unsyncedTransactions.length === 0) {
      console.log('[SalesSync] No transactions to sync');
      return { synced: 0, errors: [] };
    }

    console.log(`[SalesSync] Found ${unsyncedTransactions.length} transactions to sync`);

    // Sync in batches
    for (let i = 0; i < unsyncedTransactions.length; i += SYNC_BATCH_SIZE) {
      const batch = unsyncedTransactions.slice(i, i + SYNC_BATCH_SIZE);
      const payloads = batch.map(transactionToSyncPayload);

      try {
        const result = await syncSalesTransactions(tenant.tenantId, payloads);
        totalSynced += result.synced;
        allErrors.push(...result.errors);

        // Mark successfully synced transactions
        if (result.synced > 0) {
          const syncedIds = batch.slice(0, result.synced).map((tx) => tx.id);
          await salesTransactionService.markTransactionsSynced(syncedIds);
        }
      } catch (batchError) {
        console.error('[SalesSync] Batch sync failed:', batchError);
        allErrors.push(String(batchError));
      }
    }

    console.log(`[SalesSync] Sync complete: ${totalSynced} synced, ${allErrors.length} errors`);
    return { synced: totalSynced, errors: allErrors };
  } catch (error) {
    console.error('[SalesSync] Sync failed:', error);
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
    console.log('[SalesSync] Sync service already running');
    return;
  }

  if (!isTauri()) {
    console.log('[SalesSync] Not in Tauri, not starting sync service');
    return;
  }

  console.log('[SalesSync] Starting sync service...');

  // Initial sync after a short delay (stagger with aggregator sync)
  setTimeout(() => {
    syncSalesToCloud().catch((err) => {
      console.error('[SalesSync] Initial sync failed:', err);
    });
  }, 15000); // 15 second delay for initial sync (after aggregator sync starts)

  // Periodic sync
  syncIntervalId = setInterval(() => {
    syncSalesToCloud().catch((err) => {
      console.error('[SalesSync] Periodic sync failed:', err);
    });
  }, SYNC_INTERVAL_MS);

  console.log(`[SalesSync] Sync service started, interval: ${SYNC_INTERVAL_MS}ms`);
}

/**
 * Stop background sync service
 */
export function stopSyncService(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[SalesSync] Sync service stopped');
  }
}

/**
 * Manual sync trigger
 */
export async function triggerSync(): Promise<{ synced: number; errors: string[] }> {
  return syncSalesToCloud();
}

/**
 * Get sync status
 */
export function getSyncStatus(): { isRunning: boolean; isSyncing: boolean } {
  return {
    isRunning: syncIntervalId !== null,
    isSyncing,
  };
}

export const salesSyncService = {
  syncToCloud: syncSalesToCloud,
  start: startSyncService,
  stop: stopSyncService,
  trigger: triggerSync,
  getStatus: getSyncStatus,
};

export default salesSyncService;
