/**
 * Theme Edge Worker - Cloudflare Workers
 * Serves themes with edge caching, validation, and multi-tier fallback
 */

import { Env, ThemeJSON, ThemeUpdateMessage } from './types';
import { ThemeDurableObject } from './durable-object';
import { validateTheme } from './schema';
import {
  signTheme,
  verifyAccessJWT,
  verifyTurnstile,
  logThemeAccess,
  purgeThemeCache,
  getThemeCacheKey,
  getDefaultTheme,
  errorResponse,
  successResponse,
  getShipTrackThemeCacheKey,
  deepMerge,
} from './utils';
import { ShipTrackTheme } from './shiptrack-types';
import { getDefaultShipTrackTheme } from './shiptrack-theme';
import { validateShipTrackTheme } from './shiptrack-schema';
import { FigmaTokenExtractor } from './figma-extractor';
import { FigmaTokenMapper } from './figma-mapper';
import { extractFileKeyFromURL } from './figma-client';
import type { FigmaExtractRequest, FigmaImportRequest, TokenMapping } from './figma-types';
import { createThemeGenerator } from './ai/theme-generator';
import type {
  AIThemeGenerationRequest,
  AIDesignRefinementRequest,
  AIAccessibilityAuditRequest,
  AIStyleSuggestionRequest,
  AIComponentGenerationRequest,
} from './ai/grok-types';
import { createNeumorphicGenerator } from './ai/neumorphic-generator';
import type {
  ComponentGenerationRequest,
  LibraryGenerationRequest,
  LayoutGenerationRequest,
  ExportConfig,
} from './neumorphic/types';
import { getAllPrimitives } from './neumorphic/primitives';
import { ThemeSession } from './durable-objects/ThemeSession';
// TEMP: Commented out due to build issue with @stonepot/realtime-collab/server resolution
// import { ThemeCollabSession } from './durable-objects/ThemeCollabSession';
import { ConversationSession } from './durable-objects/ConversationSession';
import { ActiveOrderSession } from './durable-objects/ActiveOrderSession';
import { handleVoiceConfigAPI } from './voice-config-api';
import { handleMultimodalRestaurantAPI } from './multimodal-restaurant/api-handlers';
import { handleGrabFoodAPI } from './grab-food/api-handlers';
import { handleLegalPageUI } from './legal-pages';

// TEMP: Stub class for ThemeCollabSession to maintain DO binding during deploy
export class ThemeCollabSession {
  constructor(private state: DurableObjectState, private env: Env) {}
  async fetch(request: Request): Promise<Response> {
    return new Response('ThemeCollabSession temporarily unavailable', { status: 503 });
  }
}

export { ThemeDurableObject, ThemeSession, ConversationSession, ActiveOrderSession };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      // CORS headers for API requests
      if (request.method === 'OPTIONS') {
        return handleCORS();
      }

      // Route: /cdn/themes/{tenantId}.json - Theme serving
      if (url.pathname.startsWith('/cdn/themes/')) {
        return handleThemeRequest(request, env, ctx);
      }

      // Route: /api/shiptrack/theme/* - ShipTrack theme API
      if (url.pathname.startsWith('/api/shiptrack/theme')) {
        return handleShipTrackAPI(request, env, ctx);
      }

      // Route: /api/themes/* - Theme management API
      if (url.pathname.startsWith('/api/themes')) {
        return handleThemeAPI(request, env, ctx);
      }

      // Route: /api/figma/* - Figma import API
      if (url.pathname.startsWith('/api/figma')) {
        return handleFigmaAPI(request, env, ctx);
      }

      // Route: /api/ai/* - AI theme generation API
      if (url.pathname.startsWith('/api/ai')) {
        return handleAIAPI(request, env, ctx);
      }

      // Route: /api/conversation/display - Canvas display WebSocket
      if (url.pathname === '/api/conversation/display') {
        return handleCanvasDisplayWebSocket(request, env);
      }

      // Route: /api/neumorphic/* - Neumorphic component generation API
      if (url.pathname.startsWith('/api/neumorphic')) {
        return handleNeumorphicAPI(request, env, ctx);
      }

      // Route: /api/voice-config/* - Voice AI configuration API
      if (url.pathname.startsWith('/api/voice-config')) {
        return handleVoiceConfigAPI(request, env);
      }

      // Route: /api/multimodal-restaurant/* - Multimodal Restaurant theme API
      if (url.pathname.startsWith('/api/multimodal-restaurant')) {
        return handleMultimodalRestaurantAPI(request, url.pathname);
      }

      // Route: /api/grab-food/* - Grab Food theme API
      if (url.pathname.startsWith('/api/grab-food')) {
        return handleGrabFoodAPI(request, url.pathname, env);
      }

      // Route: /session/:id/display - Display WebSocket (forwards to ConversationSession)
      if (url.pathname.match(/^\/session\/[^\/]+\/display$/)) {
        return handleSessionDisplayRequest(request, env);
      }

      // Route: /session/:id - Real-time theme collaboration WebSocket
      if (url.pathname.match(/^\/session\/[^\/]+$/)) {
        return handleThemeSessionRequest(request, env);
      }

      // Route: /ui/conversation - Serve themed conversation UI
      if (url.pathname.startsWith('/ui/conversation')) {
        return handleConversationUI(request, env);
      }

      // Routes: /ui/privacy | /ui/terms | /ui/cookies - Tenant-branded legal pages
      if (url.pathname === '/ui/privacy') {
        return handleLegalPageUI(request, env, 'privacy');
      }
      if (url.pathname === '/ui/terms') {
        return handleLegalPageUI(request, env, 'terms');
      }
      if (url.pathname === '/ui/cookies') {
        return handleLegalPageUI(request, env, 'cookies');
      }

      // Route: /conversation/:id/* - Conversation session API/WebSocket
      if (url.pathname.match(/^\/conversation\/[^\/]+/)) {
        return handleConversationSession(request, env);
      }

      // Route: /health - Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(
        'Internal Server Error',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  },
};

/**
 * Handle CORS preflight requests
 */
function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, CF-Access-JWT-Assertion',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Handle theme requests with edge caching
 */
