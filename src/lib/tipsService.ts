/**
 * Tips Service
 * Manages tip recording, retrieval, and reporting for service staff
 */

import Database from '@tauri-apps/plugin-sql';
import { orderSyncService } from './orderSyncService';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

export interface TipRecord {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  orderNumber?: string;
  tableNumber?: number;
  orderType: 'dine-in' | 'takeout' | 'delivery';
  tipAmount: number;
  staffId?: string;
  serverName?: string;
  enteredByStaffId?: string;
  enteredByName?: string;
  entryMethod: 'manual' | 'auto';
  createdAt: string;
  tipDate: string;
  syncedAt?: string;
}

interface TipRecordRow {
  id: string;
  tenant_id: string;
  invoice_number: string;
  order_number: string | null;
  table_number: number | null;
  order_type: string;
  tip_amount: number;
  staff_id: string | null;
  server_name: string | null;
  entered_by_staff_id: string | null;
  entered_by_name: string | null;
  entry_method: string;
  created_at: string;
  tip_date: string;
  synced_at: string | null;
}

export interface TipsSummary {
  totalTips: number;
  tipCount: number;
  averageTip: number;
  byStaff: Array<{
    staffId?: string;
    serverName: string;
    tips: number;
    count: number;
    average: number;
  }>;
}

class TipsService {
  private db: Database | null = null;
  private dbPromise: Promise<Database> | null = null;

  private async getDb(): Promise<Database> {
    if (this.db) return this.db;

    if (!this.dbPromise) {
      this.dbPromise = Database.load(DB_NAME).then((db) => {
        this.db = db;
        return db;
      });
    }

    return this.dbPromise;
  }

