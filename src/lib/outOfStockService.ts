/**
 * Out of Stock Service
 * Handles SQLite persistence for out-of-stock (86) items
 */

import Database from '@tauri-apps/plugin-sql';
import type { OutOfStockItem } from '../types/stock';

interface OutOfStockRow {
  id: string;
  item_name: string;
  menu_item_id: string | null;
  portions_out: number;
  created_at: string;
  created_by_device_id: string | null;
  created_by_staff_name: string | null;
  is_active: number;
  tenant_id: string;
}

class OutOfStockService {
  private db: Database | null = null;
  private dbPromise: Promise<Database> | null = null;

  private async getDb(): Promise<Database> {
    if (this.db) return this.db;

    if (!this.dbPromise) {
      this.dbPromise = Database.load('sqlite:pos.db').then((db) => {
        this.db = db;
        return db;
      });
    }

    return this.dbPromise;
  }

  /**
   * Save a new out-of-stock item
   */
  async saveItem(tenantId: string, item: OutOfStockItem): Promise<void> {
    const db = await this.getDb();

    await db.execute(
      `INSERT INTO out_of_stock_items (
        id, item_name, menu_item_id, portions_out, created_at,
        created_by_device_id, created_by_staff_name, is_active, tenant_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT(id) DO UPDATE SET
        portions_out = $4,
        is_active = $8`,
      [
        item.id,
        item.itemName,
        item.menuItemId ?? null,
        item.portionsOut,
        item.createdAt,
        item.createdByDeviceId ?? null,
        item.createdByStaffName ?? null,
        item.isActive ? 1 : 0,
        tenantId,
      ]
    );
  }

  /**
   * Get all active out-of-stock items for a tenant
   */
  async getActiveItems(tenantId: string): Promise<OutOfStockItem[]> {
    const db = await this.getDb();

    const rows = await db.select<OutOfStockRow[]>(
      `SELECT * FROM out_of_stock_items WHERE tenant_id = $1 AND is_active = 1 ORDER BY created_at DESC`,
      [tenantId]
    );

    return rows.map((row) => this.rowToItem(row));
  }

  /**
   * Get all out-of-stock items (including inactive) for a tenant
   */
  async getAllItems(tenantId: string): Promise<OutOfStockItem[]> {
    const db = await this.getDb();

    const rows = await db.select<OutOfStockRow[]>(
      `SELECT * FROM out_of_stock_items WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );

    return rows.map((row) => this.rowToItem(row));
  }

  /**
   * Mark an item as back in stock (set is_active = false)
   */
  async markBackInStock(itemId: string): Promise<void> {
    const db = await this.getDb();

    await db.execute(
      `UPDATE out_of_stock_items SET is_active = 0 WHERE id = $1`,
      [itemId]
    );
  }

  /**
   * Delete an out-of-stock item completely
   */
  async deleteItem(itemId: string): Promise<void> {
    const db = await this.getDb();
    await db.execute(`DELETE FROM out_of_stock_items WHERE id = $1`, [itemId]);
  }

  /**
   * Clear all out-of-stock items for a tenant
   */
  async clearAllItems(tenantId: string): Promise<number> {
    const db = await this.getDb();

    const countResult = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM out_of_stock_items WHERE tenant_id = $1`,
      [tenantId]
    );
    const count = countResult[0]?.count || 0;

    await db.execute(`DELETE FROM out_of_stock_items WHERE tenant_id = $1`, [tenantId]);

    console.log(`[OutOfStockService] Cleared ${count} items for tenant ${tenantId}`);
    return count;
  }

  /**
   * Check if an item name is currently out of stock
   */
  async isItemOutOfStock(tenantId: string, itemName: string): Promise<boolean> {
    const db = await this.getDb();

    const rows = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM out_of_stock_items
       WHERE tenant_id = $1 AND is_active = 1 AND LOWER(item_name) = LOWER($2)`,
      [tenantId, itemName]
    );

    return (rows[0]?.count || 0) > 0;
  }

  /**
   * Get out-of-stock item by name
   */
  async getItemByName(tenantId: string, itemName: string): Promise<OutOfStockItem | null> {
    const db = await this.getDb();

    const rows = await db.select<OutOfStockRow[]>(
      `SELECT * FROM out_of_stock_items
       WHERE tenant_id = $1 AND is_active = 1 AND LOWER(item_name) = LOWER($2)
       LIMIT 1`,
      [tenantId, itemName]
    );

    return rows.length > 0 ? this.rowToItem(rows[0]) : null;
  }

  private rowToItem(row: OutOfStockRow): OutOfStockItem {
    return {
      id: row.id,
      itemName: row.item_name,
      menuItemId: row.menu_item_id ?? undefined,
      portionsOut: row.portions_out,
      createdAt: row.created_at,
      createdByDeviceId: row.created_by_device_id ?? undefined,
      createdByStaffName: row.created_by_staff_name ?? undefined,
      isActive: row.is_active === 1,
    };
  }
}

export const outOfStockService = new OutOfStockService();