async function handleThemeRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const tenantId = url.pathname.split('/').pop()?.replace('.json', '');

  if (!tenantId) {
    return errorResponse('Invalid tenant ID', 400);
  }

  // Try Cloudflare CDN cache first (L0)
  const cache = caches.default;
  let cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const latency = Date.now() - startTime;
    ctx.waitUntil(logThemeAccess(tenantId, 'hit', latency, env, ctx));

    // Clone and add cache hit headers
    cachedResponse = new Response(cachedResponse.body, cachedResponse);
    cachedResponse.headers.set('X-Cache', 'HIT');
    cachedResponse.headers.set('X-Cache-Tier', 'cdn');
    cachedResponse.headers.set('X-Cache-Latency', `${latency}ms`);

    return cachedResponse;
  }

  // Cache miss - fetch from multi-tier storage
  const theme = await fetchThemeWithFallback(tenantId, env, ctx);

  if (!theme) {
    return errorResponse('Theme not found', 404);
  }

  const latency = Date.now() - startTime;
  ctx.waitUntil(logThemeAccess(tenantId, 'miss', latency, env, ctx));

  // Create response with aggressive caching
  const response = new Response(JSON.stringify(theme), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'CDN-Cache-Control': 'max-age=86400',
      'Cloudflare-CDN-Cache-Control': 'max-age=86400',
      'X-Cache': 'MISS',
      'X-Cache-Tier': 'origin',
      'X-Cache-Latency': `${latency}ms`,
      // Cache tags for granular purging
      'Cache-Tag': `theme-${tenantId}, tenant-${tenantId}, themes-all`,
      'Vary': 'Accept-Encoding',
      'Access-Control-Allow-Origin': '*',
    },
  });

  // Store in Cloudflare CDN cache (non-blocking)
  ctx.waitUntil(cache.put(request, response.clone()));

  return response;
}

/**
 * Fetch theme with multi-tier fallback strategy
 */
async function fetchThemeWithFallback(
  tenantId: string,
  env: Env,
  ctx: ExecutionContext
): Promise<ThemeJSON | null> {
  const cacheKey = getThemeCacheKey(tenantId);

  try {
    // L1: KV Namespace (ultra-fast, globally distributed)
    const kvTheme = await env.THEME_KV.get(cacheKey, { type: 'json' });
    if (kvTheme) {
      console.log(`Theme found in KV for tenant: ${tenantId}`);
      return kvTheme as ThemeJSON;
    }

    // L2: Durable Object (coordinated state)
    try {
      const doId = env.THEME_DO.idFromName(tenantId);
      const doStub = env.THEME_DO.get(doId);
      const doResponse = await doStub.fetch('https://do/theme');

      if (doResponse.ok) {
        const theme = await doResponse.json() as ThemeJSON;
        console.log(`Theme found in DO for tenant: ${tenantId}`);

        // Backfill KV cache (non-blocking)
        ctx.waitUntil(
          env.THEME_KV.put(cacheKey, JSON.stringify(theme), {
            expirationTtl: 86400, // 24 hours
          })
        );

        return theme;
      }
    } catch (doError) {
      console.error('Durable Object fetch failed:', doError);
      // Continue to next tier
    }

    // L3: D1 Database (source of truth)
    const dbResult = await env.THEME_DB.prepare(`
      SELECT theme_json, signature
      FROM tenant_themes
      WHERE tenant_id = ? AND is_active = 1
      LIMIT 1
    `).bind(tenantId).first();

    if (dbResult && dbResult.theme_json) {
      const theme = JSON.parse(dbResult.theme_json as string) as ThemeJSON;
      console.log(`Theme found in D1 for tenant: ${tenantId}`);

      // Backfill both KV and DO caches (non-blocking)
      ctx.waitUntil(
        Promise.all([
          env.THEME_KV.put(cacheKey, JSON.stringify(theme), {
            expirationTtl: 86400,
          }),
          (async () => {
            try {
              const doId = env.THEME_DO.idFromName(tenantId);
              const doStub = env.THEME_DO.get(doId);
              await doStub.fetch('https://do/theme', {
                method: 'PUT',
                body: JSON.stringify(theme),
              });
            } catch (error) {
              console.error('Failed to backfill DO:', error);
            }
          })(),
        ])
      );

      return theme;
    }

    // No theme found in any tier - return default
    console.log(`No theme found for tenant: ${tenantId}, using default`);
    return getDefaultTheme();

  } catch (error) {
    console.error('Theme fetch error:', error);
    // Return default theme on any error
    return getDefaultTheme();
  }
}

/**
 * Handle theme management API
 */
async function handleThemeAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // Verify authentication for write operations
  if (['PUT', 'POST', 'DELETE'].includes(method)) {
    const authResult = await verifyAccessJWT(request, env);
    if (!authResult.valid) {
      return errorResponse('Unauthorized', 401, authResult.error);
    }
  }

  // Route: GET /api/themes/:tenantId
  if (method === 'GET' && url.pathname.match(/^\/api\/themes\/[^\/]+$/)) {
    return handleGetTheme(request, env);
  }

  // Route: PUT /api/themes/:tenantId
  if (method === 'PUT' && url.pathname.match(/^\/api\/themes\/[^\/]+$/)) {
    return handleUpdateTheme(request, env, ctx);
  }

  // Route: DELETE /api/themes/:tenantId/cache
  if (method === 'DELETE' && url.pathname.match(/^\/api\/themes\/[^\/]+\/cache$/)) {
    return handlePurgeCache(request, env);
  }

  // Route: GET /api/themes/templates
  if (method === 'GET' && url.pathname === '/api/themes/templates') {
    return handleGetTemplates(request, env);
  }

  return errorResponse('Method not allowed', 405);
}

/**
 * Get theme via API
 */
async function handleGetTheme(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.pathname.split('/').pop();

  if (!tenantId) {
    return errorResponse('Invalid tenant ID', 400);
  }

  const theme = await fetchThemeWithFallback(tenantId, env, {} as ExecutionContext);

  if (!theme) {
    return errorResponse('Theme not found', 404);
  }

  return successResponse(theme);
}

/**
 * Update theme with validation at edge
 */
