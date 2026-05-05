/**
 * Rate Limiter for WhatsApp Verification
 * Prevents abuse by limiting verification attempts
 */

import type { Env, RateLimitInfo } from './types';

const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 10;
const BLOCK_DURATION_HOURS = 24;

interface RateLimitData {
  hourlyAttempts: number;
  dailyAttempts: number;
  hourlyResetAt: number;
  dailyResetAt: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private kv: KVNamespace;

  constructor(env: Env) {
    this.kv = env.VERIFICATION_STORE;
  }

  private getKey(phone: string): string {
    // Normalize phone number for consistent keys
    const normalized = phone.replace(/\D/g, '');
    return `rate_limit:${normalized}`;
  }

  async checkRateLimit(phone: string): Promise<RateLimitInfo> {
    const key = this.getKey(phone);
    const now = Date.now();

    // Get current rate limit data
    const dataStr = await this.kv.get(key);
    let data: RateLimitData;

    if (dataStr) {
      data = JSON.parse(dataStr);

      // Check if blocked
      if (data.blockedUntil && data.blockedUntil > now) {
        const retryAfter = Math.ceil((data.blockedUntil - now) / 1000);
        return {
          allowed: false,
          reason: 'Too many verification attempts. Please try again later.',
          retryAfter,
          attemptsRemaining: { hourly: 0, daily: 0 },
        };
      }

      // Reset hourly counter if needed
      if (data.hourlyResetAt <= now) {
        data.hourlyAttempts = 0;
        data.hourlyResetAt = now + 60 * 60 * 1000; // 1 hour
      }

      // Reset daily counter if needed
      if (data.dailyResetAt <= now) {
        data.dailyAttempts = 0;
        data.dailyResetAt = now + 24 * 60 * 60 * 1000; // 24 hours
        delete data.blockedUntil;
      }
    } else {
      // Initialize rate limit data
      data = {
        hourlyAttempts: 0,
        dailyAttempts: 0,
        hourlyResetAt: now + 60 * 60 * 1000,
        dailyResetAt: now + 24 * 60 * 60 * 1000,
      };
    }

    // Check limits
    if (data.hourlyAttempts >= HOURLY_LIMIT) {
      const retryAfter = Math.ceil((data.hourlyResetAt - now) / 1000);
      return {
        allowed: false,
        reason: 'Hourly verification limit reached. Please try again later.',
        retryAfter,
        attemptsRemaining: {
          hourly: 0,
          daily: DAILY_LIMIT - data.dailyAttempts,
        },
      };
    }

    if (data.dailyAttempts >= DAILY_LIMIT) {
      // Block for 24 hours
      data.blockedUntil = now + BLOCK_DURATION_HOURS * 60 * 60 * 1000;
      await this.kv.put(key, JSON.stringify(data), {
        expirationTtl: BLOCK_DURATION_HOURS * 60 * 60,
      });

      return {
        allowed: false,
        reason: 'Daily verification limit reached. Please try again tomorrow.',
        retryAfter: BLOCK_DURATION_HOURS * 60 * 60,
        attemptsRemaining: { hourly: 0, daily: 0 },
      };
    }

    return {
      allowed: true,
      attemptsRemaining: {
        hourly: HOURLY_LIMIT - data.hourlyAttempts,
        daily: DAILY_LIMIT - data.dailyAttempts,
      },
    };
  }

  async recordAttempt(phone: string): Promise<void> {
    const key = this.getKey(phone);
    const now = Date.now();

    const dataStr = await this.kv.get(key);
    let data: RateLimitData;

    if (dataStr) {
      data = JSON.parse(dataStr);

      // Reset counters if expired
      if (data.hourlyResetAt <= now) {
        data.hourlyAttempts = 0;
        data.hourlyResetAt = now + 60 * 60 * 1000;
      }
      if (data.dailyResetAt <= now) {
        data.dailyAttempts = 0;
        data.dailyResetAt = now + 24 * 60 * 60 * 1000;
      }
    } else {
      data = {
        hourlyAttempts: 0,
        dailyAttempts: 0,
        hourlyResetAt: now + 60 * 60 * 1000,
        dailyResetAt: now + 24 * 60 * 60 * 1000,
      };
    }

    // Increment counters
    data.hourlyAttempts++;
    data.dailyAttempts++;

    // Store with TTL
    await this.kv.put(key, JSON.stringify(data), {
      expirationTtl: 24 * 60 * 60, // 24 hours
    });
  }

  async getRateLimitInfo(phone: string): Promise<RateLimitInfo> {
    return this.checkRateLimit(phone);
  }
}
