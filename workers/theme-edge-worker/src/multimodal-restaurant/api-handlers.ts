/**
 * Multimodal Restaurant Theme - API Handlers
 *
 * Edge worker handlers for serving restaurant themes
 */

import type { MultimodalRestaurantTheme } from './types';
import { validateMultimodalRestaurantTheme } from './schema';
import { CoorgFoodCompanyTheme } from './presets/coorg-food-company';
import { GenericRestaurantTheme } from './presets/generic-restaurant';
import { AnimationTemplates } from './animation-templates';
import { DefaultRestaurantDesignTokens } from './design-tokens';
import * as layoutsModule from './layouts';

/**
 * Available preset themes
 */
const THEME_PRESETS: Record<string, MultimodalRestaurantTheme> = {
  'coorg-food-company': CoorgFoodCompanyTheme,
  'generic': GenericRestaurantTheme,
};

/**
 * Handle multimodal restaurant theme API requests
 */
export async function handleMultimodalRestaurantAPI(
  request: Request,
  pathname: string
): Promise<Response> {
  const method = request.method;

  // GET /api/multimodal-restaurant/themes - List all available presets
  if (pathname === '/api/multimodal-restaurant/themes' && method === 'GET') {
    return listThemePresets();
  }

  // GET /api/multimodal-restaurant/themes/:preset - Get specific preset theme
  const getThemeMatch = pathname.match(/^\/api\/multimodal-restaurant\/themes\/([^\/]+)$/);
  if (getThemeMatch && method === 'GET') {
    const presetName = getThemeMatch[1];
    return getThemePreset(presetName);
  }

  // POST /api/multimodal-restaurant/themes/validate - Validate theme JSON
  if (pathname === '/api/multimodal-restaurant/themes/validate' && method === 'POST') {
    return validateThemeJSON(request);
  }

  // GET /api/multimodal-restaurant/animations - Get all animation templates
  if (pathname === '/api/multimodal-restaurant/animations' && method === 'GET') {
    return getAnimationTemplates();
  }

  // GET /api/multimodal-restaurant/design-tokens - Get design tokens
  if (pathname === '/api/multimodal-restaurant/design-tokens' && method === 'GET') {
    return getDesignTokens();
  }

  // GET /api/multimodal-restaurant/layouts/:type - Get layout configuration
  const layoutMatch = pathname.match(/^\/api\/multimodal-restaurant\/layouts\/([^\/]+)$/);
  if (layoutMatch && method === 'GET') {
    const layoutType = layoutMatch[1];
    return getLayoutConfig(layoutType);
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
      restaurantId: theme.meta.restaurantId,
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
 * Validate theme JSON
 */
async function validateThemeJSON(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const validation = validateMultimodalRestaurantTheme(body);

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
 * Get all animation templates
 */
function getAnimationTemplates(): Response {
  return jsonResponse({
    animations: AnimationTemplates,
    categories: ['page', 'element', 'interaction', 'list', 'voice'],
    timestamp: new Date().toISOString(),
  }, {
    'Cache-Control': 'public, max-age=3600',
  });
}

/**
 * Get design tokens
 */
function getDesignTokens(): Response {
  return jsonResponse({
    designTokens: DefaultRestaurantDesignTokens,
    timestamp: new Date().toISOString(),
  }, {
    'Cache-Control': 'public, max-age=3600',
  });
}

/**
 * Get layout configuration
 */
function getLayoutConfig(layoutType: string): Response {
  try {
    let layout;
    if (layoutType === 'landing') {
      layout = layoutsModule.getLayout('landing');
    } else if (layoutType === 'voice-assisted') {
      layout = layoutsModule.getLayout('voice-assisted');
    } else if (layoutType === 'standard-browse') {
      layout = layoutsModule.getLayout('standard-browse');
    } else {
      return errorResponse(
        'Invalid layout type',
        400,
        'Valid types: landing, voice-assisted, standard-browse'
      );
    }

    return jsonResponse({
      layout,
      type: layoutType,
      timestamp: new Date().toISOString(),
    }, {
      'Cache-Control': 'public, max-age=3600',
    });
  } catch (error) {
    return errorResponse(
      'Failed to get layout',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
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
 * Export all handlers
 */
export default handleMultimodalRestaurantAPI;
