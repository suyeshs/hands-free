/**
 * Utility functions for WhatsApp webhook worker
 */

import type { Env } from './index';

/**
 * Clean up old sessions from KV (older than 24 hours)
 */
export async function cleanupOldSessions(env: Env): Promise<void> {
  console.log('[Cleanup] Starting session cleanup...');

  try {
    // List all session keys
    const list = await env.WHATSAPP_SESSIONS.list({ prefix: 'session:' });

    let cleanedCount = 0;
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const key of list.keys) {
      try {
        const session = await env.WHATSAPP_SESSIONS.get(key.name, 'json') as any;

        if (session && session.lastActive) {
          const age = now - session.lastActive;

          // Delete sessions older than 24 hours
          if (age > maxAge) {
            await env.WHATSAPP_SESSIONS.delete(key.name);
            cleanedCount++;
          }
        }
      } catch (error) {
        console.error(`[Cleanup] Error processing key ${key.name}:`, error);
      }
    }

    console.log(`[Cleanup] Cleaned up ${cleanedCount} old sessions`);
  } catch (error) {
    console.error('[Cleanup] Error during session cleanup:', error);
  }
}

/**
 * Get metrics from KV and database
 */
export async function handleMetrics(env: Env): Promise<Response> {
  try {
    // Get session count
    const sessionsList = await env.WHATSAPP_SESSIONS.list({ prefix: 'session:' });
    const activeSessionsCount = sessionsList.keys.length;

    // Get message counts from database (if you're storing them)
    // const messageStats = await env.RESTAURANT_DB
    //   .prepare('SELECT COUNT(*) as total FROM whatsapp_messages WHERE created_at > ?')
    //   .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    //   .first();

    const metrics = {
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT,
      activeSessions: activeSessionsCount,
      // messagesLast24h: messageStats?.total || 0,
      uptime: 'healthy',
    };

    return Response.json(metrics);
  } catch (error) {
    console.error('[Metrics] Error:', error);
    return Response.json(
      {
        error: 'Failed to fetch metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Format phone number to WhatsApp format
 * @param phone Phone number in any format
 * @returns Formatted phone number (e.g., "919876543210")
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let formatted = phone.replace(/\D/g, '');

  // If starts with +, remove it
  if (phone.startsWith('+')) {
    formatted = phone.substring(1).replace(/\D/g, '');
  }

  // If doesn't start with country code, assume India (+91)
  if (formatted.length === 10) {
    formatted = '91' + formatted;
  }

  return formatted;
}

/**
 * Validate WhatsApp message payload
 */
export function isValidWebhookPayload(body: any): boolean {
  return (
    body &&
    body.object === 'whatsapp_business_account' &&
    Array.isArray(body.entry) &&
    body.entry.length > 0
  );
}

/**
 * Extract text from WhatsApp message
 */
export function extractMessageText(message: any): string {
  if (message.type === 'text' && message.text) {
    return message.text.body;
  }

  if (message.type === 'interactive' && message.interactive) {
    if (message.interactive.button_reply) {
      return message.interactive.button_reply.title;
    }
    if (message.interactive.list_reply) {
      return message.interactive.list_reply.title;
    }
  }

  if (message.type === 'location' && message.location) {
    return `Location: ${message.location.name || 'Unknown'} (${message.location.latitude}, ${message.location.longitude})`;
  }

  return '';
}

/**
 * Create a rate limiter using KV
 */
export async function checkRateLimit(
  userId: string,
  env: Env,
  maxRequests: number = 10,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${userId}`;
  const now = Date.now();

  try {
    const data = await env.WHATSAPP_SESSIONS.get(key, 'json') as any;

    if (!data) {
      // First request
      await env.WHATSAPP_SESSIONS.put(
        key,
        JSON.stringify({
          count: 1,
          resetAt: now + windowSeconds * 1000,
        }),
        { expirationTtl: windowSeconds }
      );

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowSeconds * 1000,
      };
    }

    // Check if window expired
    if (now > data.resetAt) {
      // Reset
      await env.WHATSAPP_SESSIONS.put(
        key,
        JSON.stringify({
          count: 1,
          resetAt: now + windowSeconds * 1000,
        }),
        { expirationTtl: windowSeconds }
      );

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowSeconds * 1000,
      };
    }

    // Check if limit exceeded
    if (data.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: data.resetAt,
      };
    }

    // Increment count
    data.count++;
    await env.WHATSAPP_SESSIONS.put(
      key,
      JSON.stringify(data),
      { expirationTtl: Math.floor((data.resetAt - now) / 1000) }
    );

    return {
      allowed: true,
      remaining: maxRequests - data.count,
      resetAt: data.resetAt,
    };
  } catch (error) {
    console.error('[RateLimit] Error:', error);
    // On error, allow request
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: now + windowSeconds * 1000,
    };
  }
}

/**
 * Log message to database (optional)
 */
export async function logMessageToDatabase(
  env: Env,
  data: {
    messageId: string;
    userId: string;
    direction: 'inbound' | 'outbound';
    messageType: string;
    content: string;
    tenantId?: string;
  }
): Promise<void> {
  try {
    await env.RESTAURANT_DB
      .prepare(
        `INSERT INTO whatsapp_messages (id, user_id, direction, message_type, content, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        data.messageId,
        data.userId,
        data.direction,
        data.messageType,
        data.content,
        data.tenantId || null,
        new Date().toISOString()
      )
      .run();
  } catch (error) {
    // Silently fail if table doesn't exist
    console.warn('[LogMessage] Could not log to database:', error);
  }
}
