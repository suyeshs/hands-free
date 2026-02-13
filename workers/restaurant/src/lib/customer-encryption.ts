/**
 * Customer PII Encryption Library
 *
 * Provides AES-256-GCM encryption/decryption for customer PII fields
 * and HMAC-SHA256 hashing for phone number lookups
 *
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - Per-tenant encryption keys stored in Token Manager
 * - Phone number hashing for non-reversible lookups
 * - Key versioning support for rotation
 */

import { createHmac, randomBytes } from 'crypto';

/**
 * Encryption result containing encrypted data and metadata
 */
export interface EncryptedData {
  encrypted: string; // Base64-encoded encrypted data
  iv: string; // Base64-encoded initialization vector
  authTag: string; // Base64-encoded authentication tag
  version: number; // Encryption key version
}

/**
 * Customer PII fields that require encryption
 */
export interface CustomerPII {
  phone?: string;
  name?: string;
  email?: string;
  notes?: string;
  address_line1?: string;
  address_line2?: string;
}

/**
 * Encrypted customer PII fields (database format)
 */
export interface EncryptedCustomerPII {
  phone_number_encrypted?: string;
  name_encrypted?: string;
  email_encrypted?: string;
  notes_encrypted?: string;
  address_line1_encrypted?: string;
  address_line2_encrypted?: string;
  phone_hash: string;
  encryption_key_version: number;
}

/**
 * Token Manager service binding
 */
interface TokenManagerService {
  fetch: (request: Request) => Promise<Response>;
}

/**
 * Fetch tenant encryption key from Token Manager
 */
export async function getTenantEncryptionKey(
  tenantId: string,
  tokenManager: TokenManagerService
): Promise<{ key: string; version: number }> {
  const keyName = `customer-encryption-key:${tenantId}`;

  try {
    const response = await tokenManager.fetch(
      new Request(`https://token-manager/api/tokens/${encodeURIComponent(keyName)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Worker-Name': 'handsfree-restaurant',
        },
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch encryption key: ${response.status}`);
    }

    const responseData = await response.json() as { success: boolean; data: { value: string; expires?: string }; timestamp: string };

    if (!responseData.success || !responseData.data || !responseData.data.value) {
      throw new Error('Invalid response from Token Manager');
    }

    return {
      key: responseData.data.value,
      version: 1, // Token Manager doesn't return version yet
    };
  } catch (error) {
    throw new Error(`Token Manager error: ${error.message}`);
  }
}

/**
 * Encrypt a single field using AES-256-GCM
 *
 * @param plaintext - The data to encrypt
 * @param encryptionKey - Base64-encoded 256-bit encryption key
 * @param keyVersion - Encryption key version for rotation support
 * @returns Encrypted data with IV and auth tag
 */
export async function encryptField(
  plaintext: string,
  encryptionKey: string,
  keyVersion: number = 1
): Promise<string> {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty plaintext');
  }

  // Decode the base64 encryption key
  const keyBuffer = Buffer.from(encryptionKey, 'base64');

  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be 256 bits (32 bytes)');
  }

  // Generate a random 12-byte IV (96 bits, recommended for GCM)
  const iv = randomBytes(12);

  // Import the key for WebCrypto API
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt the plaintext
  const plaintextBuffer = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128, // 128-bit authentication tag
    },
    cryptoKey,
    plaintextBuffer
  );

  // Extract the ciphertext and auth tag
  // In AES-GCM, the auth tag is appended to the ciphertext
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, encryptedArray.length - 16);
  const authTag = encryptedArray.slice(encryptedArray.length - 16);

  // Create the encrypted data object
  const encryptedData: EncryptedData = {
    encrypted: Buffer.from(ciphertext).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    authTag: Buffer.from(authTag).toString('base64'),
    version: keyVersion,
  };

  // Return as JSON string for storage in TEXT column
  return JSON.stringify(encryptedData);
}

/**
 * Decrypt a single field using AES-256-GCM
 *
 * @param encryptedJson - JSON string containing encrypted data, IV, and auth tag
 * @param encryptionKey - Base64-encoded 256-bit encryption key
 * @returns Decrypted plaintext
 */
export async function decryptField(
  encryptedJson: string,
  encryptionKey: string
): Promise<string> {
  if (!encryptedJson) {
    throw new Error('Cannot decrypt empty data');
  }

  // Handle legacy format: "ENCRYPTED:plaintext" (used in test data)
  if (encryptedJson.startsWith('ENCRYPTED:')) {
    // Return the plaintext directly (strip the prefix)
    return encryptedJson.substring('ENCRYPTED:'.length);
  }

  // Parse the encrypted data JSON
  const encryptedData: EncryptedData = JSON.parse(encryptedJson);

  // Decode the base64 encryption key
  const keyBuffer = Buffer.from(encryptionKey, 'base64');

  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be 256 bits (32 bytes)');
  }

  // Decode the IV and ciphertext
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const ciphertext = Buffer.from(encryptedData.encrypted, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');

  // Combine ciphertext and auth tag (WebCrypto expects them together)
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  // Import the key for WebCrypto API
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt the ciphertext
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      cryptoKey,
      combined
    );

    // Convert the decrypted buffer back to a string
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    throw new Error('Decryption failed: Invalid key or corrupted data');
  }
}

