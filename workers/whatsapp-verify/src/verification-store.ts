/**
 * Verification Store
 * Manages OTP codes in KV storage
 */

import type { Env, VerificationRecord } from './types';

const MAX_VERIFICATION_ATTEMPTS = 3;

export class VerificationStore {
  private kv: KVNamespace;
  private codeLength: number;
  private expirySeconds: number;

  constructor(env: Env) {
    this.kv = env.VERIFICATION_STORE;
    this.codeLength = parseInt(env.VERIFICATION_CODE_LENGTH || '6', 10);
    this.expirySeconds = parseInt(env.VERIFICATION_EXPIRY_SECONDS || '600', 10);
  }

  /**
   * Generate a random numeric OTP code
   */
  generateCode(): string {
    const min = Math.pow(10, this.codeLength - 1);
    const max = Math.pow(10, this.codeLength) - 1;
    const code = Math.floor(Math.random() * (max - min + 1)) + min;
    return code.toString();
  }

  /**
   * Get verification key for a phone number
   */
  private getKey(phone: string): string {
    const normalized = phone.replace(/\D/g, '');
    return `verification:${normalized}`;
  }

  /**
   * Create and store a new verification
   */
  async createVerification(
    phone: string,
    messageId?: string
  ): Promise<{ code: string; verificationId: string; expiresAt: number }> {
    const code = this.generateCode();
    const now = Date.now();
    const expiresAt = now + this.expirySeconds * 1000;
    const verificationId = `ver_${now}_${Math.random().toString(36).substr(2, 9)}`;

    const record: VerificationRecord = {
      code,
      phone,
      createdAt: now,
      expiresAt,
      attempts: 0,
      maxAttempts: MAX_VERIFICATION_ATTEMPTS,
      messageId,
    };

    const key = this.getKey(phone);
    await this.kv.put(key, JSON.stringify(record), {
      expirationTtl: this.expirySeconds + 60, // Add 1 minute buffer
    });

    return { code, verificationId, expiresAt };
  }

  /**
   * Verify a code for a phone number
   */
  async verifyCode(
    phone: string,
    code: string
  ): Promise<{
    valid: boolean;
    status: 'approved' | 'pending' | 'expired' | 'max_attempts' | 'not_found';
    message: string;
  }> {
    const key = this.getKey(phone);
    const dataStr = await this.kv.get(key);

    if (!dataStr) {
      return {
        valid: false,
        status: 'not_found',
        message: 'No pending verification found. Please request a new code.',
      };
    }

    const record: VerificationRecord = JSON.parse(dataStr);
    const now = Date.now();

    // Check if expired
    if (record.expiresAt < now) {
      await this.kv.delete(key);
      return {
        valid: false,
        status: 'expired',
        message: 'Verification code has expired. Please request a new code.',
      };
    }

    // Check if max attempts reached
    if (record.attempts >= record.maxAttempts) {
      await this.kv.delete(key);
      return {
        valid: false,
        status: 'max_attempts',
        message: 'Too many incorrect attempts. Please request a new code.',
      };
    }

    // Check the code
    if (record.code === code) {
      // Success - delete the verification
      await this.kv.delete(key);
      return {
        valid: true,
        status: 'approved',
        message: 'Verification successful',
      };
    }

    // Wrong code - increment attempts
    record.attempts++;
    await this.kv.put(key, JSON.stringify(record), {
      expirationTtl: Math.ceil((record.expiresAt - now) / 1000) + 60,
    });

    const attemptsRemaining = record.maxAttempts - record.attempts;
    return {
      valid: false,
      status: 'pending',
      message: `Invalid code. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`,
    };
  }

  /**
   * Cancel/invalidate a pending verification
   */
  async cancelVerification(phone: string): Promise<void> {
    const key = this.getKey(phone);
    await this.kv.delete(key);
  }

  /**
   * Check if there's a pending verification
   */
  async hasPendingVerification(phone: string): Promise<boolean> {
    const key = this.getKey(phone);
    const dataStr = await this.kv.get(key);

    if (!dataStr) return false;

    const record: VerificationRecord = JSON.parse(dataStr);
    return record.expiresAt > Date.now();
  }
}
