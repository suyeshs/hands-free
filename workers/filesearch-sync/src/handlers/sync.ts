/**
 * Sync Handler - Core File Search sync operations
 */

import type { Env, SyncResult } from '../types';
import { fetchMenuFromTenant } from '../lib/menu-fetcher';
import { formatMenuForAI, generateMenuSummary } from '../lib/menu-formatter';
import { uploadToFileSearch } from '../lib/filesearch-uploader';

/**
 * Manually trigger File Search sync
 * POST /sync/:tenantId
 */
export async function handleSyncRequest(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    console.log(`[Sync] Manual sync triggered for tenant: ${tenantId}`);

    // Perform the sync
    const result = await syncMenuToFileSearch(env, tenantId);

    if (!result.success) {
      return Response.json({
        success: false,
        error: 'File Search sync failed',
        details: result.errors
      }, { status: 500 });
    }

    // Update KV cache with sync metadata
    await updateSyncMetadata(env, tenantId, result);

    return Response.json({
      success: true,
      message: `Synced ${result.itemCount} menu items to File Search`,
      result: {
        itemCount: result.itemCount,
        storeName: result.storeName,
        syncTime: result.syncTime
      }
    });

  } catch (error) {
    console.error('[Sync] Manual sync failed:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Core sync logic - fetches menu and uploads to File Search
 */
export async function syncMenuToFileSearch(
  env: Env,
  tenantId: string
): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    // Step 1: Fetch menu from tenant worker
    console.log(`[Sync] Step 1: Fetching menu from tenant worker...`);
    const menuData = await fetchMenuFromTenant(env, tenantId);

    const summary = generateMenuSummary(menuData);
    console.log(`[Sync] Fetched menu: ${summary}`);

    // Step 2: Format as AI-friendly document
    console.log(`[Sync] Step 2: Formatting menu for AI...`);
    const menuDocument = formatMenuForAI(tenantId, menuData);
    console.log(`[Sync] Generated ${menuDocument.length} bytes of formatted text`);

    // Step 3: Upload to File Search
    console.log(`[Sync] Step 3: Uploading to Google File Search...`);
    const uploadResult = await uploadToFileSearch(env, tenantId, menuDocument);

    const duration = Date.now() - startTime;
    console.log(`[Sync] Sync completed in ${duration}ms`);

    return {
      success: true,
      itemCount: menuData.items.length,
      storeName: uploadResult.storeName,
      syncTime: new Date().toISOString(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Sync] Sync failed after ${duration}ms:`, error);

    return {
      success: false,
      itemCount: 0,
      storeName: '',
      syncTime: new Date().toISOString(),
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * Update sync metadata in KV
 */
async function updateSyncMetadata(
  env: Env,
  tenantId: string,
  result: SyncResult
): Promise<void> {
  const lastSyncKey = `filesearch:${tenantId}:last_sync`;
  const itemCountKey = `filesearch:${tenantId}:item_count`;
  const storeNameKey = `filesearch:${tenantId}:store_name`;

  // Store with 7-day expiration
  const expirationTtl = 86400 * 7;

  await Promise.all([
    env.TENANT_METADATA.put(lastSyncKey, result.syncTime, { expirationTtl }),
    env.TENANT_METADATA.put(itemCountKey, result.itemCount.toString(), { expirationTtl }),
    env.TENANT_METADATA.put(storeNameKey, result.storeName, { expirationTtl })
  ]);

  console.log(`[Sync] Metadata updated in KV for tenant: ${tenantId}`);
}

/**
 * Get sync metadata from KV
 */
export async function getSyncMetadata(
  env: Env,
  tenantId: string
): Promise<{
  lastSyncTime: string | null;
  itemCount: number | null;
  storeName: string | null;
}> {
  const lastSyncKey = `filesearch:${tenantId}:last_sync`;
  const itemCountKey = `filesearch:${tenantId}:item_count`;
  const storeNameKey = `filesearch:${tenantId}:store_name`;

  const [lastSyncTime, itemCountStr, storeName] = await Promise.all([
    env.TENANT_METADATA.get(lastSyncKey),
    env.TENANT_METADATA.get(itemCountKey),
    env.TENANT_METADATA.get(storeNameKey)
  ]);

  return {
    lastSyncTime,
    itemCount: itemCountStr ? parseInt(itemCountStr) : null,
    storeName
  };
}
