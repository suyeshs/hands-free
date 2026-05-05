/**
 * Handsfree WhatsApp Verify Worker
 * Provides OTP verification via Meta WhatsApp Business API
 *
 * Endpoints:
 * - GET  /health                    - Health check
 * - POST /verify/start              - Start verification (send OTP)
 * - POST /verify/check              - Check verification code
 * - GET  /verify/rate-limit?phone=  - Get rate limit info
 *
 * DEV MODE: Any 4-digit code is accepted for verification bypass
 */

import type {
  Env,
  StartVerificationRequest,
  StartVerificationResponse,
  CheckVerificationRequest,
  CheckVerificationResponse,
} from './types';

// DEV MODE: Set to true to bypass actual verification
// Any 4-digit code will be accepted
const DEV_MODE_BYPASS = true;

/**
 * Validate E.164 phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * CORS headers for responses
 */
function corsHeaders(origin?: string | null) {
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
function jsonResponse(
  data: object,
  status: number = 200,
  headers: Record<string, string> = {}
) {
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
      // Optionally check WhatsApp API connectivity
      let whatsappStatus = 'not_checked';

      if (env.META_ACCESS_TOKEN && env.META_PHONE_NUMBER_ID) {
        try {
          const client = new WhatsAppClient(env);
          const health = await client.checkHealth();
          whatsappStatus = health.valid ? 'connected' : 'error';
        } catch {
          whatsappStatus = 'error';
        }
      } else {
        whatsappStatus = 'not_configured';
      }

      return jsonResponse(
        {
          success: true,
          service: 'handsfree-whatsapp-verify',
          version: env.SERVICE_VERSION || '1.0.0',
          status: 'operational',
          whatsapp: whatsappStatus,
          timestamp: new Date().toISOString(),
        },
        200,
        corsHeaders(origin)
      );
    }

    // Start verification - send OTP via WhatsApp
    if (url.pathname === '/verify/start' && request.method === 'POST') {
      try {
        const body: StartVerificationRequest = await request.json();

        // Validate request
        if (!body.to) {
          return jsonResponse(
            { success: false, error: 'Missing required field: to' },
            400,
            corsHeaders(origin)
          );
        }

        // Validate phone number format
        if (!isValidPhoneNumber(body.to)) {
          return jsonResponse(
            {
              success: false,
              error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)',
            },
            400,
            corsHeaders(origin)
          );
        }

        // DEV MODE: Skip actual WhatsApp sending, just return success
        if (DEV_MODE_BYPASS) {
          console.log('[WhatsApp Verify] DEV MODE: Bypassing OTP send for', body.to);
          const verificationId = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

          const response: StartVerificationResponse = {
            success: true,
            verificationId,
            to: body.to,
            status: 'pending',
            message: 'DEV MODE: Enter any 4-digit code to verify',
            expiresAt: new Date(expiresAt).toISOString(),
          };

          return jsonResponse(response, 200, corsHeaders(origin));
        }

        // Production flow below (when DEV_MODE_BYPASS is false)
        // Import dependencies only when needed
        const { RateLimiter } = await import('./rate-limiter');
        const { VerificationStore } = await import('./verification-store');
        const { WhatsAppClient } = await import('./whatsapp-client');

        // Check rate limit
        const rateLimiter = new RateLimiter(env);
        const rateLimit = await rateLimiter.checkRateLimit(body.to);

        if (!rateLimit.allowed) {
          return jsonResponse(
            {
              success: false,
              error: rateLimit.reason,
              retryAfter: rateLimit.retryAfter,
            },
            429,
            {
              ...corsHeaders(origin),
              'Retry-After': rateLimit.retryAfter?.toString() || '3600',
            }
          );
        }

        // Generate and store verification code
        const store = new VerificationStore(env);
        const { code, verificationId, expiresAt } = await store.createVerification(body.to);

        // Send OTP via WhatsApp
        const client = new WhatsAppClient(env);
        const result = await client.sendOTP(body.to, code, body.locale);

        if (!result.success) {
          // Clean up the stored verification
          await store.cancelVerification(body.to);

          return jsonResponse(
            { success: false, error: result.error || 'Failed to send verification code' },
            500,
            corsHeaders(origin)
          );
        }

        // Record the rate limit attempt
        await rateLimiter.recordAttempt(body.to);

        const response: StartVerificationResponse = {
          success: true,
          verificationId,
          to: body.to,
          status: 'pending',
          message: 'Verification code sent via WhatsApp',
          expiresAt: new Date(expiresAt).toISOString(),
        };

        return jsonResponse(response, 200, corsHeaders(origin));
      } catch (error) {
        console.error('[WhatsApp Verify] Start verification error:', error);
        return jsonResponse(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start verification',
          },
          500,
          corsHeaders(origin)
        );
      }
    }

    // Check verification code
    if (url.pathname === '/verify/check' && request.method === 'POST') {
      try {
        const body: CheckVerificationRequest = await request.json();

        // Validate request
        if (!body.to || !body.code) {
          return jsonResponse(
            { success: false, error: 'Missing required fields: to, code' },
            400,
            corsHeaders(origin)
          );
        }

        // Validate phone number format
        if (!isValidPhoneNumber(body.to)) {
          return jsonResponse(
            {
              success: false,
              error: 'Invalid phone number format. Use E.164 format',
            },
            400,
            corsHeaders(origin)
          );
        }

        // DEV MODE: Accept any 4-digit code
        if (DEV_MODE_BYPASS) {
          // Validate code format (4 digits for dev mode)
          if (!/^\d{4}$/.test(body.code)) {
            return jsonResponse(
              { success: false, error: 'Invalid code format. Must be 4 digits.' },
              400,
              corsHeaders(origin)
            );
          }

          console.log('[WhatsApp Verify] DEV MODE: Accepting code', body.code, 'for', body.to);

          const response: CheckVerificationResponse = {
            success: true,
            valid: true,
            status: 'approved',
            to: body.to,
            message: 'DEV MODE: Verification successful',
          };

          return jsonResponse(response, 200, corsHeaders(origin));
        }

        // Production flow below (when DEV_MODE_BYPASS is false)
        // Validate code format (6 digits)
        if (!/^\d{6}$/.test(body.code)) {
          return jsonResponse(
            { success: false, error: 'Invalid code format. Must be 6 digits.' },
            400,
            corsHeaders(origin)
          );
        }

        // Verify the code
        const { VerificationStore } = await import('./verification-store');
        const store = new VerificationStore(env);
        const result = await store.verifyCode(body.to, body.code);

        const response: CheckVerificationResponse = {
          success: result.valid,
          valid: result.valid,
          status: result.status,
          to: body.to,
          message: result.message,
        };

        return jsonResponse(response, 200, corsHeaders(origin));
      } catch (error) {
        console.error('[WhatsApp Verify] Check verification error:', error);
        return jsonResponse(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to check verification',
          },
          500,
          corsHeaders(origin)
        );
      }
    }

    // Get rate limit info
    if (url.pathname === '/verify/rate-limit' && request.method === 'GET') {
      const phoneNumber = url.searchParams.get('phone');

      if (!phoneNumber) {
        return jsonResponse(
          { success: false, error: 'Missing phone parameter' },
          400,
          corsHeaders(origin)
        );
      }

      if (!isValidPhoneNumber(phoneNumber)) {
        return jsonResponse(
          { success: false, error: 'Invalid phone number format' },
          400,
          corsHeaders(origin)
        );
      }

      try {
        const rateLimiter = new RateLimiter(env);
        const info = await rateLimiter.getRateLimitInfo(phoneNumber);

        return jsonResponse(
          { success: true, ...info },
          200,
          corsHeaders(origin)
        );
      } catch (error) {
        console.error('[WhatsApp Verify] Rate limit info error:', error);
        return jsonResponse(
          { success: false, error: 'Failed to get rate limit info' },
          500,
          corsHeaders(origin)
        );
      }
    }

    // 404 - Route not found
    return jsonResponse(
      {
        success: false,
        error: 'Route not found',
        availableEndpoints: [
          'GET /health',
          'POST /verify/start',
          'POST /verify/check',
          'GET /verify/rate-limit?phone={phoneNumber}',
        ],
      },
      404,
      corsHeaders(origin)
    );
  },
};