  /**
   * Convert database row to TipRecord object
   */
  private rowToTip(row: TipRecordRow): TipRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      invoiceNumber: row.invoice_number,
      orderNumber: row.order_number || undefined,
      tableNumber: row.table_number || undefined,
      orderType: row.order_type as 'dine-in' | 'takeout' | 'delivery',
      tipAmount: row.tip_amount,
      staffId: row.staff_id || undefined,
      serverName: row.server_name || undefined,
      enteredByStaffId: row.entered_by_staff_id || undefined,
      enteredByName: row.entered_by_name || undefined,
      entryMethod: row.entry_method as 'manual' | 'auto',
      createdAt: row.created_at,
      tipDate: row.tip_date,
      syncedAt: row.synced_at || undefined,
    };
  }

  /**
   * Record a tip for an order
   * Prevents duplicate tips for same invoice
   */
  async recordTip(
    tenantId: string,
    invoiceNumber: string,
    tipAmount: number,
    options: {
      orderNumber?: string;
      tableNumber?: number;
      orderType: 'dine-in' | 'takeout' | 'delivery';
      staffId?: string;
      serverName?: string;
      enteredByStaffId?: string;
      enteredByName?: string;
      entryMethod?: 'manual' | 'auto';
    }
  ): Promise<TipRecord> {
    const db = await this.getDb();
    const now = new Date();
    const id = `tip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tipDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

    const tip: TipRecord = {
      id,
      tenantId,
      invoiceNumber,
      orderNumber: options.orderNumber,
      tableNumber: options.tableNumber,
      orderType: options.orderType,
      tipAmount,
      staffId: options.staffId,
      serverName: options.serverName,
      enteredByStaffId: options.enteredByStaffId,
      enteredByName: options.enteredByName,
      entryMethod: options.entryMethod || 'manual',
      createdAt: now.toISOString(),
      tipDate,
    };

    try {
      await db.execute(
        `INSERT INTO tips (
          id, tenant_id, invoice_number, order_number, table_number, order_type,
          tip_amount, staff_id, server_name, entered_by_staff_id, entered_by_name,
          entry_method, created_at, tip_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          tip.id,
          tip.tenantId,
          tip.invoiceNumber,
          tip.orderNumber || null,
          tip.tableNumber || null,
          tip.orderType,
          tip.tipAmount,
          tip.staffId || null,
          tip.serverName || null,
          tip.enteredByStaffId || null,
          tip.enteredByName || null,
          tip.entryMethod,
          tip.createdAt,
          tip.tipDate,
        ]
      );

      console.log(`[TipsService] Recorded tip: ${tip.invoiceNumber} - ₹${tip.tipAmount} for ${tip.serverName || 'unassigned'}`);

      // Broadcast to cloud for immediate persistence (best-effort)
      try {
        await orderSyncService.broadcastTipRecorded({
          id: tip.id,
          tenantId: tip.tenantId,
          invoiceNumber: tip.invoiceNumber,
          orderNumber: tip.orderNumber,
          tableNumber: tip.tableNumber,
          orderType: tip.orderType,
          tipAmount: tip.tipAmount,
          staffId: tip.staffId,
          serverName: tip.serverName,
          enteredByStaffId: tip.enteredByStaffId,
          enteredByName: tip.enteredByName,
          entryMethod: tip.entryMethod,
          createdAt: tip.createdAt,
          tipDate: tip.tipDate,
        });
      } catch (syncError) {
        console.warn('[TipsService] Cloud sync failed, will retry in batch:', syncError);
        // Don't fail the operation - batch sync will catch it
      }

      return tip;
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        console.warn('[TipsService] Duplicate tip prevented for invoice:', invoiceNumber);
        // Return existing tip instead
        const existing = await this.getTipByInvoice(invoiceNumber);
        if (existing) return existing;
      }
      throw error;
    }
  }

  /**
   * Check if tip already exists for invoice
   */
  async tipExistsForInvoice(invoiceNumber: string): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM tips WHERE invoice_number = $1`,
      [invoiceNumber]
    );
    return (result[0]?.count ?? 0) > 0;
  }

  /**
   * Get tip record by invoice number
   */
  async getTipByInvoice(invoiceNumber: string): Promise<TipRecord | null> {
    const db = await this.getDb();
    const result = await db.select<TipRecordRow[]>(
      `SELECT * FROM tips WHERE invoice_number = $1 LIMIT 1`,
      [invoiceNumber]
    );

    if (result.length === 0) return null;
    return this.rowToTip(result[0]);
  }

  /**
   * Get daily tips summary with staff breakdown
   */
  async getDailyTipsSummary(tenantId: string, date: string): Promise<TipsSummary> {
    const db = await this.getDb();

    // Get overall summary
    const summaryResult = await db.select<{ total: number; count: number }[]>(
      `SELECT
        COALESCE(SUM(tip_amount), 0) as total,
        COUNT(*) as count
       FROM tips
       WHERE tenant_id = $1 AND tip_date = $2`,
      [tenantId, date]
    );

    const totalTips = summaryResult[0]?.total ?? 0;
    const tipCount = summaryResult[0]?.count ?? 0;
    const averageTip = tipCount > 0 ? totalTips / tipCount : 0;

    // Get breakdown by staff
    const staffResult = await db.select<{
      staff_id: string | null;
      server_name: string | null;
      total: number;
      count: number;
    }[]>(
      `SELECT
        staff_id,
        server_name,
        SUM(tip_amount) as total,
        COUNT(*) as count
       FROM tips
       WHERE tenant_id = $1 AND tip_date = $2
       GROUP BY COALESCE(staff_id, server_name, 'unassigned')
       ORDER BY total DESC`,
      [tenantId, date]
    );

    const byStaff = staffResult.map((row) => ({
      staffId: row.staff_id || undefined,
      serverName: row.server_name || 'Unassigned',
      tips: row.total,
      count: row.count,
      average: row.count > 0 ? row.total / row.count : 0,
    }));

    return {
      totalTips,
      tipCount,
      averageTip,
      byStaff,
    };
  }

  /**
   * Get tips by staff for date range
   */
  async getTipsByStaff(
    tenantId: string,
    startDate: string,
    endDate: string,
    staffId?: string
  ): Promise<TipRecord[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM tips WHERE tenant_id = $1 AND tip_date >= $2 AND tip_date <= $3`;
    const params: any[] = [tenantId, startDate, endDate];

    if (staffId) {
      query += ` AND (staff_id = $4 OR server_name = (SELECT name FROM staff_users WHERE id = $4))`;
      params.push(staffId);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.select<TipRecordRow[]>(query, params);
    return result.map((row) => this.rowToTip(row));
  }

  /**
   * Get all tips for a date (for reporting)
   */
  async getTipsForDate(tenantId: string, date: string): Promise<TipRecord[]> {
    const db = await this.getDb();
    const result = await db.select<TipRecordRow[]>(
      `SELECT * FROM tips WHERE tenant_id = $1 AND tip_date = $2 ORDER BY created_at DESC`,
      [tenantId, date]
    );
    return result.map((row) => this.rowToTip(row));
  }

  /**
   * Update tip amount (manager only - validation done in UI)
   */
  async updateTip(
    tipId: string,
    tipAmount: number,
    updatedByStaffId: string
  ): Promise<boolean> {
    const db = await this.getDb();

    try {
      await db.execute(
        `UPDATE tips SET tip_amount = $1 WHERE id = $2`,
        [tipAmount, tipId]
      );

      console.log(`[TipsService] Updated tip ${tipId} to ₹${tipAmount} by ${updatedByStaffId}`);
      return true;
    } catch (error) {
      console.error('[TipsService] Failed to update tip:', error);
      return false;
    }
  }

  /**
   * Delete tip record (manager only - validation done in UI)
   */
  async deleteTip(tipId: string, deletedByStaffId: string): Promise<boolean> {
    const db = await this.getDb();

    try {
      await db.execute(`DELETE FROM tips WHERE id = $1`, [tipId]);
      console.log(`[TipsService] Deleted tip ${tipId} by ${deletedByStaffId}`);
      return true;
    } catch (error) {
      console.error('[TipsService] Failed to delete tip:', error);
      return false;
    }
  }

  /**
   * Get unsynced tips for cloud sync
   */
  async getUnsyncedTips(tenantId: string): Promise<TipRecord[]> {
    const db = await this.getDb();
    const result = await db.select<TipRecordRow[]>(
      `SELECT * FROM tips WHERE tenant_id = $1 AND synced_at IS NULL ORDER BY created_at ASC`,
      [tenantId]
    );
    return result.map((row) => this.rowToTip(row));
  }

  /**
   * Mark tips as synced to cloud
   */
  async markTipsSynced(tipIds: string[]): Promise<void> {
    if (tipIds.length === 0) return;

    const db = await this.getDb();
    const now = new Date().toISOString();
    const placeholders = tipIds.map((_, i) => `$${i + 1}`).join(',');

    await db.execute(
      `UPDATE tips SET synced_at = '${now}' WHERE id IN (${placeholders})`,
      tipIds
    );

    console.log(`[TipsService] Marked ${tipIds.length} tips as synced`);
  }
}

export const tipsService = new TipsService();