/**
 * Generate HMAC-SHA256 hash of phone number for lookups
 *
 * This creates a non-reversible hash that can be used for:
 * - Unique constraints in the database
 * - Fast lookups without exposing phone numbers in indexes
 *
 * @param phoneNumber - Phone number to hash (e.g., "+919876543210")
 * @param tenantId - Tenant ID (used as salt to prevent rainbow table attacks)
 * @returns Base64-encoded HMAC hash
 */
export function hashPhoneNumber(phoneNumber: string, tenantId: string): string {
  if (!phoneNumber) {
    throw new Error('Cannot hash empty phone number');
  }

  // Normalize phone number (remove spaces, dashes, etc.)
  const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');

  // Use tenant ID as salt to prevent cross-tenant rainbow table attacks
  const hmac = createHmac('sha256', `customer-phone-salt:${tenantId}`);
  hmac.update(normalized);

  return hmac.digest('base64');
}

/**
 * Encrypt all PII fields for a customer
 *
 * @param pii - Customer PII data to encrypt
 * @param tenantId - Tenant ID for phone hashing
 * @param encryptionKey - Base64-encoded encryption key
 * @param keyVersion - Encryption key version
 * @returns Encrypted PII ready for database storage
 */
export async function encryptCustomerPII(
  pii: CustomerPII,
  tenantId: string,
  encryptionKey: string,
  keyVersion: number = 1
): Promise<EncryptedCustomerPII> {
  const encrypted: EncryptedCustomerPII = {
    // Only hash phone if provided - addresses don't require phone
    phone_hash: pii.phone ? hashPhoneNumber(pii.phone, tenantId) : '',
    encryption_key_version: keyVersion,
  };

  // Encrypt each field if provided
  if (pii.phone) {
    encrypted.phone_number_encrypted = await encryptField(pii.phone, encryptionKey, keyVersion);
  }

  if (pii.name) {
    encrypted.name_encrypted = await encryptField(pii.name, encryptionKey, keyVersion);
  }

  if (pii.email) {
    encrypted.email_encrypted = await encryptField(pii.email, encryptionKey, keyVersion);
  }

  if (pii.notes) {
    encrypted.notes_encrypted = await encryptField(pii.notes, encryptionKey, keyVersion);
  }

  if (pii.address_line1) {
    encrypted.address_line1_encrypted = await encryptField(
      pii.address_line1,
      encryptionKey,
      keyVersion
    );
  }

  if (pii.address_line2) {
    encrypted.address_line2_encrypted = await encryptField(
      pii.address_line2,
      encryptionKey,
      keyVersion
    );
  }

  return encrypted;
}

/**
 * Decrypt all PII fields for a customer
 *
 * @param encrypted - Encrypted PII from database
 * @param encryptionKey - Base64-encoded encryption key
 * @returns Decrypted customer PII
 */
export async function decryptCustomerPII(
  encrypted: EncryptedCustomerPII,
  encryptionKey: string
): Promise<CustomerPII> {
  const decrypted: CustomerPII = {};

  // Decrypt each field if present
  if (encrypted.phone_number_encrypted) {
    decrypted.phone = await decryptField(encrypted.phone_number_encrypted, encryptionKey);
  }

  if (encrypted.name_encrypted) {
    decrypted.name = await decryptField(encrypted.name_encrypted, encryptionKey);
  }

  if (encrypted.email_encrypted) {
    decrypted.email = await decryptField(encrypted.email_encrypted, encryptionKey);
  }

  if (encrypted.notes_encrypted) {
    decrypted.notes = await decryptField(encrypted.notes_encrypted, encryptionKey);
  }

  if (encrypted.address_line1_encrypted) {
    decrypted.address_line1 = await decryptField(
      encrypted.address_line1_encrypted,
      encryptionKey
    );
  }

  if (encrypted.address_line2_encrypted) {
    decrypted.address_line2 = await decryptField(
      encrypted.address_line2_encrypted,
      encryptionKey
    );
  }

  return decrypted;
}

/**
 * Validate phone number format
 *
 * @param phoneNumber - Phone number to validate
 * @returns true if valid format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  // Accept synthetic aggregator identifiers (agg:platform:id format)
  // These are used for customers from Swiggy/Zomato without real phone numbers
  if (phoneNumber.startsWith('agg:')) {
    return phoneNumber.length >= 8; // agg:x:y minimum
  }

  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Check if it starts with + and has 10-15 digits
  // This covers most international phone formats
  const phoneRegex = /^\+?\d{10,15}$/;

  return phoneRegex.test(cleaned);
}

/**
 * Normalize phone number to E.164 format
 *
 * @param phoneNumber - Phone number to normalize
 * @param defaultCountryCode - Default country code if not provided (e.g., "+91" for India)
 * @returns Normalized phone number
 */
export function normalizePhoneNumber(
  phoneNumber: string,
  defaultCountryCode: string = '+91'
): string {
  // Don't modify synthetic aggregator identifiers
  if (phoneNumber.startsWith('agg:')) {
    return phoneNumber;
  }

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // If doesn't start with +, add default country code
  if (!cleaned.startsWith('+')) {
    // Remove leading 0 if present (common in Indian numbers)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = defaultCountryCode + cleaned;
  }

  return cleaned;
}
