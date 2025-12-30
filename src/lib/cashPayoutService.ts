/**
 * Cash Payout Service
 * Manages cash withdrawals, expenses, and payouts that affect DSR
 */

import Database from '@tauri-apps/plugin-sql';

export type PayoutType = 'withdrawal' | 'expense' | 'petty_cash' | 'bank_deposit' | 'vendor_payment';
export type PayoutCategory = 'utilities' | 'supplies' | 'salary' | 'maintenance' | 'misc' | 'change_fund';
export type PayoutStatus = 'pending' | 'completed' | 'cancelled';

export interface CashPayout {
  id: string;
  tenantId: string;
  businessDate: string;
  amount: number;
  payoutType: PayoutType;
  category?: PayoutCategory;
  description?: string;
  referenceNumber?: string;
  recordedBy: string;
  authorizedBy?: string;
  status: PayoutStatus;
  createdAt: string;
  updatedAt: string;
}

interface CashPayoutRow {
  id: string;
  tenant_id: string;
  business_date: string;
  amount: number;
  payout_type: string;
  category: string | null;
  description: string | null;
  reference_number: string | null;
  recorded_by: string;
  authorized_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PayoutSummary {
  totalPayouts: number;
  payoutCount: number;
  byType: Record<PayoutType, number>;
  byCategory: Record<string, number>;
}

class CashPayoutService {
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
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Generate unique payout ID
   */
  private generatePayoutId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `payout-${timestamp}-${random}`;
  }

  /**
   * Record a new cash payout
   */
  async recordPayout(
    tenantId: string,
    amount: number,
    payoutType: PayoutType,
    recordedBy: string,
    options?: {
      category?: PayoutCategory;
      description?: string;
      referenceNumber?: string;
      authorizedBy?: string;
      businessDate?: string;
    }
  ): Promise<CashPayout> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const businessDate = options?.businessDate || this.getTodayDate();
    const id = this.generatePayoutId();

    const payout: CashPayout = {
      id,
      tenantId,
      businessDate,
      amount,
      payoutType,
      category: options?.category,
      description: options?.description,
      referenceNumber: options?.referenceNumber,
      recordedBy,
      authorizedBy: options?.authorizedBy,
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    };

    await db.execute(
      `INSERT INTO cash_payouts (
        id, tenant_id, business_date, amount, payout_type, category,
        description, reference_number, recorded_by, authorized_by,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        payout.id,
        payout.tenantId,
        payout.businessDate,
        payout.amount,
        payout.payoutType,
        payout.category || null,
        payout.description || null,
        payout.referenceNumber || null,
        payout.recordedBy,
        payout.authorizedBy || null,
        payout.status,
        payout.createdAt,
        payout.updatedAt,
      ]
    );

    console.log(`[CashPayoutService] Recorded payout: ${payoutType} - ₹${amount} by ${recordedBy}`);
    return payout;
  }

  /**
   * Get all payouts for a specific date
   */
  async getPayoutsByDate(tenantId: string, date: string): Promise<CashPayout[]> {
    const db = await this.getDb();

    const rows = await db.select<CashPayoutRow[]>(
      `SELECT * FROM cash_payouts
       WHERE tenant_id = $1 AND business_date = $2 AND status != 'cancelled'
       ORDER BY created_at DESC`,
      [tenantId, date]
    );

    return rows.map((row) => this.rowToPayout(row));
  }

  /**
   * Get today's payouts
   */
  async getTodaysPayouts(tenantId: string): Promise<CashPayout[]> {
    return this.getPayoutsByDate(tenantId, this.getTodayDate());
  }

  /**
   * Get total payouts for a date (for cash reconciliation)
   */
  async getTotalPayoutsForDate(tenantId: string, date: string): Promise<number> {
    const db = await this.getDb();

    const result = await db.select<{ total: number }[]>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM cash_payouts
       WHERE tenant_id = $1 AND business_date = $2 AND status = 'completed'`,
      [tenantId, date]
    );

    return result[0]?.total || 0;
  }

  /**
   * Get payout summary for a date
   */
  async getPayoutSummary(tenantId: string, date: string): Promise<PayoutSummary> {
    const payouts = await this.getPayoutsByDate(tenantId, date);

    const summary: PayoutSummary = {
      totalPayouts: 0,
      payoutCount: payouts.length,
      byType: {
        withdrawal: 0,
        expense: 0,
        petty_cash: 0,
        bank_deposit: 0,
        vendor_payment: 0,
      },
      byCategory: {},
    };

    for (const payout of payouts) {
      if (payout.status === 'completed') {
        summary.totalPayouts += payout.amount;
        summary.byType[payout.payoutType] += payout.amount;

        if (payout.category) {
          summary.byCategory[payout.category] = (summary.byCategory[payout.category] || 0) + payout.amount;
        }
      }
    }

    return summary;
  }

  /**
   * Cancel a payout
   */
  async cancelPayout(payoutId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.execute(
      `UPDATE cash_payouts SET status = 'cancelled', updated_at = $1 WHERE id = $2`,
      [now, payoutId]
    );

    console.log(`[CashPayoutService] Cancelled payout: ${payoutId}`);
  }

  /**
   * Get a specific payout by ID
   */
  async getPayout(payoutId: string): Promise<CashPayout | null> {
    const db = await this.getDb();

    const rows = await db.select<CashPayoutRow[]>(
      `SELECT * FROM cash_payouts WHERE id = $1`,
      [payoutId]
    );

    if (rows.length === 0) return null;
    return this.rowToPayout(rows[0]);
  }

  /**
   * Get recent payouts for history
   */
  async getRecentPayouts(tenantId: string, limit: number = 50): Promise<CashPayout[]> {
    const db = await this.getDb();

    const rows = await db.select<CashPayoutRow[]>(
      `SELECT * FROM cash_payouts
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return rows.map((row) => this.rowToPayout(row));
  }

  private rowToPayout(row: CashPayoutRow): CashPayout {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      businessDate: row.business_date,
      amount: row.amount,
      payoutType: row.payout_type as PayoutType,
      category: row.category as PayoutCategory | undefined,
      description: row.description || undefined,
      referenceNumber: row.reference_number || undefined,
      recordedBy: row.recorded_by,
      authorizedBy: row.authorized_by || undefined,
      status: row.status as PayoutStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const cashPayoutService = new CashPayoutService();
