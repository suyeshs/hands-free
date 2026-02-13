/**
 * Audit Logger - Logs all token access and changes
 */

export interface AuditLog {
  id: string;
  timestamp: string;
  event: string;
  workerName: string;
  tokenKey?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private db: D1Database;

  constructor(env: any) {
    this.db = env.AUDIT_DB;
  }

  /**
   * Log token access
   */
  async logTokenAccess(workerName: string, tokenKey: string, request: Request): Promise<void> {
    await this.log({
      event: 'token_accessed',
      workerName,
      tokenKey,
      ip: request.headers.get('CF-Connecting-IP') || undefined,
    });
  }

  /**
   * Log unauthorized access attempt
   */
  async logUnauthorizedAccess(workerName: string, tokenKey: string, request: Request): Promise<void> {
    await this.log({
      event: 'unauthorized_access',
      workerName,
      tokenKey,
      ip: request.headers.get('CF-Connecting-IP') || undefined,
    });
  }

  /**
   * Log token creation
   */
  async logTokenCreation(user: string, tokenKey: string, metadata?: Record<string, any>): Promise<void> {
    await this.log({
      event: 'token_created',
      workerName: user,
      tokenKey,
      metadata,
    });
  }

  /**
   * Log token update
   */
  async logTokenUpdate(user: string, tokenKey: string): Promise<void> {
    await this.log({
      event: 'token_updated',
      workerName: user,
      tokenKey,
    });
  }

  /**
   * Log token deletion
   */
  async logTokenDeletion(user: string, tokenKey: string): Promise<void> {
    await this.log({
      event: 'token_deleted',
      workerName: user,
      tokenKey,
    });
  }

  /**
   * Log token rotation
   */
  async logTokenRotation(user: string, tokenKey: string, service: string): Promise<void> {
    await this.log({
      event: 'token_rotated',
      workerName: user,
      tokenKey,
      metadata: { service },
    });
  }

  /**
   * Get audit logs
   */
  async getLogs(options: {
    limit?: number;
    offset?: number;
    workerName?: string;
    tokenKey?: string;
  }): Promise<AuditLog[]> {
    const { limit = 100, offset = 0, workerName, tokenKey } = options;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (workerName) {
      query += ' AND worker_name = ?';
      params.push(workerName);
    }

    if (tokenKey) {
      query += ' AND token_key = ?';
      params.push(tokenKey);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await this.db.prepare(query).bind(...params).all();
    return result.results as AuditLog[];
  }

  /**
   * Generate weekly report
   */
  async generateWeeklyReport(): Promise<void> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const result = await this.db
      .prepare(
        `SELECT
          event,
          COUNT(*) as count
        FROM audit_logs
        WHERE timestamp >= ?
        GROUP BY event`
      )
      .bind(oneWeekAgo.toISOString())
      .all();

    console.log('Weekly Audit Report:', result.results);
  }

  /**
   * Internal log method
   */
  private async log(entry: {
    event: string;
    workerName: string;
    tokenKey?: string;
    ip?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO audit_logs
        (id, timestamp, event, worker_name, token_key, ip, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        timestamp,
        entry.event,
        entry.workerName,
        entry.tokenKey || null,
        entry.ip || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null
      )
      .run();
  }
}
