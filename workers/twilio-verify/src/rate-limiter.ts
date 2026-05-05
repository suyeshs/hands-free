/**
 * Rate Limiter for Verification Requests
 * Prevents abuse by limiting verification attempts per phone number
 */

import type { Env, RateLimitInfo } from './types';

const MAX_ATTEMPTS_PER_HOUR = 5;
const MAX_ATTEMPTS_PER_DAY = 10;
const BLOCK_DURATION_HOURS = 24;

export class RateLimiter {
  private kv: KVNamespace;

  constructor(env: Env) {
    this.kv = env.VERIFICATION_ATTEMPTS;
  }

  private getKey(phoneNumber: string, type: 'hour' | 'day'): string {
    const now = new Date();
    if (type === 'hour') {
      const hour = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      return `rate:${phoneNumber}:${hour}`;
    } else {
      const day = now.toISOString().slice(0, 10); // YYYY-MM-DD
      return `rate:${phoneNumber}:${day}`;
    }
  }

  private getBlockKey(phoneNumber: string): string {
    return `blocked:${phoneNumber}`;
  }

  /**
   * Check if phone number is blocked
   */
  async isBlocked(phoneNumber: string): Promise<boolean> {
    const blockKey = this.getBlockKey(phoneNumber);
    const blocked = await this.kv.get(blockKey);
    return blocked !== null;
  }

  /**
   * Get rate limit info for phone number
   */
  async getRateLimitInfo(phoneNumber: string): Promise<RateLimitInfo> {
    const hourKey = this.getKey(phoneNumber, 'hour');
    const dayKey = this.getKey(phoneNumber, 'day');
    const blockKey = this.getBlockKey(phoneNumber);

    const [hourAttempts, dayAttempts, blockInfo] = await Promise.all([
      this.kv.get(hourKey),
      this.kv.get(dayKey),
      this.kv.get(blockKey),
    ]);

    const hourCount = hourAttempts ? parseInt(hourAttempts) : 0;
    const dayCount = dayAttempts ? parseInt(dayAttempts) : 0;

    const blocked = blockInfo !== null;
    const blockedUntil = blocked && blockInfo ? parseInt(blockInfo) : undefined;

    return {
      attempts: Math.max(hourCount, dayCount),
      lastAttempt: Date.now(),
      blocked,
      blockedUntil,
    };
  }

  /**
   * Check if request should be rate limited
   */
  async checkRateLimit(phoneNumber: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    // Check if blocked
    const blocked = await this.isBlocked(phoneNumber);
    if (blocked) {
      return {
        allowed: false,
        reason: 'Phone number is temporarily blocked due to excessive attempts',
        retryAfter: BLOCK_DURATION_HOURS * 3600,
      };
    }

    const hourKey = this.getKey(phoneNumber, 'hour');
    const dayKey = this.getKey(phoneNumber, 'day');

    const [hourAttempts, dayAttempts] = await Promise.all([
      this.kv.get(hourKey),
      this.kv.get(dayKey),
    ]);

    const hourCount = hourAttempts ? parseInt(hourAttempts) : 0;
    const dayCount = dayAttempts ? parseInt(dayAttempts) : 0;

    // Check hourly limit
    if (hourCount >= MAX_ATTEMPTS_PER_HOUR) {
      return {
        allowed: false,
        reason: `Too many attempts. Maximum ${MAX_ATTEMPTS_PER_HOUR} per hour`,
        retryAfter: 3600, // 1 hour
      };
    }

    // Check daily limit
    if (dayCount >= MAX_ATTEMPTS_PER_DAY) {
      // Block the phone number for 24 hours
      const blockUntil = Date.now() + (BLOCK_DURATION_HOURS * 3600 * 1000);
      await this.kv.put(
        this.getBlockKey(phoneNumber),
        blockUntil.toString(),
        { expirationTtl: BLOCK_DURATION_HOURS * 3600 }
      );

      return {
        allowed: false,
        reason: `Daily limit exceeded. Maximum ${MAX_ATTEMPTS_PER_DAY} per day. Blocked for ${BLOCK_DURATION_HOURS} hours`,
        retryAfter: BLOCK_DURATION_HOURS * 3600,
      };
    }

    return { allowed: true };
  }

  /**
   * Record verification attempt
   */
  async recordAttempt(phoneNumber: string): Promise<void> {
    const hourKey = this.getKey(phoneNumber, 'hour');
    const dayKey = this.getKey(phoneNumber, 'day');

    // Increment hour counter
    const hourCount = await this.kv.get(hourKey);
    const newHourCount = (hourCount ? parseInt(hourCount) : 0) + 1;
    await this.kv.put(hourKey, newHourCount.toString(), {
      expirationTtl: 3600, // 1 hour
    });

    // Increment day counter
    const dayCount = await this.kv.get(dayKey);
    const newDayCount = (dayCount ? parseInt(dayCount) : 0) + 1;
    await this.kv.put(dayKey, newDayCount.toString(), {
      expirationTtl: 86400, // 24 hours
    });
  }
}
