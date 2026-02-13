/**
 * Universal Consent Management Library - Core Manager
 *
 * @module consent/ConsentManager
 */

import Database from '@tauri-apps/plugin-sql';
import { v4 as uuidv4 } from 'uuid';
import type {
  ConsentRecord,
  ConsentConfig,
  ConsentRequest,
  ConsentResponse,
  ConsentStatus,
  ConsentPurpose,
  ConsentMethod,
  PrivacyRegulation,
  ConsentChangeEvent,
  ConsentAuditLog,
  ConsentComplianceReport,
  DataSubjectRequest,
  ConsentManagerConfig,
} from './types';

/**
 * ConsentManager - Core consent management class
 *
 * Thread-safe, regulation-compliant consent management
 */
export class ConsentManager {
  private db: Database | null = null;
  private config: ConsentManagerConfig;
  private changeListeners: ((event: ConsentChangeEvent) => void)[] = [];

  constructor(config: ConsentManagerConfig) {
    this.config = config;
  }

  /**
   * Initialize the consent manager
   */
  async initialize(dbPath: string = 'sqlite:consent.db'): Promise<void> {
    this.db = await Database.load(dbPath);

    // Run schema initialization
    const schema = await this.loadSchema();
    await this.db.execute(schema);

    // Start background tasks
    this.startExpirationChecker();
  }

  /**
   * Load database schema
   */
  private async loadSchema(): Promise<string> {
    // In production, load from file
    // For now, return schema as string (imported from schema.sql)
    return '';  // Would be replaced with actual schema
  }

  /**
   * Check if user has granted consent for a specific purpose
   */
  async hasConsent(
    userId: string | null,
    deviceId: string,
    purpose: ConsentPurpose,
    regulation?: PrivacyRegulation
  ): Promise<boolean> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const reg = regulation || this.config.default_regulation;

    const result = await this.db.select<ConsentRecord[]>(`
      SELECT * FROM consent_records
      WHERE (user_id = $1 OR device_id = $2)
        AND purpose = $3
        AND regulation = $4
        AND status = 'granted'
        AND deleted_at IS NULL
        AND withdrawn_at IS NULL
        AND (expires_at IS NULL OR expires_at > $5)
      ORDER BY granted_at DESC
      LIMIT 1
    `, [userId, deviceId, purpose, reg, Date.now()]);

