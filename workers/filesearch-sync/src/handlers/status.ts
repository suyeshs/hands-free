/**
 * Status Handler - Check File Search sync status
 */

import type { Env, SyncStatus } from '../types';
import { getMenuItemCount } from '../lib/menu-fetcher';
import { getSyncMetadata } from './sync';

/**
 * Check File Search sync status
 * GET /status/:tenantId
 */
export async function handleStatusRequest(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    console.log(`[Status] Checking sync status for tenant: ${tenantId}`);

    const status = await checkSyncStatus(env, tenantId);

    return Response.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('[Status] Status check failed:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: {
        inSync: false,
        lastSyncTime: null,
        d1ItemCount: 0,
        fileSearchItemCount: null,
        errors: [error instanceof Error ? error.message : 'Status check failed'],
        needsSync: true,
        tenantId
      }
    }, { status: 500 });
  }
}

/**
 * Check if File Search is in sync with D1
 */
export async function checkSyncStatus(
  env: Env,
  tenantId: string
): Promise<SyncStatus> {
  // Get current menu item count from tenant worker
  const d1ItemCount = await getMenuItemCount(env, tenantId);

  // Get sync metadata from KV
  const metadata = await getSyncMetadata(env, tenantId);

  const errors: string[] = [];

  // Determine if sync is needed
  let needsSync = false;

  if (!metadata.lastSyncTime) {
    needsSync = true;
    errors.push('Never synced - initial sync required');
  } else if (metadata.itemCount === null) {
    needsSync = true;
    errors.push('Item count not recorded - sync recommended');
  } else if (metadata.itemCount !== d1ItemCount) {
    needsSync = true;
    const diff = Math.abs(metadata.itemCount - d1ItemCount);
    errors.push(
      `Item count mismatch: D1 has ${d1ItemCount} items, File Search has ${metadata.itemCount} items (${diff} difference)`
    );
  } else {
    // Check if last sync is too old (more than 24 hours)
    const lastSync = new Date(metadata.lastSyncTime);
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync > 24) {
      needsSync = true;
      errors.push(`Last sync was ${Math.floor(hoursSinceSync)} hours ago - refresh recommended`);
    }
  }

  const status: SyncStatus = {
    inSync: !needsSync,
    lastSyncTime: metadata.lastSyncTime,
    d1ItemCount,
    fileSearchItemCount: metadata.itemCount,
    errors,
    needsSync,
    tenantId
  };

  console.log(`[Status] Status check complete:`, {
    tenantId,
    inSync: status.inSync,
    d1ItemCount,
    fileSearchItemCount: metadata.itemCount,
    needsSync
  });

  return status;
}

/**
 * Batch status check for multiple tenants
 * POST /status/batch
 * Body: { tenantIds: string[] }
 */
export async function handleBatchStatusRequest(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as { tenantIds: string[] };
    const tenantIds = body.tenantIds || [];

    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return Response.json({
        success: false,
        error: 'Invalid request: tenantIds array required'
      }, { status: 400 });
    }

    console.log(`[Status] Batch status check for ${tenantIds.length} tenants`);

    // Check status for all tenants in parallel
    const results = await Promise.all(
      tenantIds.map(async (tenantId) => {
        try {
          const status = await checkSyncStatus(env, tenantId);
          return { tenantId, status, success: true };
        } catch (error) {
          return {
            tenantId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Aggregate stats
    const total = results.length;
    const inSync = results.filter(r => r.success && r.status?.inSync).length;
    const needsSync = results.filter(r => r.success && r.status?.needsSync).length;
    const errors = results.filter(r => !r.success).length;

    return Response.json({
      success: true,
      summary: {
        total,
        inSync,
        needsSync,
        errors
      },
      results
    });

  } catch (error) {
    console.error('[Status] Batch status check failed:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
