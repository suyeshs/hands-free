/**
 * Dine-In Pricing Service
 * Manages dine-in pricing overrides stored in D1 database
 * These override the default menu prices for dine-in orders
 */

import { getTenantDatabase } from './tenant-db-resolver';

export interface Env {
  [key: string]: any;
}

export interface DineInPricingOverride {
  id: string;
  menuItemId: string;
  tenantId: string;
  dineInPrice: number | null;
  dineInAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DineInPricingRow {
  id: string;
  menu_item_id: string;
  tenant_id: string;
  dine_in_price: number | null;
  dine_in_available: number;
  created_at: string;
  updated_at: string;
}

/**
 * Ensure the dine_in_pricing_overrides table exists
 */
export async function ensureDineInPricingTable(tenantId: string, env: Env): Promise<void> {
  const db = getTenantDatabase(tenantId, env);

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS dine_in_pricing_overrides (
        id TEXT PRIMARY KEY,
        menu_item_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        dine_in_price REAL,
        dine_in_available INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(menu_item_id, tenant_id)
      )
    `).run();
  } catch (error) {
    // Table likely already exists, which is fine
    console.log('[DineInPricing] Table creation result:', error);
  }
}

/**
 * Get all dine-in pricing overrides for a tenant
 */
export async function getDineInPricingOverrides(
  tenantId: string,
  env: Env
): Promise<DineInPricingOverride[]> {
  const db = getTenantDatabase(tenantId, env);

  // Ensure table exists
  await ensureDineInPricingTable(tenantId, env);

  const result = await db
    .prepare('SELECT * FROM dine_in_pricing_overrides WHERE tenant_id = ?')
    .bind(tenantId)
    .all<DineInPricingRow>();

  // Handle case where results might be undefined
  if (!result || !result.results) {
    console.log('[DineInPricing] No results from D1 query, returning empty array');
    return [];
  }

  return result.results.map(rowToOverride);
}

/**
 * Get a specific dine-in pricing override
 */
export async function getDineInPricingOverride(
  tenantId: string,
  menuItemId: string,
  env: Env
): Promise<DineInPricingOverride | null> {
  const db = getTenantDatabase(tenantId, env);

  const result = await db
    .prepare('SELECT * FROM dine_in_pricing_overrides WHERE tenant_id = ? AND menu_item_id = ?')
    .bind(tenantId, menuItemId)
    .first<DineInPricingRow>();

  return result ? rowToOverride(result) : null;
}

/**
 * Save or update a dine-in pricing override
 */
export async function saveDineInPricingOverride(
  tenantId: string,
  menuItemId: string,
  dineInPrice: number | null,
  dineInAvailable: boolean,
  env: Env
): Promise<DineInPricingOverride> {
  const db = getTenantDatabase(tenantId, env);

  // Ensure table exists
  await ensureDineInPricingTable(tenantId, env);

  const id = `dinein-${tenantId}-${menuItemId}`;
  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO dine_in_pricing_overrides (id, menu_item_id, tenant_id, dine_in_price, dine_in_available, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(menu_item_id, tenant_id) DO UPDATE SET
        dine_in_price = excluded.dine_in_price,
        dine_in_available = excluded.dine_in_available,
        updated_at = excluded.updated_at
    `)
    .bind(id, menuItemId, tenantId, dineInPrice, dineInAvailable ? 1 : 0, now, now)
    .run();

  console.log(`[DineInPricing] Saved override for ${menuItemId}: price=${dineInPrice}, available=${dineInAvailable}`);

  return {
    id,
    menuItemId,
    tenantId,
    dineInPrice,
    dineInAvailable,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Delete a dine-in pricing override (reset to cloud price)
 */
export async function deleteDineInPricingOverride(
  tenantId: string,
  menuItemId: string,
  env: Env
): Promise<void> {
  const db = getTenantDatabase(tenantId, env);

  await db
    .prepare('DELETE FROM dine_in_pricing_overrides WHERE tenant_id = ? AND menu_item_id = ?')
    .bind(tenantId, menuItemId)
    .run();

  console.log(`[DineInPricing] Deleted override for ${menuItemId}`);
}

/**
 * Bulk save dine-in pricing overrides (for sync from POS)
 */
export async function bulkSaveDineInPricingOverrides(
  tenantId: string,
  overrides: Array<{ menuItemId: string; dineInPrice: number | null; dineInAvailable: boolean }>,
  env: Env
): Promise<number> {
  const db = getTenantDatabase(tenantId, env);

  // Ensure table exists
  await ensureDineInPricingTable(tenantId, env);

  const now = new Date().toISOString();
  let savedCount = 0;

  for (const override of overrides) {
    const id = `dinein-${tenantId}-${override.menuItemId}`;

    await db
      .prepare(`
        INSERT INTO dine_in_pricing_overrides (id, menu_item_id, tenant_id, dine_in_price, dine_in_available, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(menu_item_id, tenant_id) DO UPDATE SET
          dine_in_price = excluded.dine_in_price,
          dine_in_available = excluded.dine_in_available,
          updated_at = excluded.updated_at
      `)
      .bind(id, override.menuItemId, tenantId, override.dineInPrice, override.dineInAvailable ? 1 : 0, now, now)
      .run();

    savedCount++;
  }

  console.log(`[DineInPricing] Bulk saved ${savedCount} overrides for tenant ${tenantId}`);
  return savedCount;
}

/**
 * Reset all dine-in pricing overrides for a tenant
 */
export async function resetAllDineInPricingOverrides(
  tenantId: string,
  env: Env
): Promise<number> {
  const db = getTenantDatabase(tenantId, env);

  // Get count before delete
  const countResult = await db
    .prepare('SELECT COUNT(*) as count FROM dine_in_pricing_overrides WHERE tenant_id = ?')
    .bind(tenantId)
    .first<{ count: number }>();

  const count = countResult?.count || 0;

  await db
    .prepare('DELETE FROM dine_in_pricing_overrides WHERE tenant_id = ?')
    .bind(tenantId)
    .run();

  console.log(`[DineInPricing] Reset ${count} overrides for tenant ${tenantId}`);
  return count;
}

function rowToOverride(row: DineInPricingRow): DineInPricingOverride {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    tenantId: row.tenant_id,
    dineInPrice: row.dine_in_price,
    dineInAvailable: row.dine_in_available === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
