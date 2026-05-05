/**
 * Database Query Utilities
 * Fetch data from Cloudflare D1 for analysis
 */

import { Env, SalesDataRow, RecipeCostRow, InventoryItemRow } from '../types';
import { getTokenFromManager } from './tokenManager';

/**
 * Get D1 database ID for a tenant
 */
async function getTenantDatabaseId(tenantId: string, env: Env): Promise<string | null> {
  try {
    const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}:d1`, 'json') as any;
    return metadata?.databaseId || null;
  } catch (error) {
    console.error('Error fetching tenant D1 metadata:', error);
    return null;
  }
}

/**
 * Execute a D1 query
 */
async function executeD1Query<T = any>(
  databaseId: string,
  sql: string,
  params: any[],
  env: Env
): Promise<T[]> {
  const cloudflareToken = await getTokenFromManager('cloudflare:api_token', env);

  const queryUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`;

  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cloudflareToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sql,
      params
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`D1 query error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  return data.result?.[0]?.results || [];
}

/**
 * Fetch sales data for menu items (last 7 or 30 days)
 *
 * Note: Sales items are stored as JSON in sales_transactions.items_json
 * We need to expand the JSON array to analyze individual menu items
 */
export async function getSalesData(
  tenantId: string,
  timeRange: 'week' | 'month',
  env: Env
): Promise<SalesDataRow[]> {
  const databaseId = await getTenantDatabaseId(tenantId, env);
  if (!databaseId) {
    console.warn(`No D1 database found for tenant ${tenantId}`);
    return [];
  }

  const daysBack = timeRange === 'week' ? 7 : 30;

  // Get all sales transactions with items_json
  const sql = `
    SELECT
      id,
      items_json,
      completed_at
    FROM sales_transactions
    WHERE tenant_id = ?
      AND completed_at >= datetime('now', '-' || ? || ' days')
    ORDER BY completed_at DESC
    LIMIT 500
  `;

  try {
    const transactions = await executeD1Query<{
      id: string;
      items_json: string;
      completed_at: string;
    }>(databaseId, sql, [tenantId, daysBack], env);

    console.log(`Found ${transactions.length} transactions for tenant ${tenantId}`);

    // Parse items from JSON and aggregate by menu item
    const itemsMap = new Map<string, {
      name: string;
      totalSales: number;
      totalRevenue: number;
      totalPrice: number;
      count: number;
    }>();

    for (const transaction of transactions) {
      try {
        const items = JSON.parse(transaction.items_json);

        for (const item of items) {
          const key = item.menu_item?.id || item.menu_item?.name || 'unknown';
          const existing = itemsMap.get(key);
          const price = item.price || item.menu_item?.price || 0;
          const quantity = item.quantity || 1;
          const subtotal = price * quantity;

          if (existing) {
            existing.totalSales += quantity;
            existing.totalRevenue += subtotal;
            existing.totalPrice += price;
            existing.count += 1;
          } else {
            itemsMap.set(key, {
              name: item.menu_item?.name || item.name || 'Unknown Item',
              totalSales: quantity,
              totalRevenue: subtotal,
              totalPrice: price,
              count: 1
            });
          }
        }
      } catch (parseError) {
        console.error('Error parsing items_json:', parseError);
      }
    }

    // Convert map to array
    const salesData: SalesDataRow[] = [];
    itemsMap.forEach((data, itemId) => {
      salesData.push({
        menu_item_id: itemId,
        menu_item_name: data.name,
        category: null,
        total_sales: data.totalSales,
        total_revenue: data.totalRevenue,
        avg_price: data.totalPrice / data.count
      });
    });

    // Sort by revenue
    salesData.sort((a, b) => b.total_revenue - a.total_revenue);

    console.log(`Aggregated ${salesData.length} unique menu items`);

    return salesData;
  } catch (error) {
    console.error('Error fetching sales data:', error);
    return [];
  }
}

/**
 * Fetch recipe costs (food cost per menu item)
 */
export async function getRecipeCosts(
  tenantId: string,
  env: Env
): Promise<RecipeCostRow[]> {
  const databaseId = await getTenantDatabaseId(tenantId, env);
  if (!databaseId) {
    return [];
  }

  const sql = `
    SELECT
      ri.recipe_id as menu_item_id,
      SUM(ri.quantity * COALESCE(ii.last_purchase_price, 0)) as total_food_cost
    FROM recipe_ingredients ri
    LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id
    WHERE ri.tenant_id = ?
    GROUP BY ri.recipe_id
  `;

  try {
    return await executeD1Query<RecipeCostRow>(databaseId, sql, [tenantId], env);
  } catch (error) {
    console.error('Error fetching recipe costs:', error);
    return [];
  }
}

/**
 * Fetch inventory items with prices
 */
export async function getInventoryItems(
  tenantId: string,
  env: Env
): Promise<InventoryItemRow[]> {
  const databaseId = await getTenantDatabaseId(tenantId, env);
  if (!databaseId) {
    return [];
  }

  const sql = `
    SELECT
      id,
      name,
      last_purchase_price,
      unit
    FROM inventory_items
    WHERE tenant_id = ?
    ORDER BY name
    LIMIT 500
  `;

  try {
    return await executeD1Query<InventoryItemRow>(databaseId, sql, [tenantId], env);
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    return [];
  }
}
