/**
 * Tenant Secrets Management
 *
 * Manages encrypted storage of tenant integration secrets (Stripe, PayPal, etc.)
 * Encryption keys are stored in Token Manager, encrypted values in tenant D1 database.
 */

import { fetchToken } from './token-manager';

export type SecretType =
  // Payment Gateways
  | 'stripe'
  | 'paypal'
  | 'razorpay'
  // Delivery Services
  | 'porter'
  | 'shadowfax'
  | 'shipstation'
  // Accounting
  | 'quickbooks'
  | 'xero'
  | 'zoho'
  // Social Media
  | 'facebook'
  | 'instagram'
  | 'google_business'
  // Communication
  | 'whatsapp'
  | 'twilio'
  | 'sendgrid'
  | 'mailchimp'
  | 'smtp'
  // Generic
  | 'custom';

export type SecretEnvironment = 'test' | 'production';

export interface TenantSecret {
  id: string;
  tenantId: string;
  secretType: SecretType;
  secretKey: string;
  environment: SecretEnvironment;
  encryptedValue: string;
  encryptionVersion: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface StoreSecretOptions {
  tenantId: string;
  secretType: SecretType;
  secretKey: string;
  value: string;
  environment: SecretEnvironment;
  metadata?: Record<string, any>;
}

export interface GetSecretOptions {
  tenantId: string;
  secretType: SecretType;
  secretKey: string;
  environment: SecretEnvironment;
}

/**
 * Tenant Secrets Manager
 * Handles encryption/decryption and storage of tenant integration secrets
 */
export class TenantSecretsManager {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Store a tenant secret (encrypted)
   * Fetches encryption key from Token Manager, encrypts value, stores in tenant DB
   */
  async storeSecret(options: StoreSecretOptions): Promise<void> {
    const { tenantId, secretType, secretKey, value, environment, metadata } = options;

    // Get tenant encryption key from Token Manager
    const encryptionKey = await this.getTenantEncryptionKey(tenantId);

    // Encrypt the value
    const encryptedValue = await this.encrypt(value, encryptionKey);

    // Store in database
    await this.db
      .prepare(`
        INSERT INTO tenant_secrets (
          tenant_id, secret_type, secret_key, environment,
          encrypted_value, encryption_version, metadata, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(tenant_id, secret_type, secret_key, environment)
        DO UPDATE SET
          encrypted_value = excluded.encrypted_value,
          encryption_version = excluded.encryption_version,
          metadata = excluded.metadata,
          updated_at = datetime('now')
      `)
      .bind(
        tenantId,
        secretType,
        secretKey,
        environment,
        encryptedValue,
        1, // encryption_version
        metadata ? JSON.stringify(metadata) : null
      )
      .run();

    console.log(`[TenantSecrets] Stored ${secretType}:${secretKey} for tenant ${tenantId} (${environment})`);
  }

  /**
   * Get a tenant secret (decrypted)
   * Fetches from tenant DB, decrypts with key from Token Manager
   */
  async getSecret(options: GetSecretOptions): Promise<string> {
    const { tenantId, secretType, secretKey, environment } = options;

    // Fetch encrypted value from database
    const result = await this.db
      .prepare(`
        SELECT encrypted_value, encryption_version
        FROM tenant_secrets
        WHERE tenant_id = ? AND secret_type = ? AND secret_key = ? AND environment = ?
      `)
      .bind(tenantId, secretType, secretKey, environment)
      .first<{ encrypted_value: string; encryption_version: number }>();

    if (!result) {
      throw new Error(`Secret not found: ${secretType}:${secretKey} (${environment})`);
    }

    // Get decryption key from Token Manager
    const encryptionKey = await this.getTenantEncryptionKey(tenantId);

    // Decrypt the value
    const decryptedValue = await this.decrypt(result.encrypted_value, encryptionKey);

    // Update last_used_at
    await this.db
      .prepare(`
        UPDATE tenant_secrets
        SET last_used_at = datetime('now')
        WHERE tenant_id = ? AND secret_type = ? AND secret_key = ? AND environment = ?
      `)
      .bind(tenantId, secretType, secretKey, environment)
      .run();

    return decryptedValue;
  }

  /**
   * List all secrets for a tenant (returns metadata, not values)
   */
  async listSecrets(tenantId: string, secretType?: SecretType): Promise<TenantSecret[]> {
    const query = secretType
      ? this.db.prepare(`
          SELECT id, tenant_id, secret_type, secret_key, environment,
                 encryption_version, metadata, created_at, updated_at, last_used_at
          FROM tenant_secrets
          WHERE tenant_id = ? AND secret_type = ?
          ORDER BY secret_type, secret_key, environment
        `).bind(tenantId, secretType)
      : this.db.prepare(`
          SELECT id, tenant_id, secret_type, secret_key, environment,
                 encryption_version, metadata, created_at, updated_at, last_used_at
          FROM tenant_secrets
          WHERE tenant_id = ?
          ORDER BY secret_type, secret_key, environment
        `).bind(tenantId);

    const result = await query.all<any>();

    return result.results.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      secretType: row.secret_type,
      secretKey: row.secret_key,
      environment: row.environment,
      encryptedValue: '***', // Never return encrypted value in list
      encryptionVersion: row.encryption_version,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  /**
   * Delete a tenant secret
   */
  async deleteSecret(options: GetSecretOptions): Promise<void> {
    const { tenantId, secretType, secretKey, environment } = options;

    await this.db
      .prepare(`
        DELETE FROM tenant_secrets
        WHERE tenant_id = ? AND secret_type = ? AND secret_key = ? AND environment = ?
      `)
      .bind(tenantId, secretType, secretKey, environment)
      .run();

    console.log(`[TenantSecrets] Deleted ${secretType}:${secretKey} for tenant ${tenantId} (${environment})`);
  }

  /**
   * Delete all secrets for a tenant
   */
  async deleteAllSecrets(tenantId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM tenant_secrets WHERE tenant_id = ?`)
      .bind(tenantId)
      .run();

    console.log(`[TenantSecrets] Deleted all secrets for tenant ${tenantId}`);
  }

  /**
   * Get tenant encryption key from Token Manager
   */
  private async getTenantEncryptionKey(tenantId: string): Promise<string> {
    try {
      return await fetchToken(`tenant:${tenantId}:encryption_key`);
    } catch (error) {
      throw new Error(`Failed to get encryption key for tenant ${tenantId}: ${error}`);
    }
  }

  /**
   * Encrypt a value using AES-256-GCM
   * Uses Web Crypto API available in Cloudflare Workers
   */
  private async encrypt(plaintext: string, keyString: string): Promise<string> {
    // Convert key string to CryptoKey
    const keyData = this.base64ToArrayBuffer(keyString);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return as base64
    return this.arrayBufferToBase64(combined);
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
  private async decrypt(ciphertext: string, keyString: string): Promise<string> {
    // Convert key string to CryptoKey
    const keyData = this.base64ToArrayBuffer(keyString);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decode base64
    const combined = this.base64ToArrayBuffer(ciphertext);

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Helper: Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Helper: ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

/**
 * Helper: Generate a new tenant encryption key
 * Should be called during tenant provisioning
 */
export async function generateTenantEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(exported);

  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}
