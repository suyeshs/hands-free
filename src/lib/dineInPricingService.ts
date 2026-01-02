/**
 * Dine-In Pricing Service
 * Manages local SQLite storage for dine-in pricing overrides with cloud sync
 *
 * This allows restaurants to set different prices for dine-in vs delivery/takeout
 * Overrides persist across menu syncs from the cloud
 *
 * Sync Strategy:
 * - On load: Fetch from cloud, merge with local (cloud wins), store locally
 * - On save/delete: Update local first (for offline), then push to cloud
 */

import Database from '@tauri-apps/plugin-sql';
import { DineInPricingOverride } from '../types';
import { backendApi } from './backendApi';

interface DineInPricingRow {
  id: string;
  menu_item_id: string;
  tenant_id: string;
  dine_in_price: number | null;
  dine_in_available: number;
  created_at: string;
  updated_at: string;
}

class DineInPricingService {
  private db: Database | null = null;
  private dbPromise: Promise<Database> | null = null;
  private tableCreated = false;

  private async getDb(): Promise<Database> {
    if (this.db) return this.db;
    if (!this.dbPromise) {
      this.dbPromise = Database.load('sqlite:pos.db').then(async (db) => {
        this.db = db;
        if (!this.tableCreated) {
          await this.ensureTable();
          this.tableCreated = true;
        }
        return db;
      });
    }
    return this.dbPromise;
  }

  private async ensureTable(): Promise<void> {
    const db = this.db!;
    await db.execute(`
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
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_dine_in_pricing_tenant
      ON dine_in_pricing_overrides(tenant_id)
    `);
    console.log('[DineInPricing] Table ensured');
  }

  /**
   * Get all overrides for a tenant (syncs from cloud first)
   */
  async getOverrides(tenantId: string): Promise<DineInPricingOverride[]> {
    const db = await this.getDb();

    // Try to sync from cloud first
    try {
      await this.syncFromCloud(tenantId);
    } catch (error) {
      console.warn('[DineInPricing] Cloud sync failed, using local data:', error);
    }

    const rows = await db.select<DineInPricingRow[]>(
      `SELECT * FROM dine_in_pricing_overrides WHERE tenant_id = $1`,
      [tenantId]
    );
    return rows.map(this.rowToOverride);
  }

  /**
   * Sync overrides from cloud to local storage
   * Cloud data takes precedence (source of truth for multi-device sync)
   */
  private async syncFromCloud(tenantId: string): Promise<void> {
    const db = await this.getDb();

    // Fetch from cloud
    const cloudOverrides = await backendApi.getDineInPricingOverrides(tenantId);
    console.log(`[DineInPricing] Fetched ${cloudOverrides.length} overrides from cloud`);

    if (cloudOverrides.length === 0) {
      return;
    }

    // Upsert each cloud override into local storage
    const now = new Date().toISOString();
    for (const override of cloudOverrides) {
      const id = `dinein-${tenantId}-${override.menuItemId}`;
      await db.execute(
        `INSERT INTO dine_in_pricing_overrides (id, menu_item_id, tenant_id, dine_in_price, dine_in_available, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT(menu_item_id, tenant_id) DO UPDATE SET
           dine_in_price = $4,
           dine_in_available = $5,
           updated_at = $6`,
        [id, override.menuItemId, tenantId, override.dineInPrice, override.dineInAvailable ? 1 : 0, now]
      );
    }

    console.log(`[DineInPricing] Synced ${cloudOverrides.length} overrides from cloud to local`);
  }

  /**
   * Get override for a specific menu item
   */
  async getOverride(tenantId: string, menuItemId: string): Promise<DineInPricingOverride | null> {
    const db = await this.getDb();
    const rows = await db.select<DineInPricingRow[]>(
      `SELECT * FROM dine_in_pricing_overrides WHERE tenant_id = $1 AND menu_item_id = $2`,
      [tenantId, menuItemId]
    );
    return rows.length > 0 ? this.rowToOverride(rows[0]) : null;
  }

