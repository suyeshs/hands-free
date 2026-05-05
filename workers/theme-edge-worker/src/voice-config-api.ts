/**
 * Voice Configuration API Handlers
 * Provides endpoints for managing tenant voice AI configurations
 */

import {
  TenantVoiceConfig,
  VoiceConfigUpdate,
  VoiceConfigResponse,
  getDefaultVoiceConfig,
  getCoorgFoodCompanyConfig,
  VoiceCategory,
} from './voice-config-types';
import { Env } from './types';
import { successResponse, errorResponse } from './utils';

/**
 * Handle voice config API requests
 * Routes:
 * - GET /api/voice-config/{tenantId} - Get tenant voice config
 * - POST /api/voice-config/{tenantId} - Update tenant voice config
 * - GET /api/voice-config - List all tenant configs (admin)
 */
export async function handleVoiceConfigAPI(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // GET /api/voice-config - List all configs (admin only)
    if (path === '/api/voice-config' && request.method === 'GET') {
      return await handleListVoiceConfigs(request, env);
    }

    // Extract tenantId from path: /api/voice-config/{tenantId}
    const match = path.match(/^\/api\/voice-config\/([^\/]+)$/);
    if (!match) {
      return errorResponse('Invalid voice config path', 400);
    }

    const tenantId = match[1];

    switch (request.method) {
      case 'GET':
        return await handleGetVoiceConfig(tenantId, env);
      case 'POST':
        return await handleUpdateVoiceConfig(tenantId, request, env);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (error) {
    console.error('[VoiceConfigAPI] Error:', error);
    return errorResponse(
      'Internal Server Error',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * GET /api/voice-config/{tenantId}
 * Get tenant voice configuration
 */
async function handleGetVoiceConfig(
  tenantId: string,
  env: Env
): Promise<Response> {
  try {
    console.log('[VoiceConfigAPI] Getting config for tenant:', tenantId);

    let config: TenantVoiceConfig | null = null;

    // 1. Try to get from D1 database first (primary source)
    if (env.MENU_DB) {
      try {
        const result = await env.MENU_DB.prepare(
          'SELECT prompts, voice, behavior, features, branding FROM tenant_voice_config WHERE tenant_id = ?'
        )
          .bind(tenantId)
          .first();

        if (result) {
          // Helper function to parse JSON fields (handles string and object)
          const parseField = (field: any) => {
            if (typeof field === 'string') {
              try {
                return JSON.parse(field);
              } catch (e) {
                console.error('[VoiceConfigAPI] JSON parse error:', e);
                return field;
              }
            }
            return field;
          };

          config = {
            tenantId,
            category: 'restaurant' as VoiceCategory,
            prompts: parseField(result.prompts),
            voice: parseField(result.voice),
            behavior: parseField(result.behavior),
            features: parseField(result.features),
            branding: parseField(result.branding),
            version: 1,
            active: true,
          };
          console.log('[VoiceConfigAPI] Config found in D1 for:', tenantId, config.branding);
        } else {
          console.log('[VoiceConfigAPI] No D1 result found for:', tenantId);
        }
      } catch (d1Error) {
        console.error('[VoiceConfigAPI] D1 query error:', d1Error);
      }
    }

    // 2. Try to get from KV if not in D1
    if (!config && env.VOICE_CONFIGS) {
      const kvData = await env.VOICE_CONFIGS.get(`tenant:${tenantId}`, 'json');
      if (kvData) {
        config = kvData as TenantVoiceConfig;
        console.log('[VoiceConfigAPI] Config found in KV:', {
          tenantId,
          version: config.version,
        });
      }
    }

    // 3. Fall back to hardcoded defaults
    if (!config) {
      // Match both coorg-food-company and coorg-food-company-6163 variants
      if (tenantId === 'coorg-food-company' || tenantId === 'coorg-food-company-6163') {
        config = getCoorgFoodCompanyConfig(tenantId);
        console.log('[VoiceConfigAPI] Using Coorg Food Company default config for:', tenantId);
      } else {
        config = getDefaultVoiceConfig(tenantId);
        console.log('[VoiceConfigAPI] Using default config for:', tenantId);
      }
    }

    const response: VoiceConfigResponse = {
      success: true,
      config,
    };

    return successResponse(response);
  } catch (error) {
    console.error('[VoiceConfigAPI] Error getting config:', error);
    return errorResponse(
      'Failed to get voice config',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * POST /api/voice-config/{tenantId}
 * Update tenant voice configuration
 */
async function handleUpdateVoiceConfig(
  tenantId: string,
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Parse update request
    const updates = (await request.json()) as VoiceConfigUpdate;

    console.log('[VoiceConfigAPI] Updating config for tenant:', tenantId, {
      updates: Object.keys(updates),
    });

    // Get current config
    let currentConfig: TenantVoiceConfig | null = null;

    if (env.VOICE_CONFIGS) {
      const kvData = await env.VOICE_CONFIGS.get(`tenant:${tenantId}`, 'json');
      if (kvData) {
        currentConfig = kvData as TenantVoiceConfig;
      }
    }

    // If no existing config, start with default
    if (!currentConfig) {
      currentConfig = getDefaultVoiceConfig(tenantId);
    }

    const previousVersion = currentConfig.version;

    // Apply updates with deep merge
    const newConfig: TenantVoiceConfig = {
      ...currentConfig,
      branding: {
        ...currentConfig.branding,
        ...(updates.branding || {}),
      },
      voice: {
        ...currentConfig.voice,
        ...(updates.voice || {}),
      },
      prompts: {
        ...currentConfig.prompts,
        ...(updates.prompts || {}),
        templates: {
          ...currentConfig.prompts.templates,
          ...(updates.prompts?.templates || {}),
        },
      },
      behavior: {
        ...currentConfig.behavior,
        ...(updates.behavior || {}),
      },
      features: {
        ...(currentConfig.features || {}),
        ...(updates.features || {}),
      },
      version: previousVersion + 1,
      updatedAt: Date.now(),
      updatedBy: updates.updatedBy || 'api',
    };

    // Save to KV (if available)
    if (env.VOICE_CONFIGS) {
      await env.VOICE_CONFIGS.put(`tenant:${tenantId}`, JSON.stringify(newConfig));
      console.log('[VoiceConfigAPI] Config saved to KV:', {
        tenantId,
        version: newConfig.version,
      });
    }

    const response: VoiceConfigResponse = {
      success: true,
      config: newConfig,
      previousVersion,
      newVersion: newConfig.version,
    };

    return successResponse(response);
  } catch (error) {
    console.error('[VoiceConfigAPI] Error updating config:', error);
    return errorResponse(
      'Failed to update voice config',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * GET /api/voice-config
 * List all tenant voice configurations (admin only)
 */
async function handleListVoiceConfigs(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // TODO: Add authentication check for admin users

    const configs: Array<{
      tenantId: string;
      category: VoiceCategory;
      branding: { name: string };
      version: number;
      active: boolean;
    }> = [];

    // List configs from KV (if available)
    if (env.VOICE_CONFIGS) {
      const { keys } = await env.VOICE_CONFIGS.list({ prefix: 'tenant:' });

      for (const key of keys) {
        const config = await env.VOICE_CONFIGS.get(key.name, 'json');
        if (config) {
          const voiceConfig = config as TenantVoiceConfig;
          configs.push({
            tenantId: voiceConfig.tenantId,
            category: voiceConfig.category,
            branding: { name: voiceConfig.branding.name },
            version: voiceConfig.version,
            active: voiceConfig.active,
          });
        }
      }
    }

    // Add hardcoded defaults if not in KV
    const coorgExists = configs.some((c) => c.tenantId === 'coorg-food-company');
    if (!coorgExists) {
      const coorgConfig = getCoorgFoodCompanyConfig();
      configs.push({
        tenantId: coorgConfig.tenantId,
        category: coorgConfig.category,
        branding: { name: coorgConfig.branding.name },
        version: coorgConfig.version,
        active: coorgConfig.active,
      });
    }

    return successResponse({
      success: true,
      configs,
    });
  } catch (error) {
    console.error('[VoiceConfigAPI] Error listing configs:', error);
    return errorResponse(
      'Failed to list voice configs',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
