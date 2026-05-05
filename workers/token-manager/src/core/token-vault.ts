/**
 * Token Vault - Secure encrypted storage for tokens/secrets
 */

export interface StoredToken {
  value: string;
  created: string;
  expires?: string;
  metadata?: Record<string, any>;
}

export class TokenVault {
  private kv: KVNamespace;
  private metadataKV: KVNamespace;
  private encryptionKey: string;

  constructor(env: any) {
    this.kv = env.TOKEN_VAULT;
    this.metadataKV = env.TOKEN_METADATA;
    this.encryptionKey = env.MASTER_ENCRYPTION_KEY;
  }

  /**
   * Store a token (encrypted)
   */
  async storeToken(
    key: string,
    value: string,
    expires?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const encrypted = await this.encrypt(value);

    const token: StoredToken = {
      value: encrypted,
      created: new Date().toISOString(),
      expires,
      metadata,
    };

    // Store encrypted token
    const kvKey = `token:${key}`;
    await this.kv.put(kvKey, JSON.stringify(token), {
      expirationTtl: expires ? this.getExpirationTTL(expires) : undefined,
    });

    // Store metadata separately (not encrypted)
    if (metadata) {
      await this.metadataKV.put(`metadata:${key}`, JSON.stringify(metadata));
    }
  }

  /**
   * Get a token (decrypted)
   */
  async getToken(key: string): Promise<StoredToken | null> {
    const kvKey = `token:${key}`;
    const stored = await this.kv.get(kvKey, 'text');

    if (!stored) {
      return null;
    }

    const token: StoredToken = JSON.parse(stored);
    token.value = await this.decrypt(token.value);

    return token;
  }

  /**
   * Get token metadata without decrypting the value
   */
  async getMetadata(key: string): Promise<Record<string, any> | null> {
    const metadata = await this.metadataKV.get(`metadata:${key}`, 'text');
    return metadata ? JSON.parse(metadata) : null;
  }

  /**
   * Delete a token
   */
  async deleteToken(key: string): Promise<void> {
    await this.kv.delete(`token:${key}`);
    await this.metadataKV.delete(`metadata:${key}`);
  }

  /**
   * List all tokens (metadata only, no values)
   */
  async listTokens(): Promise<Array<{ key: string; created: string; expires?: string; metadata?: any }>> {
    const list = await this.kv.list({ prefix: 'token:' });
    const tokens: Array<any> = [];

    for (const item of list.keys) {
      const key = item.name.replace('token:', '');
      const stored = await this.kv.get(item.name, 'text');

      if (stored) {
        const token: StoredToken = JSON.parse(stored);
        tokens.push({
          key,
          created: token.created,
          expires: token.expires,
          metadata: token.metadata,
        });
      }
    }

    return tokens;
  }

  /**
   * Encrypt a value using Web Crypto API
   */
  private async encrypt(plaintext: string): Promise<string> {
    // Convert encryption key from hex to ArrayBuffer
    const keyData = this.hexToArrayBuffer(this.encryptionKey);

    // Import encryption key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return this.arrayBufferToBase64(combined);
  }

  /**
   * Decrypt a value using Web Crypto API
   */
  private async decrypt(ciphertext: string): Promise<string> {
    // Convert encryption key from hex to ArrayBuffer
    const keyData = this.hexToArrayBuffer(this.encryptionKey);

    // Import encryption key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decode base64 and extract IV + ciphertext
    const combined = this.base64ToArrayBuffer(ciphertext);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Calculate expiration TTL in seconds
   */
  private getExpirationTTL(expiresAt: string): number {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    return Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
  }

  /**
   * Convert hex string to ArrayBuffer
   */
  private hexToArrayBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
