/**
 * Floor Plan Sync Service
 *
 * Integrates floor plan sync with the proper Rust-based sync engine
 * instead of using direct HTTP calls that can cause data loss.
 *
 * Features:
 * - Incremental sync (only sends changed records)
 * - Conflict resolution with timestamps
 * - Offline queue support
 * - Integration with WebSocket real-time sync
 */

import { invoke } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
  duration_ms: number;
}

/**
 * Sync floor plan to cloud using the Rust sync engine
 * This properly tracks changes and prevents data loss
 */
export async function syncFloorPlanToCloud(tenantId: string): Promise<SyncResult> {
  if (!isTauri) {
    console.warn('[FloorPlanSync] Not in Tauri environment, skipping Rust sync');
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: ['Not in Tauri environment'],
      duration_ms: 0,
    };
  }

  try {
    console.log('[FloorPlanSync] Starting incremental sync to cloud...');
    const result = await invoke<SyncResult>('sync_floor_plan_to_cloud', { tenantId });
    console.log('[FloorPlanSync] Sync completed:', result);
    return result;
  } catch (error) {
    console.error('[FloorPlanSync] Sync failed:', error);
    return {
      success: false,
      synced: 0,
      failed: 1,
      errors: [error instanceof Error ? error.message : String(error)],
      duration_ms: 0,
    };
  }
}

/**
 * Initialize the sync system
 */
export async function initFloorPlanSync(tenantId: string, apiBaseUrl: string): Promise<void> {
  if (!isTauri) {
    console.warn('[FloorPlanSync] Not in Tauri environment, skipping sync init');
    return;
  }

  try {
    console.log('[FloorPlanSync] Initializing sync system...');
    await invoke('init_sync', { tenantId, apiBaseUrl });
    console.log('[FloorPlanSync] Sync system initialized');
  } catch (error) {
    console.error('[FloorPlanSync] Failed to initialize sync:', error);
    throw error;
  }
}

/**
 * Trigger immediate sync for floor plan data
 */
export async function triggerFloorPlanSync(tenantId: string): Promise<void> {
  if (!isTauri) {
    console.warn('[FloorPlanSync] Not in Tauri environment, skipping sync trigger');
    return;
  }

  try {
    // Sync all floor plan tables
    await invoke('trigger_sync', { dataType: 'floor_sections' });
    await invoke('trigger_sync', { dataType: 'floor_tables' });
    await invoke('trigger_sync', { dataType: 'floor_staff_assignments' });
    console.log('[FloorPlanSync] Triggered sync for all floor plan tables');
  } catch (error) {
    console.error('[FloorPlanSync] Failed to trigger sync:', error);
    throw error;
  }
}

/**
 * Get sync status
 */
export async function getFloorPlanSyncStatus(): Promise<{
  is_syncing: boolean;
  last_sync: number | null;
  pending_count: number;
  is_online: boolean;
}> {
  if (!isTauri) {
    return {
      is_syncing: false,
      last_sync: null,
      pending_count: 0,
      is_online: true,
    };
  }

  try {
    const status = await invoke<any>('get_sync_status');
    return status;
  } catch (error) {
    console.error('[FloorPlanSync] Failed to get sync status:', error);
    throw error;
  }
}

export const floorPlanSyncService = {
  syncToCloud: syncFloorPlanToCloud,
  init: initFloorPlanSync,
  trigger: triggerFloorPlanSync,
  getStatus: getFloorPlanSyncStatus,
};
