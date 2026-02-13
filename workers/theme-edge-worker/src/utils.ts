/**
 * Utility functions for theme edge worker
 */

import { Env, ThemeJSON, AnalyticsEvent } from './types';

/**
 * Sign theme with WebCrypto for integrity verification
 */
export async function signTheme(theme: ThemeJSON, signingKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(theme));

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verify theme signature
 */
export async function verifyThemeSignature(
  theme: ThemeJSON,
  signature: string,
  signingKey: string
): Promise<boolean> {
  try {
    const expectedSignature = await signTheme(theme, signingKey);
    return expectedSignature === signature;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Log theme access to Analytics Engine
 */
export async function logThemeAccess(
  tenantId: string,
  cacheStatus: 'hit' | 'miss',
  latency: number,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  try {
    const event: AnalyticsEvent = {
      timestamp: Date.now(),
      tenantId,
      cacheStatus,
      latency,
      region: (globalThis as any).cf?.colo || 'unknown',
    };

    // Write to Analytics Engine (non-blocking)
    ctx.waitUntil(
      Promise.resolve(
        env.ANALYTICS.writeDataPoint({
          blobs: [tenantId, cacheStatus, event.region],
          doubles: [latency],
          indexes: [tenantId],
        })
      )
    );
  } catch (error) {
    // Don't fail the request if analytics fails
    console.error('Analytics logging failed:', error);
  }
}

/**
 * Purge theme cache using Cloudflare API
 */
export async function purgeThemeCache(
  tenantId: string,
  env: Env
): Promise<{ success: boolean; error?: string }> {
  if (!env.ZONE_ID || !env.CACHE_PURGE_TOKEN) {
    return {
      success: false,
      error: 'Missing ZONE_ID or CACHE_PURGE_TOKEN',
    };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CACHE_PURGE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tags: [`theme-${tenantId}`, `tenant-${tenantId}`],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Cloudflare API error: ${error}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify Cloudflare Access JWT token
 */
export async function verifyAccessJWT(
  request: Request,
  env: Env
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  // Check for simple Bearer token first (for admin-app API access)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (env.THEME_API_TOKEN && token === env.THEME_API_TOKEN) {
      return { valid: true, userId: 'admin-app' };
    }
  }

  // Fall back to Cloudflare Access JWT
  const jwt = request.headers.get('CF-Access-JWT-Assertion');

  if (!jwt) {
    return { valid: false, error: 'Missing authentication token' };
  }

  if (!env.ACCESS_TEAM) {
    return { valid: false, error: 'ACCESS_TEAM not configured' };
  }

  try {
    // Verify with Cloudflare Access
    const response = await fetch(
      `https://${env.ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/get-identity`,
      {
        headers: {
          'Cookie': `CF_Authorization=${jwt}`,
        },
      }
    );

    if (!response.ok) {
      return { valid: false, error: 'Invalid JWT token' };
    }

    const identity = await response.json<{ sub: string }>();
    return { valid: true, userId: identity.sub };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify Turnstile token for bot protection
 */
export async function verifyTurnstile(
  token: string,
  env: Env
): Promise<{ success: boolean; error?: string }> {
  if (!env.TURNSTILE_SECRET) {
    return { success: false, error: 'TURNSTILE_SECRET not configured' };
  }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET,
          response: token,
        }),
      }
    );

    const data = await response.json<{ success: boolean }>();
    return { success: data.success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate cache key for theme
 */
export function getThemeCacheKey(tenantId: string): string {
  return `theme:${tenantId}:v2`;
}

/**
 * Get default theme as fallback
 */
export function getDefaultTheme(): ThemeJSON {
  return {
    version: '2.0.0',
    meta: {
      name: 'Default Theme',
      description: 'Fallback default theme',
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    global: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        background: {
          main: '#111827',
          gradient: {
            from: '#111827',
            to: '#1f2937',
            direction: 'to-b',
          },
        },
      },
      typography: {
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif'],
        },
        scale: {
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
        },
      },
      spacing: {
        scale: 8,
        unit: 'px',
      },
      borderRadius: {
        base: '0.5rem',
        lg: '0.75rem',
      },
      shadows: {
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      },
    },
    components: {
      avatarGrid: {
        layout: {
          columns: {
            mobile: 2,
            tablet: 3,
            desktop: 4,
            largeDesktop: 5,
          },
          gap: '1.5rem',
          aspectRatio: '1 / 1',
        },
        card: {},
        header: {},
      },
    },
  };
}

/**
 * Format error response
 */
export function errorResponse(
  message: string,
  status: number = 500,
  details?: any
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      details,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, CF-Access-JWT-Assertion',
      },
    }
  );
}

/**
 * Format success response
 */
export function successResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, CF-Access-JWT-Assertion',
    },
  });
}

/**
 * Generate cache key for ShipTrack theme
 */
export function getShipTrackThemeCacheKey(organizationId: string): string {
  return `shiptrack:theme:${organizationId}:v1`;
}

/**
 * Deep merge two objects (for theme customization)
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const output = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(
        output[key] || {},
        source[key] as any
      ) as T[Extract<keyof T, string>];
    } else if (source[key] !== undefined) {
      output[key] = source[key] as T[Extract<keyof T, string>];
    }
  }

  return output;
}

