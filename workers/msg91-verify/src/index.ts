/**
 * Handsfree MSG91 Verify Worker
 * Provides SMS and WhatsApp verification services via MSG91
 */

import type {
  Env,
  StartVerificationRequest,
  StartVerificationResponse,
  CheckVerificationRequest,
  CheckVerificationResponse,
} from './types';
import { MSG91Client } from './msg91-client';
import { RateLimiter } from './rate-limiter';

/**
 * Validate E.164 phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  // E.164 format: +[country code][subscriber number]
  // Example: +919876543210, +14155551234
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * CORS headers for responses
 */
function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * JSON response helper
 */
function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin),
      });
    }

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse({
        success: true,
        service: 'handsfree-msg91-verify',
        version: env.SERVICE_VERSION || '1.0.0',
        status: 'operational',
        provider: 'MSG91',
        timestamp: new Date().toISOString(),
      }, 200, corsHeaders(origin));
    }

    // Start verification
    if (url.pathname === '/verify/start' && request.method === 'POST') {
      try {
        const body: StartVerificationRequest = await request.json();

        // Validate request
        if (!body.to) {
          return jsonResponse({
            success: false,
            error: 'Missing required field: to',
            code: 'MISSING_PHONE',
          }, 400, corsHeaders(origin));
        }

        // Validate phone number format
        if (!isValidPhoneNumber(body.to)) {
          return jsonResponse({
            success: false,
            error: 'Invalid phone number format. Use E.164 format (e.g., +919876543210)',
            code: 'INVALID_PHONE_FORMAT',
          }, 400, corsHeaders(origin));
        }

        // Check rate limit
        const rateLimiter = new RateLimiter(env);
        const rateLimit = await rateLimiter.checkRateLimit(body.to);

        if (!rateLimit.allowed) {
          return jsonResponse({
            success: false,
            error: rateLimit.reason,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: rateLimit.retryAfter,
          }, 429, {
            ...corsHeaders(origin),
            'Retry-After': rateLimit.retryAfter?.toString() || '3600',
          });
        }

        // Send OTP
        const msg91Client = new MSG91Client(env);
        const result = await msg91Client.sendOTP(
          body.to,
          body.channel || 'sms',
          body.locale
        );

        // Record attempt
        await rateLimiter.recordAttempt(body.to);

        const response: StartVerificationResponse = {
          success: true,
          verificationSid: result.requestId,
          requestId: result.requestId,
          channel: result.channel as 'sms' | 'whatsapp',
          to: result.to,
          status: result.status,
          message: `Verification code sent via ${result.channel}`,
        };

        return jsonResponse(response, 200, corsHeaders(origin));

      } catch (error) {
        console.error('[MSG91] Start verification error:', error);
        return jsonResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start verification',
          code: 'VERIFICATION_FAILED',
        }, 500, corsHeaders(origin));
      }
    }

    // Check verification
    if (url.pathname === '/verify/check' && request.method === 'POST') {
      try {
        const body: CheckVerificationRequest = await request.json();

        // Validate request
        if (!body.to || !body.code) {
          return jsonResponse({
            success: false,
            error: 'Missing required fields: to, code',
            code: 'MISSING_FIELDS',
          }, 400, corsHeaders(origin));
        }

        // Validate phone number format
        if (!isValidPhoneNumber(body.to)) {
          return jsonResponse({
            success: false,
            error: 'Invalid phone number format. Use E.164 format (e.g., +919876543210)',
            code: 'INVALID_PHONE_FORMAT',
          }, 400, corsHeaders(origin));
        }

        // Verify OTP code
        const msg91Client = new MSG91Client(env);
        const result = await msg91Client.verifyOTP(body.to, body.code);

        const response: CheckVerificationResponse = {
          success: result.valid,
          status: result.status as 'pending' | 'approved' | 'canceled' | 'max_attempts_reached',
          valid: result.valid,
          to: result.to,
          channel: result.channel as 'sms' | 'whatsapp',
          message: result.valid
            ? 'Verification successful'
            : 'Invalid or expired verification code',
        };

        return jsonResponse(response, 200, corsHeaders(origin));

      } catch (error) {
        console.error('[MSG91] Check verification error:', error);
        return jsonResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check verification',
          code: 'VERIFICATION_CHECK_FAILED',
        }, 500, corsHeaders(origin));
      }
    }

    // Get rate limit info
    if (url.pathname === '/verify/rate-limit' && request.method === 'GET') {
      const phoneNumber = url.searchParams.get('phone');

      if (!phoneNumber) {
        return jsonResponse({
          success: false,
          error: 'Missing phone parameter',
          code: 'MISSING_PHONE',
        }, 400, corsHeaders(origin));
      }

      if (!isValidPhoneNumber(phoneNumber)) {
        return jsonResponse({
          success: false,
          error: 'Invalid phone number format',
          code: 'INVALID_PHONE_FORMAT',
        }, 400, corsHeaders(origin));
      }

      try {
        const rateLimiter = new RateLimiter(env);
        const info = await rateLimiter.getRateLimitInfo(phoneNumber);

        return jsonResponse({
          success: true,
          ...info,
        }, 200, corsHeaders(origin));

      } catch (error) {
        console.error('[MSG91] Rate limit info error:', error);
        return jsonResponse({
          success: false,
          error: 'Failed to get rate limit info',
          code: 'RATE_LIMIT_CHECK_FAILED',
        }, 500, corsHeaders(origin));
      }
    }

    // 404 - Route not found
    return jsonResponse({
      success: false,
      error: 'Route not found',
      availableEndpoints: [
        'GET /health',
        'POST /verify/start',
        'POST /verify/check',
        'GET /verify/rate-limit?phone={phoneNumber}',
      ],
    }, 404, corsHeaders(origin));
  },
};
