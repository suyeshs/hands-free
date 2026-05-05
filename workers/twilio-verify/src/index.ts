/**
 * Handsfree Twilio Verify Worker
 * Provides SMS and WhatsApp verification services
 */

import type {
  Env,
  StartVerificationRequest,
  StartVerificationResponse,
  CheckVerificationRequest,
  CheckVerificationResponse,
} from './types';
import { TwilioVerifyClient } from './twilio-client';
import { RateLimiter } from './rate-limiter';

/**
 * Validate E.164 phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  // E.164 format: +[country code][subscriber number]
  // Example: +14155551234
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
        service: 'handsfree-twilio-verify',
        version: env.SERVICE_VERSION || '1.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
      }, 200, corsHeaders(origin));
    }

    // Start verification
    if (url.pathname === '/verify/start' && request.method === 'POST') {
      try {
        const body: StartVerificationRequest = await request.json();

        // Validate request
        if (!body.to || !body.channel) {
          return jsonResponse({
            success: false,
            error: 'Missing required fields: to, channel',
          }, 400, corsHeaders(origin));
        }

        // Validate phone number format
        if (!isValidPhoneNumber(body.to)) {
          return jsonResponse({
            success: false,
            error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)',
          }, 400, corsHeaders(origin));
        }

        // Validate channel
        if (body.channel !== 'sms' && body.channel !== 'whatsapp') {
          return jsonResponse({
            success: false,
            error: 'Invalid channel. Must be "sms" or "whatsapp"',
          }, 400, corsHeaders(origin));
        }

        // Check rate limit
        const rateLimiter = new RateLimiter(env);
        const rateLimit = await rateLimiter.checkRateLimit(body.to);

        if (!rateLimit.allowed) {
          return jsonResponse({
            success: false,
            error: rateLimit.reason,
            retryAfter: rateLimit.retryAfter,
          }, 429, {
            ...corsHeaders(origin),
            'Retry-After': rateLimit.retryAfter?.toString() || '3600',
          });
        }

        // Start verification
        const twilioClient = new TwilioVerifyClient(env);
        const result = await twilioClient.startVerification(
          body.to,
          body.channel,
          body.locale
        );

        // Record attempt
        await rateLimiter.recordAttempt(body.to);

        const response: StartVerificationResponse = {
          success: true,
          verificationSid: result.sid,
          channel: result.channel as 'sms' | 'whatsapp',
          to: result.to,
          status: result.status,
          message: `Verification code sent via ${result.channel}`,
        };

        return jsonResponse(response, 200, corsHeaders(origin));

      } catch (error) {
        console.error('Start verification error:', error);
        return jsonResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start verification',
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
          }, 400, corsHeaders(origin));
        }

        // Validate phone number format
        if (!isValidPhoneNumber(body.to)) {
          return jsonResponse({
            success: false,
            error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)',
          }, 400, corsHeaders(origin));
        }

        // Check verification code
        const twilioClient = new TwilioVerifyClient(env);
        const result = await twilioClient.checkVerification(body.to, body.code);

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
        console.error('Check verification error:', error);
        return jsonResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check verification',
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
        }, 400, corsHeaders(origin));
      }

      if (!isValidPhoneNumber(phoneNumber)) {
        return jsonResponse({
          success: false,
          error: 'Invalid phone number format',
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
        console.error('Rate limit info error:', error);
        return jsonResponse({
          success: false,
          error: 'Failed to get rate limit info',
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
