/**
 * TOTP (Time-based One-Time Password) utilities
 * For authenticator app-based 2FA (Google Authenticator, Authy, 1Password, etc.)
 */

import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || 'handsfree-totp-encryption-key-2025-change-me-in-prod';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(userIdentifier: string): {
  secret: string;
  base32: string;
  otpauthUrl: string;
} {
  const secret = speakeasy.generateSecret({
    name: `Handsfree Admin (${userIdentifier})`,
    issuer: 'Handsfree',
    length: 32,
  });

  return {
    secret: secret.ascii,
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url || '',
  };
}

/**
 * Encrypt TOTP secret before storing in database
 */
export function encryptTOTPSecret(secret: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    iv
  );

  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt TOTP secret from database
 */
export function decryptTOTPSecret(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Verify a TOTP token against a secret
 */
export function verifyTOTPToken(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2, // Allow 2 time steps before/after for clock skew
  });
}

/**
 * Generate QR code data URL for TOTP setup
 */
export async function generateTOTPQRCode(otpauthUrl: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate backup codes for account recovery
 * Returns array of 10 backup codes (8 characters each)
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];

  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric code (without confusing characters)
    const code = crypto
      .randomBytes(5)
      .toString('hex')
      .toUpperCase()
      .slice(0, 8);
    codes.push(code);
  }

  return codes;
}

/**
 * Hash backup code for storage
 */
export function hashBackupCode(code: string): string {
  return crypto
    .createHmac('sha256', ENCRYPTION_KEY)
    .update(code.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .digest('hex');
}

/**
 * Verify a backup code
 */
export function verifyBackupCode(inputCode: string, hashedCodes: string[]): boolean {
  const inputHash = hashBackupCode(inputCode);
  return hashedCodes.includes(inputHash);
}

/**
 * Remove a used backup code from the list
 */
export function removeUsedBackupCode(usedCode: string, hashedCodes: string[]): string[] {
  const usedHash = hashBackupCode(usedCode);
  return hashedCodes.filter(hash => hash !== usedHash);
}

/**
 * Format backup codes for display (XXXX-XXXX format)
 */
export function formatBackupCode(code: string): string {
  return code.slice(0, 4) + '-' + code.slice(4);
}

/**
 * Validate TOTP token format (6 digits)
 */
export function isValidTOTPFormat(token: string): boolean {
  return /^\d{6}$/.test(token);
}

/**
 * Validate backup code format (8 alphanumeric characters)
 */
export function isValidBackupCodeFormat(code: string): boolean {
  const normalized = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return normalized.length === 8;
}
