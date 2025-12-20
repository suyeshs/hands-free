/**
 * Table Session Service
 * Handles SQLite persistence for table sessions with guest count
 */

import Database from '@tauri-apps/plugin-sql';
import { TableSession, Order } from '../types/pos';

interface TableSessionRow {
  id: string;
  table_number: number;
  guest_count: number;
  server_name: string | null;
  started_at: string;
  closed_at: string | null;
  status: string;
  order_data: string | null;
  tenant_id: string;
}

class TableSessionService {
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
   * Save or update a table session
   */
  async saveSession(tenantId: string, session: TableSession): Promise<void> {
    const db = await this.getDb();
    const sessionId = `session-${tenantId}-${session.tableNumber}`;

    const orderData = JSON.stringify(session.order);

    await db.execute(
      `INSERT INTO table_sessions (id, table_number, guest_count, server_name, started_at, status, order_data, tenant_id)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
       ON CONFLICT(table_number, tenant_id) WHERE status = 'active'
       DO UPDATE SET guest_count = $3, server_name = $4, order_data = $6`,
      [
        sessionId,
        session.tableNumber,
        session.guestCount,
        session.serverName || null,
        session.startedAt,
        orderData,
        tenantId,
      ]
    );
  }

  /**
   * Update guest count for a table session
   */
  async updateGuestCount(tenantId: string, tableNumber: number, guestCount: number): Promise<void> {
    const db = await this.getDb();

    await db.execute(
      `UPDATE table_sessions SET guest_count = $1 WHERE table_number = $2 AND tenant_id = $3 AND status = 'active'`,
      [guestCount, tableNumber, tenantId]
    );
  }

  /**
   * Get all active table sessions for a tenant
   */
  async getActiveSessions(tenantId: string): Promise<Record<number, TableSession>> {
    const db = await this.getDb();

    const rows = await db.select<TableSessionRow[]>(
      `SELECT * FROM table_sessions WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId]
    );

    const sessions: Record<number, TableSession> = {};

    for (const row of rows) {
      let order: Order;
      try {
        order = row.order_data ? JSON.parse(row.order_data) : this.createEmptyOrder(row.table_number);
      } catch {
        order = this.createEmptyOrder(row.table_number);
      }

      sessions[row.table_number] = {
        tableNumber: row.table_number,
        guestCount: row.guest_count,
        serverName: row.server_name || undefined,
        startedAt: row.started_at,
        order,
      };
    }

    return sessions;
  }

  /**
   * Get a single active session for a table
   */
  async getSession(tenantId: string, tableNumber: number): Promise<TableSession | null> {
    const db = await this.getDb();

    const rows = await db.select<TableSessionRow[]>(
      `SELECT * FROM table_sessions WHERE tenant_id = $1 AND table_number = $2 AND status = 'active'`,
      [tenantId, tableNumber]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    let order: Order;
    try {
      order = row.order_data ? JSON.parse(row.order_data) : this.createEmptyOrder(tableNumber);
    } catch {
      order = this.createEmptyOrder(tableNumber);
    }

    return {
      tableNumber: row.table_number,
      guestCount: row.guest_count,
      serverName: row.server_name || undefined,
      startedAt: row.started_at,
      order,
    };
  }

  /**
   * Close a table session (mark as closed)
   */
  async closeSession(tenantId: string, tableNumber: number): Promise<void> {
    const db = await this.getDb();

    await db.execute(
      `UPDATE table_sessions SET status = 'closed', closed_at = $1 WHERE table_number = $2 AND tenant_id = $3 AND status = 'active'`,
      [new Date().toISOString(), tableNumber, tenantId]
    );
  }

  /**
   * Delete old closed sessions (cleanup)
   */
  async cleanupOldSessions(daysOld: number = 7): Promise<void> {
    const db = await this.getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await db.execute(
      `DELETE FROM table_sessions WHERE status = 'closed' AND closed_at < $1`,
      [cutoffDate.toISOString()]
    );
  }

  private createEmptyOrder(tableNumber: number): Order {
    return {
      orderType: 'dine-in',
      tableNumber,
      items: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
  }
}

export const tableSessionService = new TableSessionService();
