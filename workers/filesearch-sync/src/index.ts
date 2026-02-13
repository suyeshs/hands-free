/**
 * Menu Sync Worker
 *
 * Handles ALL menu synchronization:
 * - D1 → KV sync (edge caching)
 * - D1 → File Search sync (AI voice ordering via backend)
 * - Status monitoring
 * - Webhooks for automatic syncing
 *
 * Separation of concerns:
 * - Orders Worker: POS operations, sales, inventory
 * - This Worker: Menu synchronization
 */

import type { Env } from './types';
import { handleSyncRequest } from './handlers/sync';
import { handleStatusRequest, handleBatchStatusRequest } from './handlers/status';
import {
  handleMenuUpdateWebhook,
  handleD1ToKVSync,
  handleFullSync
} from './handlers/webhook';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      // Route handling
      if (path === '/health') {
        // Health check
        response = Response.json({
          status: 'healthy',
          service: 'menu-sync',
          timestamp: new Date().toISOString()
        });

      } else if (path === '/webhook/menu-updated' && request.method === 'POST') {
        // Webhook: Menu updated (auto-sync trigger)
        response = await handleMenuUpdateWebhook(request, env);

      } else if (path === '/status/batch' && request.method === 'POST') {
        // Batch status check
        response = await handleBatchStatusRequest(request, env);

      } else if (path.startsWith('/status/')) {
        // Status check: GET /status/:tenantId
        const tenantId = path.split('/')[2];
        if (!tenantId) {
          response = Response.json({ error: 'Missing tenantId' }, { status: 400 });
        } else {
          response = await handleStatusRequest(request, env, tenantId);
        }

      } else if (path.startsWith('/sync/full/') && request.method === 'POST') {
        // Full sync: POST /sync/full/:tenantId
        const tenantId = path.split('/')[3];
        if (!tenantId) {
          response = Response.json({ error: 'Missing tenantId' }, { status: 400 });
        } else {
          response = await handleFullSync(request, env, tenantId);
        }

      } else if (path.startsWith('/sync/d1-to-kv/') && request.method === 'POST') {
        // D1 to KV sync: POST /sync/d1-to-kv/:tenantId
        const tenantId = path.split('/')[3];
        if (!tenantId) {
          response = Response.json({ error: 'Missing tenantId' }, { status: 400 });
        } else {
          response = await handleD1ToKVSync(request, env, tenantId);
        }

      } else if (path.startsWith('/sync/') && request.method === 'POST') {
        // File Search sync: POST /sync/:tenantId
        const tenantId = path.split('/')[2];
        if (!tenantId) {
          response = Response.json({ error: 'Missing tenantId' }, { status: 400 });
        } else {
          response = await handleSyncRequest(request, env, tenantId);
        }

      } else {
        // 404 - Route not found
        response = Response.json({
          error: 'Not Found',
          message: 'Invalid endpoint',
          availableEndpoints: [
            'GET  /health',
            'GET  /status/:tenantId',
            'POST /status/batch',
            'POST /sync/:tenantId',
            'POST /sync/d1-to-kv/:tenantId',
            'POST /sync/full/:tenantId',
            'POST /webhook/menu-updated'
          ]
        }, { status: 404 });
      }

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;

    } catch (error) {
      console.error('[Worker] Unhandled error:', error);

      const errorResponse = Response.json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });

      // Add CORS headers to error response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });

      return errorResponse;
    }
  },
};
