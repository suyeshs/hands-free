/**
 * Webhook Handler - Receives menu updates and syncs to all destinations
 *
 * This webhook is called by:
 * - POS systems after menu changes
 * - Admin panel after menu edits
 * - Automated menu imports
 *
 * Flow: D1 → KV → File Search (all in one operation)
 */

import type { Env } from '../types';
import { syncMenuToFileSearch } from './sync';

/**
 * Webhook endpoint for menu updates
 * POST /webhook/menu-updated
 * Body: { tenantId: string, trigger: string }
 */
export async function handleMenuUpdateWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as {
      tenantId: string;
      trigger?: string;
      itemsChanged?: number;
    };

    const { tenantId, trigger = 'unknown', itemsChanged } = body;

    if (!tenantId) {
      return Response.json({
        success: false,
        error: 'tenantId is required'
      }, { status: 400 });
    }

    console.log(`[Webhook] Menu update webhook received:`, {
      tenantId,
      trigger,
      itemsChanged
    });

    // Trigger File Search sync asynchronously
    // Using waitUntil to not block the response
    const ctx = request as Request & { waitUntil?: (promise: Promise<any>) => void };

    if (ctx.waitUntil) {
      ctx.waitUntil(
        syncMenuToFileSearch(env, tenantId)
          .then(result => {
            console.log(`[Webhook] Auto-sync completed for ${tenantId}:`, result);
          })
          .catch(error => {
            console.error(`[Webhook] Auto-sync failed for ${tenantId}:`, error);
          })
      );
    } else {
      // Fallback: sync in background (fire and forget)
      syncMenuToFileSearch(env, tenantId)
        .catch(error => {
          console.error(`[Webhook] Auto-sync failed for ${tenantId}:`, error);
        });
    }

    return Response.json({
      success: true,
      message: 'Menu sync triggered',
      tenantId,
      trigger
    });

  } catch (error) {
    console.error('[Webhook] Webhook processing failed:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * D1 to KV sync endpoint
 * POST /sync/d1-to-kv/:tenantId
 *
 * Syncs menu from D1 to KV for edge caching
 * This endpoint is called after D1 updates
 */
export async function handleD1ToKVSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    console.log(`[D1toKV] Syncing D1 → KV for tenant: ${tenantId}`);

    // Fetch menu from tenant worker (which reads from D1)
    // Dispatch namespaces require: get(workerName).fetch(url)
    const workerName = `tenant-${tenantId}`;
    const tenantWorker = env.TENANT_DISPATCH.get(workerName);

    // Use simple URL for dispatch namespace (doesn't need actual domain)
    const menuResponse = await tenantWorker.fetch(
      'https://tenant-worker/menu',
      {
        headers: { 'X-Tenant-Id': tenantId }
      }
    );

    if (!menuResponse.ok) {
      throw new Error(`Failed to fetch menu from D1: ${menuResponse.status}`);
    }

    const menuData = await menuResponse.json() as any;

    if (!menuData.success || !Array.isArray(menuData.items)) {
      throw new Error('Invalid menu data from D1');
    }

    // Build category hierarchy
    const categoryHierarchy: Record<string, any> = {};
    const tier1Metadata: any[] = [];
    const categorySet = new Set<string>();

    menuData.items.forEach((item: any) => {
      const category = item.category || 'Other';
      categorySet.add(category);

      if (!categoryHierarchy[category]) {
        categoryHierarchy[category] = {
          name: category,
          items: [],
          count: 0
        };
      }

      categoryHierarchy[category].items.push(item);
      categoryHierarchy[category].count++;
    });

    // Build tier1 metadata
    let displayOrder = 0;
    Array.from(categorySet).forEach(categoryName => {
      tier1Metadata.push({
        name: categoryName,
        count: categoryHierarchy[categoryName].count,
        displayOrder: displayOrder++
      });
    });

    // Prepare KV data structure
    const kvData = {
      metadata: {
        totalItems: menuData.items.length,
        totalCategories: categorySet.size,
        lastUpdated: new Date().toISOString(),
        tenantId
      },
      categoryHierarchy,
      tier1Metadata,
      items: menuData.items
    };

    // Store in KV with multiple keys for different access patterns
    const kvPrefix = `menu:${tenantId}`;

    await Promise.all([
      env.TENANT_METADATA.put(
        `${kvPrefix}:data`,
        JSON.stringify(kvData),
        { expirationTtl: 86400 * 7 } // 7 days
      ),
      env.TENANT_METADATA.put(
        `${kvPrefix}:metadata`,
        JSON.stringify(kvData.metadata),
        { expirationTtl: 86400 * 7 }
      ),
      env.TENANT_METADATA.put(
        `${kvPrefix}:categories`,
        JSON.stringify(categoryHierarchy),
        { expirationTtl: 86400 * 7 }
      )
    ]);

    console.log(`[D1toKV] Synced ${menuData.items.length} items to KV`);

    return Response.json({
      success: true,
      message: `Synced ${menuData.items.length} items from D1 to KV`,
      stats: {
        items: menuData.items.length,
        categories: categorySet.size
      }
    });

  } catch (error) {
    console.error('[D1toKV] Sync failed:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Full sync endpoint: D1 → KV → File Search
 * POST /sync/full/:tenantId
 *
 * Performs a complete sync across all systems
 */
export async function handleFullSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    console.log(`[FullSync] Starting full sync for tenant: ${tenantId}`);

    const results = {
      d1ToKv: { success: false, error: null as string | null },
      fileSearch: { success: false, error: null as string | null }
    };

    // Step 1: Sync D1 to KV
    try {
      const kvSyncResponse = await handleD1ToKVSync(
        new Request('http://internal/sync', { method: 'POST' }),
        env,
        tenantId
      );
      const kvSyncData = await kvSyncResponse.json() as any;
      results.d1ToKv.success = kvSyncData.success;
      if (!kvSyncData.success) {
        results.d1ToKv.error = kvSyncData.error;
      }
    } catch (error) {
      results.d1ToKv.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Step 2: Sync to File Search
    try {
      const fsResult = await syncMenuToFileSearch(env, tenantId);
      results.fileSearch.success = fsResult.success;
      if (!fsResult.success) {
        results.fileSearch.error = fsResult.errors?.join(', ') || 'Unknown error';
      }
    } catch (error) {
      results.fileSearch.error = error instanceof Error ? error.message : 'Unknown error';
    }

    const allSucceeded = results.d1ToKv.success && results.fileSearch.success;

    return Response.json({
      success: allSucceeded,
      message: allSucceeded
        ? 'Full sync completed successfully'
        : 'Full sync completed with errors',
      results
    });

  } catch (error) {
    console.error('[FullSync] Full sync failed:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
