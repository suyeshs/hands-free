/**
 * Order Mapping Database Service
 *
 * Persists order mappings to SQLite for recovery after restarts.
 * Used by OrderOrchestrationService to maintain aggregator-to-kitchen order relationships.
 */

import { isTauri } from './platform';
import { invoke } from '@tauri-apps/api/core';

// Order mapping as stored in database
export interface OrderMappingRow {
  aggregator_order_id: string;
  order_number: string;
  kitchen_order_id: string | null;
  source: string;
  current_status: string;
  kds_status: string | null;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
}

// Order mapping as used in code
export interface OrderMapping {
  aggregatorOrderId: string;
  orderNumber: string;
  kitchenOrderId: string | null;
  source: string;
  currentStatus: string;
  kdsStatus: string | null;
  createdAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
}

// Convert from database row to code format
function fromRow(row: OrderMappingRow): OrderMapping {
  return {
    aggregatorOrderId: row.aggregator_order_id,
    orderNumber: row.order_number,
    kitchenOrderId: row.kitchen_order_id,
    source: row.source,
    currentStatus: row.current_status,
    kdsStatus: row.kds_status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    readyAt: row.ready_at,
  };
}

// Convert from code format to database row
function toRow(mapping: OrderMapping): OrderMappingRow {
  return {
    aggregator_order_id: mapping.aggregatorOrderId,
    order_number: mapping.orderNumber,
    kitchen_order_id: mapping.kitchenOrderId,
    source: mapping.source,
    current_status: mapping.currentStatus,
    kds_status: mapping.kdsStatus,
    created_at: mapping.createdAt,
    accepted_at: mapping.acceptedAt,
    ready_at: mapping.readyAt,
  };
}

class OrderMappingDb {
  /**
   * Save or update an order mapping
   */
  async saveMapping(mapping: OrderMapping): Promise<void> {
    if (!isTauri()) {
      console.log('[OrderMappingDb] Not in Tauri, skipping save');
      return;
    }

    try {
      const row = toRow(mapping);
      await invoke<void>('execute_sql', {
        query: `
          INSERT INTO order_mappings (
            aggregator_order_id, order_number, kitchen_order_id, source,
            current_status, kds_status, created_at, accepted_at, ready_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(aggregator_order_id) DO UPDATE SET
            kitchen_order_id = excluded.kitchen_order_id,
            current_status = excluded.current_status,
            kds_status = excluded.kds_status,
            accepted_at = excluded.accepted_at,
            ready_at = excluded.ready_at,
            updated_at = datetime('now')
        `,
        params: [
          row.aggregator_order_id,
          row.order_number,
          row.kitchen_order_id,
          row.source,
          row.current_status,
          row.kds_status,
          row.created_at,
          row.accepted_at,
          row.ready_at,
        ],
      });
      console.log('[OrderMappingDb] Saved mapping:', mapping.aggregatorOrderId);
    } catch (error) {
      console.error('[OrderMappingDb] Failed to save mapping:', error);
      throw error;
    }
  }

  /**
   * Get a mapping by aggregator order ID
   */
  async getMapping(aggregatorOrderId: string): Promise<OrderMapping | null> {
    if (!isTauri()) {
      return null;
    }

    try {
      const rows = await invoke<OrderMappingRow[]>('query_sql', {
        query: 'SELECT * FROM order_mappings WHERE aggregator_order_id = ?',
        params: [aggregatorOrderId],
      });
      return rows.length > 0 ? fromRow(rows[0]) : null;
    } catch (error) {
      console.error('[OrderMappingDb] Failed to get mapping:', error);
      return null;
    }
  }

  /**
   * Get a mapping by kitchen order ID
   */
  async getMappingByKitchenOrder(kitchenOrderId: string): Promise<OrderMapping | null> {
    if (!isTauri()) {
      return null;
    }

    try {
      const rows = await invoke<OrderMappingRow[]>('query_sql', {
        query: 'SELECT * FROM order_mappings WHERE kitchen_order_id = ?',
        params: [kitchenOrderId],
      });
      return rows.length > 0 ? fromRow(rows[0]) : null;
    } catch (error) {
      console.error('[OrderMappingDb] Failed to get mapping by kitchen order:', error);
      return null;
    }
  }

  /**
   * Get all active mappings (not completed/rejected)
   */
  async getActiveMappings(): Promise<OrderMapping[]> {
    if (!isTauri()) {
      return [];
    }

    try {
      const rows = await invoke<OrderMappingRow[]>('query_sql', {
        query: `
          SELECT * FROM order_mappings
          WHERE current_status NOT IN ('completed', 'rejected', 'cancelled', 'delivered')
          ORDER BY created_at DESC
        `,
        params: [],
      });
      return rows.map(fromRow);
    } catch (error) {
      console.error('[OrderMappingDb] Failed to get active mappings:', error);
      return [];
    }
  }

  /**
   * Update mapping status
   */
  async updateStatus(
    aggregatorOrderId: string,
    currentStatus: string,
    updates?: { kdsStatus?: string; acceptedAt?: string; readyAt?: string }
  ): Promise<void> {
    if (!isTauri()) {
      return;
    }

    try {
      const setClauses = ['current_status = ?', "updated_at = datetime('now')"];
      const params: (string | null)[] = [currentStatus];

      if (updates?.kdsStatus !== undefined) {
        setClauses.push('kds_status = ?');
        params.push(updates.kdsStatus);
      }
      if (updates?.acceptedAt !== undefined) {
        setClauses.push('accepted_at = ?');
        params.push(updates.acceptedAt);
      }
      if (updates?.readyAt !== undefined) {
        setClauses.push('ready_at = ?');
        params.push(updates.readyAt);
      }

      params.push(aggregatorOrderId);

      await invoke<void>('execute_sql', {
        query: `UPDATE order_mappings SET ${setClauses.join(', ')} WHERE aggregator_order_id = ?`,
        params,
      });
      console.log('[OrderMappingDb] Updated status:', aggregatorOrderId, currentStatus);
    } catch (error) {
      console.error('[OrderMappingDb] Failed to update status:', error);
      throw error;
    }
  }

  /**
   * Update kitchen order ID for a mapping
   */
  async updateKitchenOrderId(aggregatorOrderId: string, kitchenOrderId: string): Promise<void> {
    if (!isTauri()) {
      return;
    }

    try {
      await invoke<void>('execute_sql', {
        query: `
          UPDATE order_mappings
          SET kitchen_order_id = ?, updated_at = datetime('now')
          WHERE aggregator_order_id = ?
        `,
        params: [kitchenOrderId, aggregatorOrderId],
      });
      console.log('[OrderMappingDb] Updated kitchen order ID:', aggregatorOrderId, '->', kitchenOrderId);
    } catch (error) {
      console.error('[OrderMappingDb] Failed to update kitchen order ID:', error);
      throw error;
    }
  }

  /**
   * Delete old mappings (cleanup)
   */
  async deleteOldMappings(olderThanDays: number = 7): Promise<number> {
    if (!isTauri()) {
      return 0;
    }

    try {
      const result = await invoke<{ changes: number }>('execute_sql', {
        query: `
          DELETE FROM order_mappings
          WHERE created_at < datetime('now', '-' || ? || ' days')
        `,
        params: [olderThanDays.toString()],
      });
      console.log('[OrderMappingDb] Deleted old mappings:', result.changes);
      return result.changes || 0;
    } catch (error) {
      console.error('[OrderMappingDb] Failed to delete old mappings:', error);
      return 0;
    }
  }
}

export const orderMappingDb = new OrderMappingDb();