async function handleUpdateTheme(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.pathname.split('/').pop();

  if (!tenantId) {
    return errorResponse('Invalid tenant ID', 400);
  }

  let themeData: any;
  try {
    themeData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  // Edge validation with Zod
  const validation = validateTheme(themeData);

  if (!validation.valid) {
    return errorResponse('Validation failed', 400, {
      errors: validation.errors,
    });
  }

  const theme = validation.data!;

  // Sign theme with WebCrypto for integrity (if signing key is available)
  let signature: string | undefined = undefined;
  if (env.SIGNING_KEY) {
    signature = await signTheme(theme, env.SIGNING_KEY);
    theme.signature = signature;
  }

  // Write to D1 (source of truth)
  try {
    await env.THEME_DB.prepare(`
      INSERT INTO tenant_themes (tenant_id, theme_json, version, signature, updated_at)
      VALUES (?, ?, ?, ?, unixepoch())
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        theme_json = EXCLUDED.theme_json,
        version = EXCLUDED.version,
        signature = EXCLUDED.signature,
        updated_at = unixepoch()
    `).bind(
      tenantId,
      JSON.stringify(theme),
      theme.version,
      signature || null
    ).run();

    // Queue async cache invalidation
    ctx.waitUntil(invalidateAllCaches(tenantId, env));

    // Send update message to queue for downstream processing
    ctx.waitUntil(
      env.THEME_QUEUE.send({
        tenantId,
        action: 'update',
        timestamp: Date.now(),
      } as ThemeUpdateMessage)
    );

    return successResponse({
      success: true,
      tenantId,
      version: theme.version,
      signature,
    });

  } catch (error) {
    console.error('Database write error:', error);
    return errorResponse('Failed to save theme', 500, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Purge theme cache
 */
async function handlePurgeCache(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const tenantId = pathParts[pathParts.length - 2];

  if (!tenantId) {
    return errorResponse('Invalid tenant ID', 400);
  }

  await invalidateAllCaches(tenantId, env);

  return successResponse({
    success: true,
    message: 'Cache purged successfully',
    tenantId,
  });
}

/**
 * Get theme templates (marketplace)
 */
async function handleGetTemplates(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  try {
    let query = `
      SELECT id, name, description, category, preview_url, rating, downloads
      FROM theme_templates
      WHERE is_public = 1
    `;

    const params: string[] = [];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY downloads DESC LIMIT 50`;

    const stmt = env.THEME_DB.prepare(query);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    return successResponse({
      templates: result.results,
      total: result.results.length,
    });

  } catch (error) {
    console.error('Template fetch error:', error);
    return errorResponse('Failed to fetch templates', 500);
  }
}

/**
 * Invalidate all cache tiers for a tenant
 */
async function invalidateAllCaches(tenantId: string, env: Env): Promise<void> {
  const cacheKey = getThemeCacheKey(tenantId);

  await Promise.allSettled([
    // Clear KV
    env.THEME_KV.delete(cacheKey),

    // Clear Durable Object
    (async () => {
      try {
        const doId = env.THEME_DO.idFromName(tenantId);
        const doStub = env.THEME_DO.get(doId);
        await doStub.fetch('https://do/theme', { method: 'DELETE' });
      } catch (error) {
        console.error('Failed to clear DO cache:', error);
      }
    })(),

    // Purge CDN cache
    purgeThemeCache(tenantId, env),
  ]);

  console.log(`Invalidated all caches for tenant: ${tenantId}`);
}

/**
 * Handle ShipTrack theme API
 */
async function handleShipTrackAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // Verify authentication for write operations
  if (['PUT', 'POST', 'DELETE'].includes(method)) {
    const authResult = await verifyAccessJWT(request, env);
    if (!authResult.valid) {
      return errorResponse('Unauthorized', 401, authResult.error);
    }
  }

  // Route: GET /api/shiptrack/theme/:organizationId
  if (method === 'GET' && url.pathname.match(/^\/api\/shiptrack\/theme\/[^\/]+$/)) {
    return handleGetShipTrackTheme(request, env, ctx);
  }

  // Route: PUT /api/shiptrack/theme/:organizationId
  if (method === 'PUT' && url.pathname.match(/^\/api\/shiptrack\/theme\/[^\/]+$/)) {
    return handleUpdateShipTrackTheme(request, env, ctx);
  }

  // Route: DELETE /api/shiptrack/theme/:organizationId/cache
  if (method === 'DELETE' && url.pathname.match(/^\/api\/shiptrack\/theme\/[^\/]+\/cache$/)) {
    return handlePurgeShipTrackCache(request, env);
  }

  return errorResponse('Method not allowed', 405);
}

/**
 * Get ShipTrack theme for an organization
 */
async function handleGetShipTrackTheme(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const organizationId = url.pathname.split('/').pop();

  if (!organizationId) {
    return errorResponse('Invalid organization ID', 400);
  }

  const theme = await fetchShipTrackThemeWithFallback(organizationId, env, ctx);
  const latency = Date.now() - startTime;

  // Log access for analytics
  ctx.waitUntil(logThemeAccess(organizationId, 'miss', latency, env, ctx));

  return new Response(JSON.stringify(theme), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'CDN-Cache-Control': 'max-age=86400',
      'X-Cache': 'MISS',
      'X-Cache-Tier': 'origin',
      'X-Cache-Latency': `${latency}ms`,
      'Cache-Tag': `shiptrack-theme-${organizationId}, shiptrack-org-${organizationId}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Update ShipTrack theme for an organization
 */
async function handleUpdateShipTrackTheme(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const organizationId = url.pathname.split('/').pop();

  if (!organizationId) {
    return errorResponse('Invalid organization ID', 400);
  }

  let themeData: any;
  try {
    themeData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  // Edge validation with Zod
  const validation = validateShipTrackTheme(themeData);

  if (!validation.valid) {
    return errorResponse('Validation failed', 400, {
      errors: validation.errors,
    });
  }

  const theme = validation.data!;

  // Sign theme with WebCrypto for integrity (if signing key is available)
  let signature: string | undefined = undefined;
  if (env.SIGNING_KEY) {
    signature = await signTheme(theme as any, env.SIGNING_KEY);
    theme.signature = signature;
  }

  // Write to D1 (source of truth)
  try {
    await env.THEME_DB.prepare(`
      INSERT INTO shiptrack_themes (organization_id, theme_json, version, signature, updated_at)
      VALUES (?, ?, ?, ?, unixepoch())
      ON CONFLICT (organization_id)
      DO UPDATE SET
        theme_json = EXCLUDED.theme_json,
        version = EXCLUDED.version,
        signature = EXCLUDED.signature,
        updated_at = unixepoch()
    `).bind(
      organizationId,
      JSON.stringify(theme),
      theme.version,
      signature || null
    ).run();

    // Queue async cache invalidation
    ctx.waitUntil(invalidateShipTrackCaches(organizationId, env));

    return successResponse({
      success: true,
      organizationId,
      version: theme.version,
      signature,
    });

  } catch (error) {
    console.error('Database write error:', error);
    return errorResponse('Failed to save theme', 500, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Purge ShipTrack theme cache
 */
async function handlePurgeShipTrackCache(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const organizationId = pathParts[pathParts.length - 2];

  if (!organizationId) {
    return errorResponse('Invalid organization ID', 400);
  }

  await invalidateShipTrackCaches(organizationId, env);

  return successResponse({
    success: true,
    message: 'ShipTrack theme cache purged successfully',
    organizationId,
  });
}

/**
 * Fetch ShipTrack theme with multi-tier fallback
 */
async function fetchShipTrackThemeWithFallback(
  organizationId: string,
  env: Env,
  ctx: ExecutionContext
): Promise<ShipTrackTheme> {
  const cacheKey = getShipTrackThemeCacheKey(organizationId);

  try {
    // L1: KV Namespace (ultra-fast, globally distributed)
    const kvTheme = await env.THEME_KV.get(cacheKey, { type: 'json' });
    if (kvTheme) {
      console.log(`ShipTrack theme found in KV for org: ${organizationId}`);
      return kvTheme as ShipTrackTheme;
    }

    // L2: D1 Database (source of truth)
    const dbResult = await env.THEME_DB.prepare(`
      SELECT theme_json, signature
      FROM shiptrack_themes
      WHERE organization_id = ?
      LIMIT 1
    `).bind(organizationId).first();

    if (dbResult && dbResult.theme_json) {
      const theme = JSON.parse(dbResult.theme_json as string) as ShipTrackTheme;
      console.log(`ShipTrack theme found in D1 for org: ${organizationId}`);

      // Backfill KV cache (non-blocking)
      ctx.waitUntil(
        env.THEME_KV.put(cacheKey, JSON.stringify(theme), {
          expirationTtl: 86400, // 24 hours
        })
      );

      return theme;
    }

    // No theme found - return default
    console.log(`No custom theme found for org: ${organizationId}, using default`);
    return getDefaultShipTrackTheme();

  } catch (error) {
    console.error('ShipTrack theme fetch error:', error);
    // Return default theme on any error
    return getDefaultShipTrackTheme();
  }
}

/**
 * Invalidate all ShipTrack cache tiers for an organization
 */
async function invalidateShipTrackCaches(organizationId: string, env: Env): Promise<void> {
  const cacheKey = getShipTrackThemeCacheKey(organizationId);

  await Promise.allSettled([
    // Clear KV
    env.THEME_KV.delete(cacheKey),

    // Purge CDN cache (if applicable)
    (async () => {
      if (env.ZONE_ID && env.CACHE_PURGE_TOKEN) {
        try {
          await fetch(
            `https://api.cloudflare.com/client/v4/zones/${env.ZONE_ID}/purge_cache`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.CACHE_PURGE_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                tags: [`shiptrack-theme-${organizationId}`, `shiptrack-org-${organizationId}`],
              }),
            }
          );
        } catch (error) {
          console.error('Failed to purge CDN cache:', error);
        }
      }
    })(),
  ]);

  console.log(`Invalidated all ShipTrack caches for org: ${organizationId}`);
}

/**
 * Handle Figma import API
 */
async function handleFigmaAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // Figma endpoints - no Cloudflare Access auth required (secured by Figma token)

  // Route: POST /api/figma/validate - Validate Figma access token
  if (method === 'POST' && url.pathname === '/api/figma/validate') {
    return handleFigmaValidate(request, env);
  }

  // Route: POST /api/figma/extract - Extract design tokens
  if (method === 'POST' && url.pathname === '/api/figma/extract') {
    return handleFigmaExtract(request, env, ctx);
  }

  // Route: POST /api/figma/import - Import and generate theme
  if (method === 'POST' && url.pathname === '/api/figma/import') {
    return handleFigmaImport(request, env, ctx);
  }

  return errorResponse('Method not allowed', 405);
}

/**
 * Extract design tokens from Figma file
 */
async function handleFigmaExtract(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  let requestData: FigmaExtractRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { fileUrl, fileKey, accessToken } = requestData;

  if (!accessToken) {
    return errorResponse('Figma access token is required', 400);
  }

  // Extract file key from URL if provided
  let resolvedFileKey = fileKey;
  if (fileUrl && !fileKey) {
    const extracted = extractFileKeyFromURL(fileUrl);
    if (!extracted) {
      return errorResponse('Invalid Figma file URL', 400);
    }
    resolvedFileKey = extracted;
  }

  if (!resolvedFileKey) {
    return errorResponse('Figma file key or URL is required', 400);
  }

  // Check KV cache first
  const cacheKey = `figma:extract:${resolvedFileKey}`;
  const cached = await env.THEME_KV.get(cacheKey, { type: 'json' });

  if (cached && requestData.useCache !== false) {
    console.log(`Figma tokens found in cache for file: ${resolvedFileKey}`);
    return successResponse({
      tokens: cached,
      cached: true,
    });
  }

  // Extract tokens from Figma
  try {
    const extractor = new FigmaTokenExtractor(accessToken);
    const tokens = await extractor.extractTokens(resolvedFileKey);

    // Cache the extracted tokens (24 hours)
    ctx.waitUntil(
      env.THEME_KV.put(cacheKey, JSON.stringify(tokens), {
        expirationTtl: 86400,
      })
    );

    return successResponse({
      tokens,
      cached: false,
    });
  } catch (error) {
    console.error('Figma extraction error:', error);
    return errorResponse(
      'Failed to extract tokens from Figma',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Import Figma tokens and generate complete theme
 */
async function handleFigmaImport(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  let requestData: FigmaImportRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { fileUrl, fileKey, accessToken, platform, mapping, baseMeta } = requestData;

  if (!accessToken) {
    return errorResponse('Figma access token is required', 400);
  }

  if (!platform || (platform !== 'web' && platform !== 'shiptrack')) {
    return errorResponse('Valid platform (web or shiptrack) is required', 400);
  }

  // Extract file key from URL if provided
  let resolvedFileKey = fileKey;
  if (fileUrl && !fileKey) {
    const extracted = extractFileKeyFromURL(fileUrl);
    if (!extracted) {
      return errorResponse('Invalid Figma file URL', 400);
    }
    resolvedFileKey = extracted;
  }

  if (!resolvedFileKey) {
    return errorResponse('Figma file key or URL is required', 400);
  }

  // Extract tokens (with caching)
  try {
    const extractor = new FigmaTokenExtractor(accessToken);
    const tokens = await extractor.extractTokens(resolvedFileKey);

    // Map to theme format
    const mapper = new FigmaTokenMapper();
    let theme;

    if (platform === 'web') {
      theme = mapper.mapToWebTheme(tokens, mapping, baseMeta);
    } else {
      theme = mapper.mapToShipTrackTheme(tokens, mapping, baseMeta);
    }

    // Generate auto-mapping suggestion
    const suggestedMapping = mapper.suggestMapping(tokens);

    return successResponse({
      theme,
      tokens,
      suggestedMapping,
    });
  } catch (error) {
    console.error('Figma import error:', error);
    return errorResponse(
      'Failed to import theme from Figma',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Validate Figma access token
 */
async function handleFigmaValidate(
  request: Request,
  env: Env
): Promise<Response> {
  let requestData: { accessToken: string };

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { accessToken } = requestData;

  if (!accessToken) {
    return errorResponse('Figma access token is required', 400);
  }

  try {
    // Try to fetch user info from Figma API
    const response = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'X-Figma-Token': accessToken,
      },
    });

    if (response.ok) {
      const data: any = await response.json();
      return successResponse({
        valid: true,
        user: {
          id: data.id,
          email: data.email,
          handle: data.handle,
        },
      });
    } else {
      return successResponse({
        valid: false,
        error: 'Invalid or expired Figma access token',
      });
    }
  } catch (error) {
    console.error('Figma validation error:', error);
    return errorResponse(
      'Failed to validate Figma token',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Handle AI API (Grok-powered design generation)
 */
async function handleAIAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // AI endpoints - no authentication required (can be added later if needed)

  // Route: POST /api/ai/generate - Generate theme from prompt
  if (method === 'POST' && url.pathname === '/api/ai/generate') {
    return handleAIGenerateTheme(request, env);
  }

  // Route: POST /api/ai/refine - Refine existing theme
  if (method === 'POST' && url.pathname === '/api/ai/refine') {
    return handleAIRefineTheme(request, env);
  }

  // Route: POST /api/ai/audit - Accessibility audit
  if (method === 'POST' && url.pathname === '/api/ai/audit') {
    return handleAIAccessibilityAudit(request, env);
  }

  // Route: POST /api/ai/suggest - Style suggestions
  if (method === 'POST' && url.pathname === '/api/ai/suggest') {
    return handleAIStyleSuggestions(request, env);
  }

  // Route: POST /api/ai/component - Generate component
  if (method === 'POST' && url.pathname === '/api/ai/component') {
    return handleAIGenerateComponent(request, env);
  }

  // Route: POST /api/ai/validate - Validate Grok API key
  if (method === 'POST' && url.pathname === '/api/ai/validate') {
    return handleAIValidateKey(request, env);
  }

  return errorResponse('Method not allowed', 405);
}

/**
 * Generate theme from natural language prompt
 */
async function handleAIGenerateTheme(
  request: Request,
  env: Env
): Promise<Response> {
  let requestData: AIThemeGenerationRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { prompt, platform } = requestData;

  if (!prompt) {
    return errorResponse('Prompt is required', 400);
  }

  if (!platform || (platform !== 'web' && platform !== 'shiptrack')) {
    return errorResponse('Valid platform (web or shiptrack) is required', 400);
  }

  try {
    const generator = createThemeGenerator(env);
    const result = await generator.generateTheme(requestData);

    return successResponse(result);
  } catch (error) {
    console.error('AI theme generation error:', error);
    return errorResponse(
      'Failed to generate theme',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Refine existing theme based on feedback
 */
async function handleAIRefineTheme(
  request: Request,
  env: Env
): Promise<Response> {
  let requestData: AIDesignRefinementRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { currentTheme, refinementPrompt, platform } = requestData;

  if (!currentTheme) {
    return errorResponse('Current theme is required', 400);
  }

  if (!refinementPrompt) {
    return errorResponse('Refinement prompt is required', 400);
  }

  if (!platform || (platform !== 'web' && platform !== 'shiptrack')) {
    return errorResponse('Valid platform (web or shiptrack) is required', 400);
  }

  try {
    const generator = createThemeGenerator(env);
    const result = await generator.refineTheme(requestData);

    return successResponse(result);
  } catch (error) {
    console.error('AI theme refinement error:', error);
    return errorResponse(
      'Failed to refine theme',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Perform accessibility audit on theme
 */
async function handleAIAccessibilityAudit(
  request: Request,
  env: Env
): Promise<Response> {
  let requestData: AIAccessibilityAuditRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { theme, platform } = requestData;

  if (!theme) {
    return errorResponse('Theme is required', 400);
  }

  if (!platform || (platform !== 'web' && platform !== 'shiptrack')) {
    return errorResponse('Valid platform (web or shiptrack) is required', 400);
  }

  try {
    const generator = createThemeGenerator(env);
    const result = await generator.auditAccessibility(requestData);

    return successResponse(result);
  } catch (error) {
    console.error('AI accessibility audit error:', error);
    return errorResponse(
      'Failed to audit accessibility',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Get style suggestions based on brand info
 */
async function handleAIStyleSuggestions(
  request: Request,
  env: Env
): Promise<Response> {
  let requestData: AIStyleSuggestionRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { platform } = requestData;

  if (!platform || (platform !== 'web' && platform !== 'shiptrack')) {
    return errorResponse('Valid platform (web or shiptrack) is required', 400);
  }

  try {
    const generator = createThemeGenerator(env);
    const result = await generator.suggestStyles(requestData);

    return successResponse(result);
  } catch (error) {
    console.error('AI style suggestions error:', error);
    return errorResponse(
      'Failed to get style suggestions',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Generate component configuration
 */
async function handleAIGenerateComponent(
  request: Request,
  env: Env
): Promise<Response> {
  let requestData: AIComponentGenerationRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { componentType, description, platform } = requestData;

  if (!componentType) {
    return errorResponse('Component type is required', 400);
  }

  if (!description) {
    return errorResponse('Description is required', 400);
  }

  if (!platform || (platform !== 'web' && platform !== 'shiptrack')) {
    return errorResponse('Valid platform (web or shiptrack) is required', 400);
  }

  try {
    const generator = createThemeGenerator(env);
    const result = await generator.generateComponent(requestData);

    return successResponse(result);
  } catch (error) {
    console.error('AI component generation error:', error);
    return errorResponse(
      'Failed to generate component',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Validate Grok API key
 */
async function handleAIValidateKey(
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.GROK_API_KEY) {
    return successResponse({
      valid: false,
      error: 'Grok API key is not configured',
    });
  }

  try {
    const generator = createThemeGenerator(env);
    // Try a simple completion to validate the key
    const isValid = await generator.validateAPIKey();

    return successResponse({
      valid: isValid,
      error: isValid ? undefined : 'Invalid Grok API key',
    });
  } catch (error) {
    console.error('Grok API key validation error:', error);
    return successResponse({
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle Neumorphic API (Dynamic component generation)
 */
async function handleNeumorphicAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // Neumorphic endpoints - no authentication required (can be added later)

  // Route: POST /api/neumorphic/generate - Generate single component
  if (method === 'POST' && url.pathname === '/api/neumorphic/generate') {
    return handleNeumorphicGenerate(request, env);
  }

  // Route: POST /api/neumorphic/library - Generate component library
  if (method === 'POST' && url.pathname === '/api/neumorphic/library') {
    return handleNeumorphicLibrary(request, env);
  }

  // Route: POST /api/neumorphic/layout - Generate screen layout
  if (method === 'POST' && url.pathname === '/api/neumorphic/layout') {
    return handleNeumorphicLayout(request, env);
  }

  // Route: POST /api/neumorphic/refine - Refine component
  if (method === 'POST' && url.pathname === '/api/neumorphic/refine') {
    return handleNeumorphicRefine(request, env);
  }

  // Route: POST /api/neumorphic/export - Export to code
  if (method === 'POST' && url.pathname === '/api/neumorphic/export') {
    return handleNeumorphicExport(request, env);
  }

  // Route: GET /api/neumorphic/primitives - List primitives
  if (method === 'GET' && url.pathname === '/api/neumorphic/primitives') {
    return handleNeumorphicPrimitives();
  }

  // Route: POST /api/neumorphic/primitive - Get specific primitive
  if (method === 'POST' && url.pathname === '/api/neumorphic/primitive') {
    return handleNeumorphicGetPrimitive(request, env);
  }

  return errorResponse('Method not allowed', 405);
}

/**
 * Generate single neumorphic component
 */
async function handleNeumorphicGenerate(request: Request, env: Env): Promise<Response> {
  let requestData: ComponentGenerationRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { prompt, platform } = requestData;

  if (!prompt) {
    return errorResponse('Prompt is required', 400);
  }

  if (!platform || (platform !== 'web' && platform !== 'mobile' && platform !== 'both')) {
    return errorResponse('Valid platform (web, mobile, or both) is required', 400);
  }

  try {
    const generator = createNeumorphicGenerator(env);
    const result = await generator.generateComponent(requestData);

    return successResponse(result);
  } catch (error) {
    console.error('Neumorphic generation error:', error);
    return errorResponse(
      'Failed to generate component',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Generate component library
 */
async function handleNeumorphicLibrary(request: Request, env: Env): Promise<Response> {
  let requestData: LibraryGenerationRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { prompt, platform } = requestData;

  if (!prompt) {
    return errorResponse('Prompt is required', 400);
  }

  if (!platform || (platform !== 'web' && platform !== 'mobile' && platform !== 'both')) {
    return errorResponse('Valid platform is required', 400);
  }

  try {
    const generator = createNeumorphicGenerator(env);
    const result = await generator.generateLibrary(requestData);

    return successResponse(result);
  } catch (error) {
    console.error('Library generation error:', error);
    return errorResponse(
      'Failed to generate library',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Generate screen layout
 */
async function handleNeumorphicLayout(request: Request, env: Env): Promise<Response> {
  let requestData: LayoutGenerationRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { prompt, platform } = requestData;

  if (!prompt) {
    return errorResponse('Prompt is required', 400);
  }

  if (!platform || (platform !== 'web' && platform !== 'mobile')) {
    return errorResponse('Valid platform (web or mobile) is required', 400);
  }

  try {
    const generator = createNeumorphicGenerator(env);
    const result = await generator.generateLayout(requestData);

    return successResponse(result);
  } catch (error) {
    console.error('Layout generation error:', error);
    return errorResponse(
      'Failed to generate layout',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Refine existing component
 */
async function handleNeumorphicRefine(request: Request, env: Env): Promise<Response> {
  let requestData: { component: any; refinementPrompt: string };

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { component, refinementPrompt } = requestData;

  if (!component) {
    return errorResponse('Component is required', 400);
  }

  if (!refinementPrompt) {
    return errorResponse('Refinement prompt is required', 400);
  }

  try {
    const generator = createNeumorphicGenerator(env);
    const result = await generator.refineComponent(component, refinementPrompt);

    return successResponse(result);
  } catch (error) {
    console.error('Refinement error:', error);
    return errorResponse(
      'Failed to refine component',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Export component to code
 */
async function handleNeumorphicExport(request: Request, env: Env): Promise<Response> {
  let requestData: { component: any; config: ExportConfig };

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { component, config } = requestData;

  if (!component) {
    return errorResponse('Component is required', 400);
  }

  if (!config) {
    return errorResponse('Export config is required', 400);
  }

  try {
    const generator = createNeumorphicGenerator(env);
    const result = await generator.exportToCode(component, config);

    return successResponse(result);
  } catch (error) {
    console.error('Export error:', error);
    return errorResponse(
      'Failed to export component',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * List available primitives
 */
async function handleNeumorphicPrimitives(): Promise<Response> {
  try {
    const primitives = getAllPrimitives();
    return successResponse({ primitives });
  } catch (error) {
    return errorResponse('Failed to list primitives', 500);
  }
}

/**
 * Get specific primitive
 */
async function handleNeumorphicGetPrimitive(request: Request, env: Env): Promise<Response> {
  let requestData: { name: string; options?: any };

  try {
    requestData = await request.json();
  } catch (error) {
    return errorResponse('Invalid JSON', 400);
  }

  const { name, options = {} } = requestData;

  if (!name) {
    return errorResponse('Primitive name is required', 400);
  }

  try {
    const generator = createNeumorphicGenerator(env);
    const primitive = await generator.getPrimitive(name, options);

    return successResponse({ component: primitive });
  } catch (error) {
    console.error('Get primitive error:', error);
    return errorResponse(
      'Failed to get primitive',
      404,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Handle Theme Session Request (Real-time collaboration via WebSocket)
 */
async function handleThemeSessionRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.pathname.split('/')[2];

  if (!sessionId) {
    return errorResponse('Session ID is required', 400);
  }

  // Get or create Durable Object for this session
  const id = env.THEME_SESSION.idFromName(sessionId);
  const stub = env.THEME_SESSION.get(id);

  // Forward request to Durable Object
  return stub.fetch(request);
}

/**
 * Handle Session Display Request (Display WebSocket via ConversationSession)
 */
async function handleSessionDisplayRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.pathname.split('/')[2];

  if (!sessionId) {
    return errorResponse('Session ID is required', 400);
  }

  // Get or create ConversationSession Durable Object for display
  const id = env.CONVERSATION_SESSION.idFromName(sessionId);
  const stub = env.CONVERSATION_SESSION.get(id);

  // Forward request to ConversationSession Durable Object
  // This will handle the /display endpoint internally
  return stub.fetch(request);
}

/**
 * Serve themed conversation UI
 */
async function handleConversationUI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenant') || 'default';
  const category = url.searchParams.get('category') || 'restaurant';
  const sessionId = url.searchParams.get('session') || crypto.randomUUID();

  // Load theme for tenant (fallback to default if not found)
  let theme;
  try {
    const cacheKey = getThemeCacheKey(tenantId);
    theme = await env.THEME_KV.get(cacheKey, { type: 'json' });

    if (!theme && env.DB) {
      // Try D1 database
      const result = await env.DB.prepare('SELECT theme_json FROM themes WHERE tenant_id = ?')
        .bind(tenantId)
        .first();

      if (result) {
        theme = JSON.parse(result.theme_json as string);
      }
    }

    if (!theme) {
      theme = getDefaultTheme();
    }
  } catch (error) {
    console.error('Error loading theme:', error);
    theme = getDefaultTheme();
  }

  // Generate and serve HTML with injected theme and config
  const html = generateConversationHTML(theme, category, tenantId, sessionId, request);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Handle canvas display WebSocket connection
 * Route: /api/conversation/display?tenant={tenantId}&category={category}&session={sessionId}
 */
async function handleCanvasDisplayWebSocket(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session');
  const tenantId = url.searchParams.get('tenant');
  const category = url.searchParams.get('category');

  if (!sessionId) {
    return errorResponse('Session ID is required', 400);
  }

  if (!tenantId) {
    return errorResponse('Tenant ID is required', 400);
  }

  // Get or create ConversationSession Durable Object
  const id = env.CONVERSATION_SESSION.idFromName(sessionId);
  const stub = env.CONVERSATION_SESSION.get(id);

  // Forward WebSocket upgrade request to Durable Object
  // The DO will handle the WebSocket protocol upgrade
  return stub.fetch(request);
}

/**
 * Handle conversation session WebSocket and API requests
 */
async function handleConversationSession(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.pathname.split('/')[2];

  if (!sessionId) {
    return errorResponse('Session ID is required', 400);
  }

  // Get or create ConversationSession Durable Object
  const id = env.CONVERSATION_SESSION.idFromName(sessionId);
  const stub = env.CONVERSATION_SESSION.get(id);

  // Forward request to Durable Object
  return stub.fetch(request);
}

/**
 * Generate conversation HTML with theme injection
 */
function generateConversationHTML(
  theme: any,
  category: string,
  tenantId: string,
  sessionId: string,
  request: Request
): string {
  const workerUrl = new URL(request.url).origin;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${theme.name || 'Stonepot'} - Voice Assistant</title>
  <style>
    :root {
      --primary-color: ${theme.colors?.primary || '#FF6B35'};
      --secondary-color: ${theme.colors?.secondary || '#004E89'};
      --background-color: ${theme.colors?.background || '#FFFFFF'};
      --text-color: ${theme.colors?.text || '#000000'};
      --accent-color: ${theme.colors?.accent || '#F7B801'};
      --font-family: ${theme.typography?.fontFamily || 'system-ui, -apple-system, sans-serif'};
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--font-family);
      background: var(--background-color);
      color: var(--text-color);
      line-height: 1.6;
    }

    .app-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-height: 100vh;
    }

    .branding {
      text-align: center;
      padding: 20px;
    }

    .branding img {
      max-height: 60px;
    }

    .branding h1 {
      color: var(--primary-color);
      font-size: 2rem;
      margin-top: 10px;
    }

    .conversation-panel {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 20px;
      flex: 0 0 250px;
      overflow-y: auto;
    }

    .conversation-panel h2 {
      color: var(--primary-color);
      margin-bottom: 15px;
      font-size: 1.2rem;
    }

    .transcript {
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 8px;
      font-size: 0.95rem;
    }

    .transcript.user {
      background: #e3f2fd;
      text-align: right;
    }

    .transcript.assistant {
      background: #f3e5f5;
    }

    .transcript strong {
      color: var(--primary-color);
    }

    .multimodal-display {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 20px;
      flex: 1;
      min-height: 400px;
    }

    .display-content {
      width: 100%;
    }

    .dish-card, .advice-card {
      border: 2px solid var(--primary-color);
      border-radius: 12px;
      padding: 20px;
      background: white;
    }

    .dish-card img {
      width: 100%;
      max-width: 400px;
      height: auto;
      border-radius: 8px;
      margin-bottom: 15px;
    }

    .dish-card h2, .advice-card h2 {
      color: var(--primary-color);
      margin-bottom: 10px;
    }

    .price {
      color: var(--accent-color);
      font-size: 1.5rem;
      font-weight: bold;
      margin: 10px 0;
    }

    .allergens {
      color: #d32f2f;
      font-size: 0.9rem;
      margin-top: 10px;
    }

    .dietary-tags {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    .tag {
      background: var(--primary-color);
      color: white;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 0.85rem;
    }

    .loading {
      text-align: center;
      color: #666;
      padding: 40px;
    }

    .status {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .status.connected {
      background: #4caf50;
      color: white;
    }

    .status.disconnected {
      background: #f44336;
      color: white;
    }
  </style>
</head>
<body class="category-${category}">
  <div class="status" id="connectionStatus">Connecting...</div>

  <div class="app-container">
    <div class="branding">
      ${theme.logo ? `<img src="${theme.logo}" alt="${theme.name || 'Logo'}" />` : `<h1>${theme.name || 'Stonepot Voice Assistant'}</h1>`}
    </div>

    <div class="conversation-panel">
      <h2>Conversation</h2>
      <div id="transcriptions">
        <p class="loading">Waiting for conversation...</p>
      </div>
    </div>

    <div class="multimodal-display">
      <div id="display-content" class="display-content">
        <p class="loading">Waiting for display content...</p>
      </div>
    </div>
  </div>

  <script>
    // Configuration
    const config = {
      sessionId: '${sessionId}',
      tenantId: '${tenantId}',
      category: '${category}',
      workerUrl: '${workerUrl}',
      theme: ${JSON.stringify(theme)}
    };

    // Conversation Client
    class ConversationClient {
      constructor(config) {
        this.config = config;
        this.ws = null;
        this.transcriptions = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.connect();
      }

      connect() {
        const wsUrl = this.config.workerUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        const url = \`\${wsUrl}/conversation/\${this.config.sessionId}/display?category=\${this.config.category}&tenant=\${this.config.tenantId}\`;

        console.log('Connecting to:', url);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.updateStatus('connected');
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error('Error parsing message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.updateStatus('disconnected');
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.updateStatus('disconnected');
          this.attemptReconnect();
        };
      }

      handleMessage(data) {
        console.log('Received:', data);

        if (data.type === 'initial_state') {
          this.transcriptions = data.state.transcriptions || [];
          this.renderTranscriptions();

          if (data.state.displayUpdates && data.state.displayUpdates.length > 0) {
            const latestDisplay = data.state.displayUpdates[data.state.displayUpdates.length - 1];
            this.updateDisplay(latestDisplay);
          }
        } else if (data.type === 'update') {
          if (data.update.type === 'transcription') {
            this.transcriptions.push(data.update);
            this.renderTranscriptions();
          } else {
            this.updateDisplay(data.update);
          }
        } else if (data.type === 'pong') {
          console.log('Pong received');
        }
      }

      renderTranscriptions() {
        const container = document.getElementById('transcriptions');
        if (this.transcriptions.length === 0) {
          container.innerHTML = '<p class="loading">Waiting for conversation...</p>';
          return;
        }

        container.innerHTML = this.transcriptions.map(t =>
          \`<div class="transcript \${t.speaker}">
            <strong>\${t.speaker}:</strong> \${t.text}
          </div>\`
        ).join('');

        container.scrollTop = container.scrollHeight;
      }

      updateDisplay(update) {
        const container = document.getElementById('display-content');

        switch (update.type) {
          case 'dish_card':
            container.innerHTML = this.renderDishCard(update.displayData.dish);
            break;
          case 'menu_section':
            container.innerHTML = this.renderMenuSection(update.displayData.section);
            break;
          case 'order_summary':
            container.innerHTML = this.renderOrderSummary(update.displayData.order);
            break;
          case 'advice_card':
            container.innerHTML = this.renderAdviceCard(update.displayData);
            break;
          default:
            container.innerHTML = \`<pre>\${JSON.stringify(update, null, 2)}</pre>\`;
        }
      }

      renderDishCard(dish) {
        return \`
          <div class="dish-card">
            \${dish.image ? \`<img src="\${dish.image}" alt="\${dish.name}" />\` : ''}
            <h2>\${dish.name}</h2>
            <p>\${dish.description}</p>
            <div class="price">₹\${dish.price}</div>
            \${dish.allergens && dish.allergens.length > 0 ? \`
              <div class="allergens">⚠️ Contains: \${dish.allergens.join(', ')}</div>
            \` : ''}
            \${dish.dietary && dish.dietary.length > 0 ? \`
              <div class="dietary-tags">
                \${dish.dietary.map(d => \`<span class="tag">\${d}</span>\`).join('')}
              </div>
            \` : ''}
          </div>
        \`;
      }

      renderMenuSection(section) {
        return \`
          <div>
            <h2>\${section.title}</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">
              \${section.dishes.map(dish => \`
                <div class="dish-card">
                  \${dish.thumbnail ? \`<img src="\${dish.thumbnail}" alt="\${dish.name}" style="max-width: 100%;" />\` : ''}
                  <h3>\${dish.name}</h3>
                  <p>\${dish.shortDescription || ''}</p>
                  <div class="price">₹\${dish.price}</div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      }

      renderOrderSummary(order) {
        return \`
          <div>
            <h2>Your Order</h2>
            <div style="margin-top: 20px;">
              \${order.items.map((item, idx) => \`
                <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;">
                  <div>
                    <strong>\${item.quantity}x \${item.dishName}</strong>
                    \${item.customizations && item.customizations.length > 0 ? \`
                      <div style="font-size: 0.85rem; color: #666;">\${item.customizations.join(', ')}</div>
                    \` : ''}
                  </div>
                  <div class="price" style="font-size: 1rem;">₹\${item.itemPrice}</div>
                </div>
              \`).join('')}
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--primary-color);">
              <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>Subtotal:</span>
                <span>₹\${order.subtotal}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>Tax:</span>
                <span>₹\${order.tax}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 10px 0; font-size: 1.2rem; font-weight: bold;">
                <span>Total:</span>
                <span class="price">₹\${order.total}</span>
              </div>
              \${order.estimatedTime ? \`
                <div style="text-align: center; margin-top: 15px; color: #666;">
                  Estimated time: \${order.estimatedTime} minutes
                </div>
              \` : ''}
            </div>
          </div>
        \`;
      }

      renderAdviceCard(data) {
        return \`
          <div class="advice-card">
            <h2>\${data.title || 'Financial Advice'}</h2>
            <p>\${data.advice || data.content || ''}</p>
          </div>
        \`;
      }

      updateStatus(status) {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.className = \`status \${status}\`;
        statusEl.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
      }

      attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnect attempts reached');
          return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        console.log(\`Reconnecting in \${delay}ms (attempt \${this.reconnectAttempts})...\`);
        setTimeout(() => this.connect(), delay);
      }

      sendPing() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }
    }

    // Initialize client
    const client = new ConversationClient(config);

    // Send ping every 30 seconds to keep connection alive
    setInterval(() => client.sendPing(), 30000);
  </script>
</body>
</html>`;
}

