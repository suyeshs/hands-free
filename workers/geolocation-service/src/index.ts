/**
 * Geolocation Service Worker
 * Provides accurate geolocation data using Cloudflare's edge network
 * Can be used by all apps in the platform
 */

export interface Env {
  // Add any environment variables here if needed
}

// CORS headers for cross-origin requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'Geolocation Service',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }),
        { headers: CORS_HEADERS }
      );
    }

    // Main geolocation endpoint
    if (url.pathname === '/api/geo') {
      try {
        // Cloudflare provides geolocation data in the cf object
        const cf = request.cf as {
          country?: string;
          city?: string;
          region?: string;
          regionCode?: string;
          postalCode?: string;
          latitude?: string;
          longitude?: string;
          timezone?: string;
          continent?: string;
          asn?: number;
          colo?: string;
        };

        console.log('[Geo API] Request from:', {
          country: cf?.country,
          city: cf?.city,
          region: cf?.region,
          postalCode: cf?.postalCode,
        });

        // Return geolocation data
        const geoData = {
          country: cf?.country || '',
          city: cf?.city || '',
          region: cf?.region || '',
          regionCode: cf?.regionCode || '',
          postalCode: cf?.postalCode || '',
          latitude: cf?.latitude || '',
          longitude: cf?.longitude || '',
          timezone: cf?.timezone || 'UTC',
          continent: cf?.continent || '',
          // Additional metadata
          metadata: {
            asn: cf?.asn || 0,
            colo: cf?.colo || '',
            timestamp: new Date().toISOString(),
          },
        };

        return new Response(JSON.stringify(geoData), {
          headers: CORS_HEADERS,
        });
      } catch (error: any) {
        console.error('[Geo API] Error:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to get geolocation data',
            message: error?.message || 'Unknown error',
          }),
          {
            status: 500,
            headers: CORS_HEADERS,
          }
        );
      }
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({
        error: 'Not Found',
        message: `Route ${url.pathname} not found`,
        availableRoutes: ['/health', '/api/geo'],
      }),
      {
        status: 404,
        headers: CORS_HEADERS,
      }
    );
  },
};
