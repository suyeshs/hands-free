/**
 * Cash Register Service
 * Manages daily cash drawer opening/closing and reconciliation
 */

import Database from '@tauri-apps/plugin-sql';

export interface CashRegister {
  id: string;
  tenantId: string;
  businessDate: string;
  openingCash: number;
  openedAt: string;
  openedBy?: string;
  expectedClosingCash?: number;
  actualClosingCash?: number;
  cashVariance?: number;
  closedAt?: string;
  closedBy?: string;
  status: 'open' | 'closed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface CashRegisterRow {
  id: string;
  tenant_id: string;
  business_date: string;
  opening_cash: number;
  opened_at: string;
  opened_by: string | null;
  expected_closing_cash: number | null;
  actual_closing_cash: number | null;
  cash_variance: number | null;
  closed_at: string | null;
  closed_by: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

class CashRegisterService {
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
   * Open a new cash register for today
   */
  async openRegister(
    tenantId: string,
    openingCash: number,
    staffName?: string
  ): Promise<CashRegister> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const businessDate = this.getTodayDate();
    const id = `register-${tenantId}-${businessDate}`;

    const register: CashRegister = {
      id,
      tenantId,
      businessDate,
      openingCash,
      openedAt: now,
      openedBy: staffName,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    await db.execute(
      `INSERT INTO daily_cash_registers (
        id, tenant_id, business_date, opening_cash, opened_at, opened_by,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT(tenant_id, business_date) DO UPDATE SET
        opening_cash = $4,
        opened_at = $5,
        opened_by = $6,
        status = 'open',
        updated_at = $9`,
      [
        register.id,
        register.tenantId,
        register.businessDate,
        register.openingCash,
        register.openedAt,
        register.openedBy || null,
        register.status,
        register.createdAt,
        register.updatedAt,
      ]
    );

    console.log(`[CashRegisterService] Opened register for ${businessDate} with opening cash: ${openingCash}`);
    return register;
  }

  /**
   * Get the currently open register for a tenant
   */
  async getOpenRegister(tenantId: string): Promise<CashRegister | null> {
    const db = await this.getDb();
    const businessDate = this.getTodayDate();

    const rows = await db.select<CashRegisterRow[]>(
      `SELECT * FROM daily_cash_registers
       WHERE tenant_id = $1 AND business_date = $2 AND status = 'open'`,
      [tenantId, businessDate]
    );

    if (rows.length === 0) return null;
    return this.rowToRegister(rows[0]);
  }

  /**
   * Get register by date
   */
  async getRegisterByDate(tenantId: string, date: string): Promise<CashRegister | null> {
    const db = await this.getDb();

    const rows = await db.select<CashRegisterRow[]>(
      `SELECT * FROM daily_cash_registers
       WHERE tenant_id = $1 AND business_date = $2`,
      [tenantId, date]
    );

    if (rows.length === 0) return null;
    return this.rowToRegister(rows[0]);
  }

  /**
   * Close the register for today with actual cash count
   */
  async closeRegister(
    tenantId: string,
    actualClosingCash: number,
    cashSales: number,
    staffName?: string,
    notes?: string
  ): Promise<CashRegister> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const businessDate = this.getTodayDate();

    // Get current register to calculate expected closing
    const currentRegister = await this.getOpenRegister(tenantId);
    if (!currentRegister) {
      throw new Error('No open register found for today');
    }

    const expectedClosingCash = currentRegister.openingCash + cashSales;
    const cashVariance = actualClosingCash - expectedClosingCash;

    await db.execute(
      `UPDATE daily_cash_registers SET
        expected_closing_cash = $1,
        actual_closing_cash = $2,
        cash_variance = $3,
        closed_at = $4,
        closed_by = $5,
        status = 'closed',
        notes = $6,
        updated_at = $7
       WHERE tenant_id = $8 AND business_date = $9`,
      [
        expectedClosingCash,
        actualClosingCash,
        cashVariance,
        now,
        staffName || null,
        notes || null,
        now,
        tenantId,
        businessDate,
      ]
    );

    console.log(`[CashRegisterService] Closed register for ${businessDate}. Expected: ${expectedClosingCash}, Actual: ${actualClosingCash}, Variance: ${cashVariance}`);

    return {
      ...currentRegister,
      expectedClosingCash,
      actualClosingCash,
      cashVariance,
      closedAt: now,
      closedBy: staffName,
      status: 'closed',
      notes,
      updatedAt: now,
    };
  }

  /**
   * Update opening cash for today's register
   */
  async updateOpeningCash(tenantId: string, openingCash: number): Promise<void> {
    const db = await this.getDb();
    const businessDate = this.getTodayDate();
    const now = new Date().toISOString();

    await db.execute(
      `UPDATE daily_cash_registers SET
        opening_cash = $1,
        updated_at = $2
       WHERE tenant_id = $3 AND business_date = $4 AND status = 'open'`,
      [openingCash, now, tenantId, businessDate]
    );
  }

  /**
   * Check if register is open for today
   */
  async isRegisterOpen(tenantId: string): Promise<boolean> {
    const register = await this.getOpenRegister(tenantId);
    return register !== null;
  }

  /**
   * Get recent registers for history
   */
  async getRecentRegisters(tenantId: string, limit: number = 30): Promise<CashRegister[]> {
    const db = await this.getDb();

    const rows = await db.select<CashRegisterRow[]>(
      `SELECT * FROM daily_cash_registers
       WHERE tenant_id = $1
       ORDER BY business_date DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return rows.map((row) => this.rowToRegister(row));
  }

  private rowToRegister(row: CashRegisterRow): CashRegister {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      businessDate: row.business_date,
      openingCash: row.opening_cash,
      openedAt: row.opened_at,
      openedBy: row.opened_by || undefined,
      expectedClosingCash: row.expected_closing_cash ?? undefined,
      actualClosingCash: row.actual_closing_cash ?? undefined,
      cashVariance: row.cash_variance ?? undefined,
      closedAt: row.closed_at || undefined,
      closedBy: row.closed_by || undefined,
      status: row.status as 'open' | 'closed',
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const cashRegisterService = new CashRegisterService();