  /**
   * Save or update an override (local first, then cloud)
   */
  async saveOverride(
    tenantId: string,
    menuItemId: string,
    dineInPrice: number | null,
    dineInAvailable: boolean
  ): Promise<void> {
    const db = await this.getDb();
    const id = `dinein-${tenantId}-${menuItemId}`;
    const now = new Date().toISOString();

    // Save locally first (for offline support)
    await db.execute(
      `INSERT INTO dine_in_pricing_overrides (id, menu_item_id, tenant_id, dine_in_price, dine_in_available, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT(menu_item_id, tenant_id) DO UPDATE SET
         dine_in_price = $4,
         dine_in_available = $5,
         updated_at = $6`,
      [id, menuItemId, tenantId, dineInPrice, dineInAvailable ? 1 : 0, now]
    );
    console.log(`[DineInPricing] Saved override locally for ${menuItemId}: price=${dineInPrice}, available=${dineInAvailable}`);

    // Push to cloud (non-blocking, best effort)
    try {
      await backendApi.saveDineInPricingOverride(tenantId, menuItemId, dineInPrice, dineInAvailable);
      console.log(`[DineInPricing] Pushed override to cloud for ${menuItemId}`);
    } catch (error) {
      console.warn(`[DineInPricing] Failed to push override to cloud for ${menuItemId}:`, error);
      // Local save succeeded, cloud sync will happen on next load
    }
  }

  /**
   * Delete an override (reset to cloud price) - local first, then cloud
   */
  async deleteOverride(tenantId: string, menuItemId: string): Promise<void> {
    const db = await this.getDb();

    // Delete locally first
    await db.execute(
      `DELETE FROM dine_in_pricing_overrides WHERE tenant_id = $1 AND menu_item_id = $2`,
      [tenantId, menuItemId]
    );
    console.log(`[DineInPricing] Deleted override locally for ${menuItemId}`);

    // Push to cloud (non-blocking, best effort)
    try {
      await backendApi.deleteDineInPricingOverride(tenantId, menuItemId);
      console.log(`[DineInPricing] Deleted override from cloud for ${menuItemId}`);
    } catch (error) {
      console.warn(`[DineInPricing] Failed to delete override from cloud for ${menuItemId}:`, error);
    }
  }

  /**
   * Bulk reset all overrides for a tenant - local first, then cloud
   */
  async resetAllOverrides(tenantId: string): Promise<number> {
    const db = await this.getDb();
    const countResult = await db.select<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM dine_in_pricing_overrides WHERE tenant_id = $1`,
      [tenantId]
    );
    const count = countResult[0]?.count || 0;

    // Delete locally first
    await db.execute(`DELETE FROM dine_in_pricing_overrides WHERE tenant_id = $1`, [tenantId]);
    console.log(`[DineInPricing] Reset ${count} overrides locally for tenant ${tenantId}`);

    // Push to cloud (non-blocking, best effort)
    try {
      await backendApi.resetAllDineInPricingOverrides(tenantId);
      console.log(`[DineInPricing] Reset all overrides from cloud for tenant ${tenantId}`);
    } catch (error) {
      console.warn(`[DineInPricing] Failed to reset overrides from cloud for tenant ${tenantId}:`, error);
    }

    return count;
  }

  /**
   * Clean up orphaned overrides (menu items that no longer exist)
   */
  async cleanupOrphanedOverrides(tenantId: string, validMenuItemIds: string[]): Promise<number> {
    if (validMenuItemIds.length === 0) return 0;
    const db = await this.getDb();

    // Get current overrides
    const currentOverrides = await db.select<Array<{ menu_item_id: string }>>(
      `SELECT menu_item_id FROM dine_in_pricing_overrides WHERE tenant_id = $1`,
      [tenantId]
    );

    // Find orphans
    const validSet = new Set(validMenuItemIds);
    const orphanIds = currentOverrides
      .map(o => o.menu_item_id)
      .filter(id => !validSet.has(id));

    if (orphanIds.length === 0) return 0;

    // Delete orphans one by one (safer for SQLite)
    for (const orphanId of orphanIds) {
      await db.execute(
        `DELETE FROM dine_in_pricing_overrides WHERE tenant_id = $1 AND menu_item_id = $2`,
        [tenantId, orphanId]
      );
    }

    console.log(`[DineInPricing] Cleaned up ${orphanIds.length} orphaned overrides`);
    return orphanIds.length;
  }

  private rowToOverride(row: DineInPricingRow): DineInPricingOverride {
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
}

export const dineInPricingService = new DineInPricingService();
