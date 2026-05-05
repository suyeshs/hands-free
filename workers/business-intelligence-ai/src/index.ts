/**
 * Business Intelligence AI Worker
 * AI-powered business recommendations and insights for restaurant operations
 */

import { Env, MenuOptimizationRequest } from './types';
import { handleMenuOptimization } from './agents/menuOptimization';

/**
 * CORS headers for all responses
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
  'Access-Control-Max-Age': '86400'
};

/**
 * Main worker entry point
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ============ MENU OPTIMIZATION ENDPOINT ============
      // POST /api/insights/:tenantId/menu-optimization
      if (request.method === 'POST' && path.includes('/menu-optimization')) {
        const pathParts = path.split('/');
        const tenantIdIndex = pathParts.indexOf('insights') + 1;
        const tenantId = pathParts[tenantIdIndex];

        if (!tenantId) {
          return new Response(
            JSON.stringify({ error: 'Tenant ID is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        // Parse request body
        const requestData = await request.json() as Partial<MenuOptimizationRequest>;

        const menuRequest: MenuOptimizationRequest = {
          tenant_id: tenantId,
          time_range: requestData.time_range || 'week',
          min_confidence: requestData.min_confidence || 0.7,
          options: requestData.options || {}
        };

        // Execute menu optimization
        const result = await handleMenuOptimization(menuRequest, env);

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ============ HEALTH CHECK ============
      if (path === '/health' || path === '/') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'business-intelligence-ai',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            endpoints: [
              'POST /api/insights/:tenantId/menu-optimization'
            ]
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // ============ DEBUG ENDPOINTS ============
      if (path === '/debug/env') {
        return new Response(
          JSON.stringify({
            ENVIRONMENT: env.ENVIRONMENT,
            CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
            TOKEN_MANAGER_URL: env.TOKEN_MANAGER_URL,
            HAS_TOKEN_MANAGER_BINDING: !!env.TOKEN_MANAGER,
            HAS_TENANT_METADATA_KV: !!env.TENANT_METADATA
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }
};
