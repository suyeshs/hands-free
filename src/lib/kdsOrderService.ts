/**
 * KDS Order Service
 * Handles SQLite persistence for kitchen display orders
 * Ensures orders persist across view switches in generic device mode
 */

import Database from '@tauri-apps/plugin-sql';
import { KitchenOrder, KitchenOrderItem } from '../types/kds';

interface KDSOrderRow {
  id: string;
  order_number: string;
  table_number: number | null;
  order_type: string;
  source: string;
  status: string;
  is_running_order: number;
  kot_sequence: number | null;
  items_json: string;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  elapsed_minutes: number;
  estimated_prep_time: number;
  is_urgent: number;
  priority: number;
  tenant_id: string;
}

class KDSOrderService {
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
   * Save or update a KDS order
   */
  async saveOrder(tenantId: string, order: KitchenOrder): Promise<void> {
    const db = await this.getDb();

    const itemsJson = JSON.stringify(order.items);

    await db.execute(
      `INSERT INTO kds_orders (
        id, order_number, table_number, order_type, source, status,
        is_running_order, kot_sequence, items_json, created_at, accepted_at,
        ready_at, completed_at, elapsed_minutes, estimated_prep_time, is_urgent, priority, tenant_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT(id) DO UPDATE SET
        status = $6,
        is_running_order = $7,
        items_json = $9,
        ready_at = $12,
        completed_at = $13,
        elapsed_minutes = $14,
        is_urgent = $16`,
      [
        order.id,
        order.orderNumber,
        order.tableNumber ?? null,
        order.orderType,
        order.source,
        order.status,
        order.isRunningOrder ? 1 : 0,
        order.kotSequence ?? null,
        itemsJson,
        order.createdAt,
        order.acceptedAt ?? null,
        order.readyAt ?? null,
        order.completedAt ?? null,
        order.elapsedMinutes ?? 0,
        order.estimatedPrepTime ?? 15,
        order.isUrgent ? 1 : 0,
        order.priority ?? 0,
        tenantId,
      ]
    );
  }

  /**
   * Get all active (non-completed) orders for a tenant
   */
  async getActiveOrders(tenantId: string): Promise<KitchenOrder[]> {
    const db = await this.getDb();

    const rows = await db.select<KDSOrderRow[]>(
      `SELECT * FROM kds_orders WHERE tenant_id = $1 AND status != 'completed' ORDER BY created_at DESC`,
      [tenantId]
    );

    return rows.map((row) => this.rowToOrder(row));
  }

  /**
   * Get completed orders for a tenant (for billing status checks)
   */
  async getCompletedOrders(tenantId: string, limit: number = 50): Promise<KitchenOrder[]> {
    const db = await this.getDb();

    const rows = await db.select<KDSOrderRow[]>(
      `SELECT * FROM kds_orders WHERE tenant_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT $2`,
      [tenantId, limit]
    );

    return rows.map((row) => this.rowToOrder(row));
  }

  /**
   * Get all orders (active + completed) for a tenant
   */
  async getAllOrders(tenantId: string): Promise<{ active: KitchenOrder[]; completed: KitchenOrder[] }> {
    const [active, completed] = await Promise.all([
      this.getActiveOrders(tenantId),
      this.getCompletedOrders(tenantId),
    ]);
    return { active, completed };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
    updates?: { readyAt?: string; completedAt?: string }
  ): Promise<void> {
    const db = await this.getDb();

    let query = `UPDATE kds_orders SET status = $1`;
    const params: (string | null)[] = [status];

    if (updates?.readyAt) {
      query += `, ready_at = $${params.length + 1}`;
      params.push(updates.readyAt);
    }

    if (updates?.completedAt) {
      query += `, completed_at = $${params.length + 1}`;
      params.push(updates.completedAt);
    }

    query += ` WHERE id = $${params.length + 1}`;
    params.push(orderId);

    await db.execute(query, params);
  }

  /**
   * Update item status within an order
   */
  async updateItemStatus(orderId: string, itemId: string, status: string): Promise<void> {
    const db = await this.getDb();

    // First get the current items
    const rows = await db.select<{ items_json: string }[]>(
      `SELECT items_json FROM kds_orders WHERE id = $1`,
      [orderId]
    );

    if (rows.length === 0) return;

    try {
      const items: KitchenOrderItem[] = JSON.parse(rows[0].items_json);
      const updatedItems = items.map((item) =>
        item.id === itemId ? { ...item, status } : item
      );

      await db.execute(
        `UPDATE kds_orders SET items_json = $1 WHERE id = $2`,
        [JSON.stringify(updatedItems), orderId]
      );
    } catch (e) {
      console.error('[KDSOrderService] Failed to update item status:', e);
    }
  }

  /**
   * Delete an order
   */
  async deleteOrder(orderId: string): Promise<void> {
    const db = await this.getDb();
    await db.execute(`DELETE FROM kds_orders WHERE id = $1`, [orderId]);
  }

  /**
   * Clear all orders for a tenant (for testing/reset)
   */
  async clearAllOrders(tenantId: string): Promise<number> {
    const db = await this.getDb();

    const countResult = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM kds_orders WHERE tenant_id = $1`,
      [tenantId]
    );
    const count = countResult[0]?.count || 0;

    await db.execute(`DELETE FROM kds_orders WHERE tenant_id = $1`, [tenantId]);

    console.log(`[KDSOrderService] Cleared ${count} orders for tenant ${tenantId}`);
    return count;
  }

  /**
   * Clean up old completed orders (older than specified days)
   */
  async cleanupOldOrders(daysOld: number = 7): Promise<void> {
    const db = await this.getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await db.execute(
      `DELETE FROM kds_orders WHERE status = 'completed' AND completed_at < $1`,
      [cutoffDate.toISOString()]
    );
  }

  /**
   * Delete completed orders for a specific table (after billing)
   */
  async clearCompletedOrdersForTable(tenantId: string, tableNumber: number): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      `DELETE FROM kds_orders WHERE tenant_id = $1 AND table_number = $2 AND status = 'completed'`,
      [tenantId, tableNumber]
    );
  }

  private rowToOrder(row: KDSOrderRow): KitchenOrder {
    let items: KitchenOrderItem[] = [];
    try {
      items = JSON.parse(row.items_json);
    } catch {
      items = [];
    }

    return {
      id: row.id,
      orderNumber: row.order_number,
      tableNumber: row.table_number ?? undefined,
      orderType: row.order_type as 'dine-in' | 'delivery' | 'pickup' | 'aggregator',
      source: row.source as 'pos' | 'online' | 'zomato' | 'swiggy',
      status: row.status as 'pending' | 'in_progress' | 'ready' | 'completed',
      isRunningOrder: row.is_running_order === 1,
      kotSequence: row.kot_sequence ?? undefined,
      items,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at ?? undefined,
      readyAt: row.ready_at ?? undefined,
      elapsedMinutes: row.elapsed_minutes,
      estimatedPrepTime: row.estimated_prep_time,
      isUrgent: row.is_urgent === 1,
      // Version and updatedAt for conflict resolution (default to 1 for legacy data)
      version: 1,
      updatedAt: row.created_at,
    };
  }
}

export const kdsOrderService = new KDSOrderService();
