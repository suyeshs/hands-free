/**
 * Grab Food - API Handlers
 *
 * Edge worker API handlers for serving Grab Food theme via HTTP endpoints.
 */

import type { GrabFoodTheme } from './types';
import { validateGrabFoodTheme } from './schema';
import { GrabFoodDefaultTheme } from './presets/grab-food-default';
import { KhaoPiyoTheme } from './presets/khao-piyo-preset';
import { DefaultGrabFoodDesignTokens } from './design-tokens';
import { DefaultGrabFoodLayouts } from './layouts';

const THEME_PRESETS: Record<string, GrabFoodTheme> = {
  'grab-food-default': GrabFoodDefaultTheme,
  'khao-piyo-custom': KhaoPiyoTheme,
};

/**
 * Handle all Grab Food API requests
 */
export async function handleGrabFoodAPI(
  request: Request,
  pathname: string,
  env?: any
): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);

  // GET /api/grab-food/themes - List all available presets
  if (pathname === '/api/grab-food/themes' && method === 'GET') {
    return listThemePresets();
  }

  // GET /api/grab-food/themes/:preset - Get specific preset theme
  const getThemeMatch = pathname.match(/^\/api\/grab-food\/themes\/([^\/]+)$/);
  if (getThemeMatch && method === 'GET') {
    const presetName = getThemeMatch[1];
    return getThemePreset(presetName);
  }

  // POST /api/grab-food/themes/validate - Validate theme JSON
  if (pathname === '/api/grab-food/themes/validate' && method === 'POST') {
    return validateThemeJSON(request);
  }

  // GET /api/grab-food/design-tokens - Get design tokens
  if (pathname === '/api/grab-food/design-tokens' && method === 'GET') {
    return getDesignTokens();
  }

  // GET /api/grab-food/layouts/:type - Get layout configuration
  const layoutMatch = pathname.match(/^\/api\/grab-food\/layouts\/([^\/]+)$/);
  if (layoutMatch && method === 'GET') {
    const layoutType = layoutMatch[1];
    return getLayoutConfig(layoutType);
  }

  // GET /api/grab-food/config/theme?tenantId=xxx - Get tenant theme config
  if (pathname === '/api/grab-food/config/theme' && method === 'GET') {
    const tenantId = url.searchParams.get('tenantId');
    if (!tenantId || !env) {
      return errorResponse('tenantId parameter is required', 400);
    }
    return getTenantThemeConfig(tenantId, env);
  }

  // GET /api/grab-food/menu?tenantId=xxx - Get tenant menu
  if (pathname === '/api/grab-food/menu' && method === 'GET') {
    const tenantId = url.searchParams.get('tenantId');
    if (!tenantId || !env) {
      return errorResponse('tenantId parameter is required', 400);
    }
    return getTenantMenu(tenantId, env);
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * List all available theme presets
 */
function listThemePresets(): Response {
  const presets = Object.keys(THEME_PRESETS).map((key) => {
    const theme = THEME_PRESETS[key];
    return {
      id: key,
      name: theme.meta.name,
      description: theme.meta.description,
      version: theme.version,
      tags: theme.meta.tags,
    };
  });

  return jsonResponse({
    presets,
    count: presets.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get a specific theme preset
 */
function getThemePreset(presetName: string): Response {
  const theme = THEME_PRESETS[presetName];

  if (!theme) {
    return errorResponse(
      `Theme preset "${presetName}" not found`,
      404,
      `Available presets: ${Object.keys(THEME_PRESETS).join(', ')}`
    );
  }

  return jsonResponse({
    theme,
    preset: presetName,
    timestamp: new Date().toISOString(),
  }, {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'CDN-Cache-Control': 'public, max-age=86400',
  });
}

/**
 * Validate theme JSON against schema
 */
async function validateThemeJSON(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const validation = validateGrabFoodTheme(body);

    if (validation.valid) {
      return jsonResponse({
        valid: true,
        message: 'Theme is valid',
        data: validation.data,
      });
    } else {
      return jsonResponse({
        valid: false,
        errors: validation.errors,
      }, {}, 400);
    }
  } catch (error) {
    return errorResponse(
      'Invalid JSON',
      400,
      error instanceof Error ? error.message : 'Failed to parse JSON'
    );
  }
}

/**
 * Get design tokens
 */
function getDesignTokens(): Response {
  return jsonResponse({
    designTokens: DefaultGrabFoodDesignTokens,
    timestamp: new Date().toISOString(),
  }, {
    'Cache-Control': 'public, max-age=3600',
  });
}

/**
 * Get layout configuration by type
 */
function getLayoutConfig(layoutType: string): Response {
  const layoutMap: Record<string, any> = {
    'home': DefaultGrabFoodLayouts.home,
    'home-list': DefaultGrabFoodLayouts.homeList,
    'order-tracking': DefaultGrabFoodLayouts.orderTracking,
    'order-tracking-compact': DefaultGrabFoodLayouts.orderTrackingCompact,
    'restaurant-detail': DefaultGrabFoodLayouts.restaurantDetail,
    'restaurant-detail-minimal': DefaultGrabFoodLayouts.restaurantDetailMinimal,
    'restaurant-detail-grid': DefaultGrabFoodLayouts.restaurantDetailGrid,
  };

  const layout = layoutMap[layoutType];

  if (!layout) {
    return errorResponse(
      'Invalid layout type',
      400,
      `Valid types: ${Object.keys(layoutMap).join(', ')}`
    );
  }

  return jsonResponse({
    layout,
    type: layoutType,
    timestamp: new Date().toISOString(),
  }, {
    'Cache-Control': 'public, max-age=3600',
  });
}

/**
 * Helper: JSON response with CORS headers
 */
function jsonResponse(
  data: any,
  additionalHeaders: Record<string, string> = {},
  status: number = 200
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...additionalHeaders,
    },
  });
}

/**
 * Helper: Error response
 */
function errorResponse(
  message: string,
  status: number,
  details?: string
): Response {
  return jsonResponse({
    error: message,
    details,
    timestamp: new Date().toISOString(),
  }, {}, status);
}

/**
 * Get tenant theme configuration from KV
 */
async function getTenantThemeConfig(tenantId: string, env: any): Promise<Response> {
  try {
    const TENANT_METADATA = env.TENANT_METADATA;

    if (!TENANT_METADATA) {
      return errorResponse('TENANT_METADATA KV namespace not configured', 500);
    }

    const themeConfigKey = `config:${tenantId}:theme`;
    const themeConfig = await TENANT_METADATA.get(themeConfigKey, { type: 'json' });

    if (!themeConfig) {
      return errorResponse(`Theme config not found for tenant: ${tenantId}`, 404);
    }

    return jsonResponse(themeConfig, {
      'Cache-Control': 'public, max-age=60',
    });
  } catch (error) {
    return errorResponse(
      'Failed to fetch theme config',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Get tenant menu from KV
 */
async function getTenantMenu(tenantId: string, env: any): Promise<Response> {
  try {
    const TENANT_METADATA = env.TENANT_METADATA;

    if (!TENANT_METADATA) {
      return errorResponse('TENANT_METADATA KV namespace not configured', 500);
    }

    const menuKey = `menu:${tenantId}:data`;
    const menuData = await TENANT_METADATA.get(menuKey, { type: 'json' });

    if (!menuData) {
      return errorResponse(`Menu not found for tenant: ${tenantId}`, 404);
    }

    return jsonResponse(menuData, {
      'Cache-Control': 'public, max-age=60',
    });
  } catch (error) {
    return errorResponse(
      'Failed to fetch menu',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

export default handleGrabFoodAPI;
