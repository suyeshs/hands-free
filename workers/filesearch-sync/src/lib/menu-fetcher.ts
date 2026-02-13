/**
 * Menu Fetcher - Fetches menu data from tenant workers
 */

import type { Env, MenuData, MenuItem } from '../types';

/**
 * Fetch menu from tenant worker via service binding
 */
export async function fetchMenuFromTenant(
  env: Env,
  tenantId: string
): Promise<MenuData> {
  try {
    console.log(`[MenuFetcher] Fetching menu for tenant: ${tenantId}`);

    // Call tenant worker via dispatch namespace
    // Dispatch namespaces require: get(workerName).fetch(url)
    const workerName = `tenant-${tenantId}`;
    const tenantWorker = env.TENANT_DISPATCH.get(workerName);

    // Use simple URL for dispatch namespace (doesn't need actual domain)
    const url = 'https://tenant-worker/menu';

    const response = await tenantWorker.fetch(url, {
      headers: {
        'X-Tenant-Id': tenantId
      }
    });

    if (!response.ok) {
      throw new Error(`Tenant worker returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as any;

    if (!data.success || !Array.isArray(data.items)) {
      throw new Error('Invalid response from tenant worker');
    }

    console.log(`[MenuFetcher] Fetched ${data.items.length} menu items`);

    // Extract categories from items
    const categoriesMap = new Map<string, { name: string; order: number }>();
    let categoryOrder = 0;

    data.items.forEach((item: MenuItem) => {
      if (item.category && !categoriesMap.has(item.category)) {
        categoriesMap.set(item.category, {
          name: item.category,
          order: categoryOrder++
        });
      }
    });

    const categories = Array.from(categoriesMap.entries()).map(([name, data]) => ({
      id: name,
      name: name,
      description: '',
      display_order: data.order
    }));

    return {
      items: data.items,
      categories
    };

  } catch (error) {
    console.error('[MenuFetcher] Failed to fetch menu:', error);
    throw new Error(
      `Failed to fetch menu from tenant worker: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get menu item count from tenant worker
 */
export async function getMenuItemCount(
  env: Env,
  tenantId: string
): Promise<number> {
  try {
    const menuData = await fetchMenuFromTenant(env, tenantId);
    return menuData.items.filter(item => item.available !== 0).length;
  } catch (error) {
    console.error('[MenuFetcher] Failed to get item count:', error);
    return 0;
  }
}