    return result.length > 0;
  }

  /**
   * Get all active consents for a user/device
   */
  async getActiveConsents(
    userId: string | null,
    deviceId: string
  ): Promise<Map<ConsentPurpose, ConsentRecord>> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const records = await this.db.select<ConsentRecord[]>(`
      SELECT * FROM consent_records
      WHERE (user_id = $1 OR device_id = $2)
        AND status = 'granted'
        AND deleted_at IS NULL
        AND withdrawn_at IS NULL
        AND (expires_at IS NULL OR expires_at > $3)
      ORDER BY granted_at DESC
    `, [userId, deviceId, Date.now()]);

    // Group by purpose, keeping only the most recent
    const consentMap = new Map<ConsentPurpose, ConsentRecord>();
    for (const record of records) {
      const existing = consentMap.get(record.purpose as ConsentPurpose);
      if (!existing || record.granted_at > existing.granted_at) {
        consentMap.set(record.purpose as ConsentPurpose, record);
      }
    }

    return consentMap;
  }

  /**
   * Request consent from user
   * Returns a request ID that can be used to track the response
   */
  async requestConsent(request: ConsentRequest): Promise<string> {
    const requestId = uuidv4();

    // Store request metadata (for audit trail)
    // UI components will display this request and call recordConsentResponse()

    return requestId;
  }

  /**
   * Record user's consent response
   */
  async recordConsentResponse(response: ConsentResponse): Promise<void> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const records: ConsentRecord[] = [];
    const now = Date.now();

    // Create consent records for each purpose
    for (const [purpose, granted] of response.consents.entries()) {
      const config = await this.getConsentConfig(purpose);
      if (!config) {
        console.warn(`No configuration found for purpose: ${purpose}`);
        continue;
      }

      // Calculate expiration
      let expiresAt: number | undefined;
      if (config.expires_after_days) {
        expiresAt = now + (config.expires_after_days * 24 * 60 * 60 * 1000);
      }

      const record: ConsentRecord = {
        id: uuidv4(),
        device_id: response.request_id, // Temporary - should be actual device_id
        purpose,
        status: granted ? 'granted' : 'denied',
        regulation: this.config.default_regulation,
        granted_at: response.timestamp,
        expires_at: expiresAt,
        last_updated_at: now,
        method: response.method,
        consent_text: config.description, // Would be actual text shown
        consent_version: '1.0', // Should come from config
        language: this.config.default_language,
        ip_address: response.ip_address,
        user_agent: response.user_agent,
        geo_location: response.geo_location,
      };

      records.push(record);

      // Insert into database
      await this.insertConsentRecord(record);

      // Fire change event
      this.emitChange({
        device_id: record.device_id,
        user_id: record.user_id,
        purpose,
        old_status: 'pending',
        new_status: record.status,
        timestamp: now,
      });
    }

    // Call callback if configured
    if (this.config.on_consent_change) {
      for (const record of records) {
        await this.config.on_consent_change({
          device_id: record.device_id,
          user_id: record.user_id,
          purpose: record.purpose,
          old_status: 'pending',
          new_status: record.status,
          timestamp: now,
        });
      }
    }
  }

  /**
   * Withdraw consent (GDPR Article 7(3), DPDP Section 6)
   */
  async withdrawConsent(
    userId: string | null,
    deviceId: string,
    purpose: ConsentPurpose,
    reason?: string
  ): Promise<void> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const now = Date.now();

    // Find active consent
    const existing = await this.db.select<ConsentRecord[]>(`
      SELECT * FROM consent_records
      WHERE (user_id = $1 OR device_id = $2)
        AND purpose = $3
        AND status = 'granted'
        AND deleted_at IS NULL
        AND withdrawn_at IS NULL
      ORDER BY granted_at DESC
      LIMIT 1
    `, [userId, deviceId, purpose]);

    if (existing.length === 0) {
      throw new Error('No active consent found to withdraw');
    }

    const record = existing[0];

    // Update status
    await this.db.execute(`
      UPDATE consent_records
      SET status = 'withdrawn',
          withdrawn_at = $1,
          last_updated_at = $1
      WHERE id = $2
    `, [now, record.id]);

    // Create audit log entry
    await this.createAuditLog({
      id: uuidv4(),
      consent_id: record.id,
      action: 'withdrawn',
      timestamp: now,
      actor_id: userId || undefined,
      actor_type: 'user',
      reason,
    });

    // Fire change event
    this.emitChange({
      device_id: deviceId,
      user_id: userId || undefined,
      purpose,
      old_status: 'granted',
      new_status: 'withdrawn',
      timestamp: now,
      reason,
    });

    // Call callback
    if (this.config.on_withdrawal) {
      await this.config.on_withdrawal({
        ...record,
        status: 'withdrawn',
        withdrawn_at: now,
      });
    }
  }

  /**
   * Renew expired or expiring consent
   */
  async renewConsent(
    userId: string | null,
    deviceId: string,
    purpose: ConsentPurpose,
    method: ConsentMethod,
    context?: {
      ip_address?: string;
      user_agent?: string;
      geo_location?: ConsentRecord['geo_location'];
    }
  ): Promise<void> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const config = await this.getConsentConfig(purpose);
    if (!config) throw new Error(`Unknown consent purpose: ${purpose}`);

    const now = Date.now();
    let expiresAt: number | undefined;
    if (config.expires_after_days) {
      expiresAt = now + (config.expires_after_days * 24 * 60 * 60 * 1000);
    }

    // Create new consent record (renewal)
    const record: ConsentRecord = {
      id: uuidv4(),
      user_id: userId || undefined,
      device_id: deviceId,
      purpose,
      status: 'granted',
      regulation: this.config.default_regulation,
      granted_at: now,
      expires_at: expiresAt,
      last_updated_at: now,
      method,
      consent_text: config.description,
      consent_version: '1.0',
      language: this.config.default_language,
      ip_address: context?.ip_address,
      user_agent: context?.user_agent,
      geo_location: context?.geo_location,
    };

    await this.insertConsentRecord(record);

    // Create audit log
    await this.createAuditLog({
      id: uuidv4(),
      consent_id: record.id,
      action: 'renewed',
      timestamp: now,
      actor_id: userId || undefined,
      actor_type: 'user',
    });

    this.emitChange({
      device_id: deviceId,
      user_id: userId || undefined,
      purpose,
      old_status: 'expired',
      new_status: 'granted',
      timestamp: now,
      reason: 'Consent renewed',
    });
  }

  /**
   * Get expiring consents (for renewal reminders)
   */
  async getExpiringConsents(daysAhead: number = 30): Promise<ConsentRecord[]> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const now = Date.now();
    const futureDate = now + (daysAhead * 24 * 60 * 60 * 1000);

    return await this.db.select<ConsentRecord[]>(`
      SELECT * FROM expiring_soon_consents
      WHERE expires_at <= $1
      ORDER BY expires_at ASC
    `, [futureDate]);
  }

  /**
   * Export all data for a user (GDPR Article 15, DPDP Section 11)
   */
  async exportUserData(userId: string): Promise<{
    consents: ConsentRecord[];
    audit_logs: ConsentAuditLog[];
    requests: DataSubjectRequest[];
  }> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const consents = await this.db.select<ConsentRecord[]>(`
      SELECT * FROM consent_records
      WHERE user_id = $1
      ORDER BY granted_at DESC
    `, [userId]);

    const consentIds = consents.map(c => c.id);
    const audit_logs = consentIds.length > 0
      ? await this.db.select<ConsentAuditLog[]>(`
          SELECT * FROM consent_audit_log
          WHERE consent_id IN (${consentIds.map(() => '?').join(',')})
          ORDER BY timestamp DESC
        `, consentIds)
      : [];

    const requests = await this.db.select<DataSubjectRequest[]>(`
      SELECT * FROM data_subject_requests
      WHERE user_id = $1
      ORDER BY requested_at DESC
    `, [userId]);

    return { consents, audit_logs, requests };
  }

  /**
   * Erase user data (GDPR Article 17, DPDP Section 12)
   * Soft delete - keeps records for legal compliance
   */
  async eraseUserData(userId: string, reason: string): Promise<void> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const now = Date.now();

    // Soft delete consent records
    await this.db.execute(`
      UPDATE consent_records
      SET deleted_at = $1,
          user_id = NULL,
          ip_address = NULL,
          user_agent = NULL,
          geo_country = NULL,
          geo_region = NULL,
          geo_city = NULL,
          evidence_json = NULL,
          metadata_json = NULL
      WHERE user_id = $2 AND deleted_at IS NULL
    `, [now, userId]);

    // Create audit log
    await this.createAuditLog({
      id: uuidv4(),
      consent_id: 'BULK_ERASURE',
      action: 'erased',
      timestamp: now,
      actor_id: userId,
      actor_type: 'user',
      reason,
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    regulation: PrivacyRegulation,
    startDate: number,
    endDate: number
  ): Promise<ConsentComplianceReport> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    // Get summary statistics
    const summary = await this.db.select<any[]>(`
      SELECT
        purpose,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'granted' THEN 1 ELSE 0 END) as granted,
        SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied,
        SUM(CASE WHEN status = 'withdrawn' THEN 1 ELSE 0 END) as withdrawn
      FROM consent_records
      WHERE regulation = $1
        AND granted_at BETWEEN $2 AND $3
        AND deleted_at IS NULL
      GROUP BY purpose
    `, [regulation, startDate, endDate]);

    const byPurpose = summary.map(row => ({
      purpose: row.purpose as ConsentPurpose,
      granted: row.granted,
      denied: row.denied,
      withdrawn: row.withdrawn,
      rate: row.total > 0 ? (row.granted / row.total) * 100 : 0,
    }));

    // Count unique users
    const userCount = await this.db.select<any[]>(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM consent_records
      WHERE regulation = $1
        AND granted_at BETWEEN $2 AND $3
        AND user_id IS NOT NULL
        AND deleted_at IS NULL
    `, [regulation, startDate, endDate]);

    // Audit trail summary
    const auditSummary = await this.db.select<any[]>(`
      SELECT
        COUNT(*) as total_changes,
        SUM(CASE WHEN actor_type = 'admin' THEN 1 ELSE 0 END) as admin_overrides
      FROM consent_audit_log
      WHERE timestamp BETWEEN $1 AND $2
    `, [startDate, endDate]);

    const totalConsents = summary.reduce((sum, row) => sum + row.total, 0);
    const totalGranted = summary.reduce((sum, row) => sum + row.granted, 0);

    return {
      generated_at: Date.now(),
      regulation,
      period: { start: startDate, end: endDate },
      total_users: userCount[0]?.count || 0,
      total_consents: totalConsents,
      consent_rate: totalConsents > 0 ? (totalGranted / totalConsents) * 100 : 0,
      by_purpose: byPurpose,
      issues: [], // Would be populated by compliance rules engine
      audit_summary: {
        total_changes: auditSummary[0]?.total_changes || 0,
        admin_overrides: auditSummary[0]?.admin_overrides || 0,
        expired_consents: 0, // TODO: Calculate
        renewed_consents: 0, // TODO: Calculate
      },
    };
  }

  /**
   * Create data subject request (GDPR, DPDP)
   */
  async createDataSubjectRequest(
    type: DataSubjectRequest['type'],
    userId: string,
    details?: any
  ): Promise<string> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const id = uuidv4();
    const now = Date.now();
    const dueBy = now + (30 * 24 * 60 * 60 * 1000); // 30 days (GDPR/DPDP requirement)

    await this.db.execute(`
      INSERT INTO data_subject_requests (
        id, type, user_id, requested_at, due_by, status, details_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)
    `, [id, type, userId, now, dueBy, JSON.stringify(details || {}), now, now]);

    return id;
  }

  /**
   * Get consent configuration
   */
  private async getConsentConfig(purpose: ConsentPurpose): Promise<ConsentConfig | null> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    const result = await this.db.select<any[]>(`
      SELECT * FROM consent_configs WHERE purpose = $1
    `, [purpose]);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      purpose: row.purpose,
      required_by: JSON.parse(row.required_by_json),
      essential: row.essential === 1,
      opt_in: row.opt_in === 1,
      expires_after_days: row.expires_after_days,
      requires_renewal: row.requires_renewal === 1,
      title: row.title,
      description: row.description,
      learn_more_url: row.learn_more_url,
      icon: row.icon,
      depends_on: row.depends_on_json ? JSON.parse(row.depends_on_json) : undefined,
      conflicts_with: row.conflicts_with_json ? JSON.parse(row.conflicts_with_json) : undefined,
      age_restriction: row.age_restriction,
      requires_parental_consent: row.requires_parental_consent === 1,
    };
  }

  /**
   * Insert consent record
   */
  private async insertConsentRecord(record: ConsentRecord): Promise<void> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    await this.db.execute(`
      INSERT INTO consent_records (
        id, user_id, device_id, session_id, purpose, status, regulation,
        granted_at, expires_at, withdrawn_at, last_updated_at,
        method, consent_text, consent_version, language,
        ip_address, user_agent, geo_country, geo_region, geo_city,
        evidence_json, parent_consent_id, is_minor, metadata_json, deleted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      )
    `, [
      record.id,
      record.user_id || null,
      record.device_id,
      record.session_id || null,
      record.purpose,
      record.status,
      record.regulation,
      record.granted_at,
      record.expires_at || null,
      record.withdrawn_at || null,
      record.last_updated_at,
      record.method,
      record.consent_text,
      record.consent_version,
      record.language,
      record.ip_address || null,
      record.user_agent || null,
      record.geo_location?.country || null,
      record.geo_location?.region || null,
      record.geo_location?.city || null,
      record.evidence ? JSON.stringify(record.evidence) : null,
      record.parent_consent_id || null,
      record.is_minor ? 1 : 0,
      record.metadata ? JSON.stringify(record.metadata) : null,
      record.deleted_at || null,
    ]);
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(log: ConsentAuditLog): Promise<void> {
    if (!this.db) throw new Error('ConsentManager not initialized');

    await this.db.execute(`
      INSERT INTO consent_audit_log (
        id, consent_id, action, timestamp, actor_id, actor_type,
        ip_address, user_agent, changes_json, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      log.id,
      log.consent_id,
      log.action,
      log.timestamp,
      log.actor_id || null,
      log.actor_type,
      log.ip_address || null,
      log.user_agent || null,
      log.changes ? JSON.stringify(log.changes) : null,
      log.reason || null,
    ]);
  }

  /**
   * Emit consent change event
   */
  private emitChange(event: ConsentChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in consent change listener:', error);
      }
    }
  }

  /**
   * Subscribe to consent changes
   */
  onChange(listener: (event: ConsentChangeEvent) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Background task: Check for expired consents
   */
  private startExpirationChecker(): void {
    setInterval(async () => {
      try {
        await this.checkExpiredConsents();
      } catch (error) {
        console.error('Error checking expired consents:', error);
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  /**
   * Check and mark expired consents
   */
  private async checkExpiredConsents(): Promise<void> {
    if (!this.db) return;

    const now = Date.now();

    // Find expired consents
    const expired = await this.db.select<ConsentRecord[]>(`
      SELECT * FROM consent_records
      WHERE expires_at IS NOT NULL
        AND expires_at <= $1
        AND status = 'granted'
        AND deleted_at IS NULL
    `, [now]);

    // Mark as expired
    for (const record of expired) {
      await this.db.execute(`
        UPDATE consent_records
        SET status = 'expired', last_updated_at = $1
        WHERE id = $2
      `, [now, record.id]);

      // Create audit log
      await this.createAuditLog({
        id: uuidv4(),
        consent_id: record.id,
        action: 'expired',
        timestamp: now,
        actor_type: 'system',
      });

      // Fire event
      this.emitChange({
        device_id: record.device_id,
        user_id: record.user_id,
        purpose: record.purpose,
        old_status: 'granted',
        new_status: 'expired',
        timestamp: now,
        reason: 'Consent expired',
      });

      // Call callback
      if (this.config.on_expiry) {
        await this.config.on_expiry({
          ...record,
          status: 'expired',
        });
      }
    }
  }
}

/**
 * Global singleton instance
 */
let globalConsentManager: ConsentManager | null = null;

/**
 * Get or create global consent manager
 */
export function getConsentManager(config?: ConsentManagerConfig): ConsentManager {
  if (!globalConsentManager) {
    if (!config) {
      throw new Error('ConsentManager not initialized. Call initializeConsentManager() first.');
    }
    globalConsentManager = new ConsentManager(config);
  }
  return globalConsentManager;
}

/**
 * Initialize global consent manager
 */
export async function initializeConsentManager(
  config: ConsentManagerConfig,
  dbPath?: string
): Promise<ConsentManager> {
  const manager = new ConsentManager(config);
  await manager.initialize(dbPath);
  globalConsentManager = manager;
  return manager;
}
