/**
 * Tenant Router Worker
 *
 * Routes ALL tenant requests (orders, menu, sales, settings, etc.) to tenant-specific workers
 * in the handsfree-tenants dispatch namespace. Each tenant worker has its own D1 database
 * binding for fast, transactional operations.
 *
 * Responsibilities:
 * - Request routing and dispatch to tenant workers
 * - D1 database provisioning for new tenants
 * - WebSocket connections via Durable Objects for real-time notifications
 * - Acts as the API gateway for the entire platform
 */

import { Env } from './types';
import { getCloudflareApiToken } from './lib/token-manager';

// Export the Durable Object class
export { OrderNotificationDO } from './durable-objects/order-notification-do';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id, CF-Access-Client-Id, CF-Access-Client-Secret',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'healthy',
        service: 'handsfree-tenant-router',
        timestamp: new Date().toISOString(),
      }, { headers: CORS_HEADERS });
    }

    // ========================================================================
    // D1 PROVISIONING ENDPOINTS (for POS cloud sync)
    // ========================================================================

    // D1 Provision endpoint: POST /api/provision/{tenantId}
    const provisionMatch = url.pathname.match(/^\/api\/provision\/([^\/]+)$/);
    if (provisionMatch && request.method === 'POST') {
      const tenantId = provisionMatch[1];
      console.log(`[D1 Provision] Provisioning D1 for tenant: ${tenantId}`);

      try {
        const body = await request.json() as { databaseName: string; schema: string[] };
        const { databaseName, schema } = body;

        if (!databaseName || !schema || !Array.isArray(schema)) {
          return Response.json({
            success: false,
            error: 'Missing required fields: databaseName, schema',
          }, { status: 400, headers: CORS_HEADERS });
        }

        // Create D1 database via Cloudflare API
        const accountId = env.CLOUDFLARE_ACCOUNT_ID;

        if (!accountId) {
          return Response.json({
            success: false,
            error: 'Missing Cloudflare account ID',
          }, { status: 500, headers: CORS_HEADERS });
        }

        // Fetch API token from Token Manager
        let apiToken: string;
        try {
          apiToken = await getCloudflareApiToken(env);
          console.log(`[D1 Provision] ✅ Retrieved API token from Token Manager`);
        } catch (error) {
          console.error(`[D1 Provision] ❌ Failed to fetch API token:`, error);
          return Response.json({
            success: false,
            error: 'Failed to retrieve Cloudflare API token from Token Manager',
          }, { status: 500, headers: CORS_HEADERS });
        }

        // Step 1: Check if database already exists
        const listDbResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const listDbResult = await listDbResponse.json() as any;
        let databaseId: string | null = null;

        if (listDbResult.success && listDbResult.result) {
          const existingDb = listDbResult.result.find((db: any) => db.name === databaseName);
          if (existingDb) {
            databaseId = existingDb.uuid;
            console.log(`[D1 Provision] Database already exists: ${databaseId}`);
          }
        }

        // Step 2: Create D1 database if it doesn't exist
        if (!databaseId) {
          const createDbResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ name: databaseName }),
            }
          );

          const createDbResult = await createDbResponse.json() as any;

          if (!createDbResult.success || !createDbResult.result) {
            console.error('[D1 Provision] Failed to create database:', createDbResult);
            return Response.json({
              success: false,
              error: createDbResult.errors?.[0]?.message || 'Failed to create D1 database',
            }, { status: 500, headers: CORS_HEADERS });
          }

          databaseId = createDbResult.result.uuid;
          console.log(`[D1 Provision] Created new database: ${databaseId}`);
        }

        // Step 3: Apply schema statements
        let tablesCreated = 0;
        const errors: string[] = [];

        for (const statement of schema) {
          try {
            const execResponse = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sql: statement }),
              }
            );

            const execResult = await execResponse.json() as any;

            if (execResult.success) {
              tablesCreated++;
            } else {
              console.error('[D1 Provision] Failed to execute statement:', statement, execResult);
              errors.push(`Failed: ${statement.substring(0, 50)}...`);
            }
          } catch (err) {
            console.error('[D1 Provision] Error executing statement:', err);
            errors.push(`Error: ${statement.substring(0, 50)}...`);
          }
        }

        // Step 4: Store metadata in KV
        const metadata = {
          provisioned: true,
          databaseId,
          databaseName,
          tableCount: tablesCreated,
          provisionedAt: new Date().toISOString(),
          schemaVersion: '1.0',
        };

        await env.TENANT_METADATA.put(`tenant:${tenantId}:d1`, JSON.stringify(metadata));

        console.log(`[D1 Provision] Successfully provisioned ${tablesCreated} tables`);

        return Response.json({
          success: true,
          output: `Created ${tablesCreated} tables${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
          databaseId,
          tables_created: tablesCreated,
          errors: errors.length > 0 ? errors : undefined,
        }, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[D1 Provision] Provisioning error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to provision D1',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // D1 Provision Status endpoint: GET /api/provision/{tenantId}/status
    const provisionStatusMatch = url.pathname.match(/^\/api\/provision\/([^\/]+)\/status$/);
    if (provisionStatusMatch && request.method === 'GET') {
      const tenantId = provisionStatusMatch[1];
      console.log(`[D1 Provision] Checking status for tenant: ${tenantId}`);

      try {
        const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}:d1`, 'json') as any;

        if (!metadata) {
          return Response.json({
            provisioned: false,
          }, { headers: CORS_HEADERS });
        }

        return Response.json({
          provisioned: metadata.provisioned,
          databaseId: metadata.databaseId,
          databaseName: metadata.databaseName,
          tableCount: metadata.tableCount,
          provisionedAt: metadata.provisionedAt,
          schemaVersion: metadata.schemaVersion,
        }, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[D1 Provision] Status check failed:', error);
        return Response.json({
          error: error.message || 'Failed to check D1 status',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ========================================================================
    // CUSTOM DOMAIN PROVISIONING ENDPOINTS
    // ========================================================================

    // Verify DNS only (no save) — used by UI for live feedback before committing
    // POST /api/custom-domain/verify
    if (url.pathname === '/api/custom-domain/verify' && request.method === 'POST') {
      try {
        const body = await request.json() as { domain: string; tenantId: string };
        const { domain, tenantId } = body;

        if (!domain || !tenantId) {
          return Response.json({ error: 'domain and tenantId are required' }, { status: 400, headers: CORS_HEADERS });
        }

        const result = await verifyCustomDomainCNAME(domain.toLowerCase().trim(), tenantId);
        return Response.json(result, { headers: CORS_HEADERS });
      } catch (error: any) {
        return Response.json({ error: error.message || 'Verification failed' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Register a custom domain after DNS verification
    // POST /api/custom-domain  body: { domain, tenantId }
    if (url.pathname === '/api/custom-domain' && request.method === 'POST') {
      try {
        const body = await request.json() as { domain: string; tenantId: string };
        const { tenantId } = body;
        const domain = body.domain?.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

        if (!domain || !tenantId) {
          return Response.json({ error: 'domain and tenantId are required' }, { status: 400, headers: CORS_HEADERS });
        }

        // Validate domain format
        if (!/^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/.test(domain)) {
          return Response.json({ error: 'Invalid domain format' }, { status: 400, headers: CORS_HEADERS });
        }

        // Strip www to get root domain; we'll store both
        const rootDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
        const wwwDomain = `www.${rootDomain}`;

        // Verify the CNAME (check root domain; www typically follows)
        const verification = await verifyCustomDomainCNAME(rootDomain, tenantId);
        if (!verification.valid) {
          // Also try www in case that's what they pointed
          const wwwVerification = await verifyCustomDomainCNAME(wwwDomain, tenantId);
          if (!wwwVerification.valid) {
            return Response.json({
              success: false,
              status: 'failed',
              message: `CNAME not pointing to ${tenantId}.handsfree.tech. Found: ${verification.cnameTarget || 'no CNAME record'}`,
              cnameTarget: verification.cnameTarget,
            }, { status: 422, headers: CORS_HEADERS });
          }
        }

        const addedAt = new Date().toISOString();
        const mapping = JSON.stringify({ tenantId, addedAt, status: 'active' });

        // Store mappings for both root and www
        await env.TENANT_METADATA.put(`custom_domain:${rootDomain}`, mapping);
        await env.TENANT_METADATA.put(`custom_domain:${wwwDomain}`, mapping);

        // Update the tenant metadata entry with the custom domain
        const tenantMeta = await env.TENANT_METADATA.get(`tenant:${tenantId}`, 'json') as Record<string, any> | null;
        if (tenantMeta) {
          await env.TENANT_METADATA.put(`tenant:${tenantId}`, JSON.stringify({ ...tenantMeta, customDomain: rootDomain }));
        }

        console.log(`[CustomDomain] Activated ${rootDomain} → ${tenantId}`);
        return Response.json({ success: true, status: 'active', domain: rootDomain, addedAt }, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[CustomDomain] Registration failed:', error);
        return Response.json({ error: error.message || 'Registration failed' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Get current custom domain for a tenant
    // GET /api/custom-domain?tenantId={id}
    if (url.pathname === '/api/custom-domain' && request.method === 'GET') {
      const tenantId = url.searchParams.get('tenantId');
      if (!tenantId) {
        return Response.json({ error: 'tenantId is required' }, { status: 400, headers: CORS_HEADERS });
      }
      try {
        const tenantMeta = await env.TENANT_METADATA.get(`tenant:${tenantId}`, 'json') as Record<string, any> | null;
        const customDomain = tenantMeta?.customDomain ?? null;
        return Response.json({ tenantId, customDomain }, { headers: CORS_HEADERS });
      } catch (error: any) {
        return Response.json({ error: error.message || 'Lookup failed' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Get activation code for a tenant (used in settings to activate additional devices)
    // GET /api/tenant/activation-code?tenantId={id}
    if (url.pathname === '/api/tenant/activation-code' && request.method === 'GET') {
      const tenantId = url.searchParams.get('tenantId');
      if (!tenantId) {
        return Response.json({ error: 'tenantId is required' }, { status: 400, headers: CORS_HEADERS });
      }
      try {
        const tenantMeta = await env.TENANT_METADATA.get(`tenant:${tenantId}`, 'json') as Record<string, any> | null;
        if (!tenantMeta) {
          return Response.json({ error: 'Tenant not found' }, { status: 404, headers: CORS_HEADERS });
        }
        return Response.json({ tenantId, activationCode: tenantMeta.activationCode ?? null }, { headers: CORS_HEADERS });
      } catch (error: any) {
        return Response.json({ error: error.message || 'Lookup failed' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Remove a custom domain
    // DELETE /api/custom-domain  body: { domain, tenantId }
    if (url.pathname === '/api/custom-domain' && request.method === 'DELETE') {
      try {
        const body = await request.json() as { domain: string; tenantId: string };
        const { tenantId } = body;
        const domain = body.domain?.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

        if (!domain || !tenantId) {
          return Response.json({ error: 'domain and tenantId are required' }, { status: 400, headers: CORS_HEADERS });
        }

        const rootDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
        await env.TENANT_METADATA.delete(`custom_domain:${rootDomain}`);
        await env.TENANT_METADATA.delete(`custom_domain:www.${rootDomain}`);

        // Clear from tenant metadata
        const tenantMeta = await env.TENANT_METADATA.get(`tenant:${tenantId}`, 'json') as Record<string, any> | null;
        if (tenantMeta?.customDomain === rootDomain) {
          const { customDomain: _, ...rest } = tenantMeta;
          await env.TENANT_METADATA.put(`tenant:${tenantId}`, JSON.stringify(rest));
        }

        console.log(`[CustomDomain] Removed ${rootDomain} for ${tenantId}`);
        return Response.json({ success: true }, { headers: CORS_HEADERS });
      } catch (error: any) {
        return Response.json({ error: error.message || 'Removal failed' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // D1 Sync endpoint: POST /api/sync/{tenantId}
    const syncMatch = url.pathname.match(/^\/api\/sync\/([^\/]+)$/);
    if (syncMatch && request.method === 'POST') {
      const tenantId = syncMatch[1];
      console.log(`[D1 Sync] Syncing data for tenant: ${tenantId}`);

      try {
        const body = await request.json() as { dataType: string; records: any[] };
        const { dataType, records } = body;

        if (!dataType || !records || !Array.isArray(records)) {
          return Response.json({
            synced: 0,
            failed: 0,
            errors: ['Missing required fields: dataType, records'],
          }, { status: 400, headers: CORS_HEADERS });
        }

        // Get D1 database info from KV
        const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}:d1`, 'json') as any;

        if (!metadata || !metadata.databaseId) {
          return Response.json({
            synced: 0,
            failed: records.length,
            errors: ['D1 database not provisioned'],
          }, { status: 400, headers: CORS_HEADERS });
        }

        // Map dataType to tenant worker endpoint and field name
        const dataTypeToConfig: Record<string, { endpoint: string; fieldName: string }> = {
          'menu_items': { endpoint: '/menu/sync', fieldName: 'menuItems' },
          'menu_categories': { endpoint: '/categories/sync', fieldName: 'categories' },
          'sales_transactions': { endpoint: '/sales/sync', fieldName: 'transactions' },
          'orders': { endpoint: '/orders/sync', fieldName: 'orders' },
          'staff_users': { endpoint: '/staff/sync', fieldName: 'staff' },
          'staff': { endpoint: '/staff/sync', fieldName: 'staff' }, // Alias for staff_users
          'staff_login_history': { endpoint: '/staff/login-history/sync', fieldName: 'loginHistory' },
          'cash_registers': { endpoint: '/cash-registers/sync', fieldName: 'cashRegisters' },
          'cash_payouts': { endpoint: '/cash-payouts/sync', fieldName: 'payouts' },
          'tips': { endpoint: '/tips/sync', fieldName: 'tips' },
          'inventory_suppliers': { endpoint: '/inventory/suppliers/sync', fieldName: 'suppliers' },
          'inventory_items': { endpoint: '/inventory/items/sync', fieldName: 'items' },
          'inventory_documents': { endpoint: '/inventory/documents/sync', fieldName: 'documents' },
          'inventory_transactions': { endpoint: '/inventory/transactions/sync', fieldName: 'transactions' },
          'inventory_recipes': { endpoint: '/inventory/recipes/sync', fieldName: 'recipes' },
          'inventory_recipe_ingredients': { endpoint: '/inventory/recipe-ingredients/sync', fieldName: 'recipeIngredients' },
          // Note: 'settings' and 'inventory' (generic) are not supported yet - need specific endpoints
        };

        const config = dataTypeToConfig[dataType];
        if (!config) {
          return Response.json({
            synced: 0,
            failed: records.length,
            errors: [`Unknown dataType: ${dataType}`],
          }, { status: 400, headers: CORS_HEADERS });
        }

        console.log(`[D1 Sync] Forwarding ${records.length} ${dataType} records to tenant worker endpoint: ${config.endpoint}`);

        // Forward to tenant worker for D1 storage
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = config.endpoint;

        // Create request body with the correct field name expected by the handler
        const requestBody: Record<string, any> = {
          [config.fieldName]: records
        };

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: JSON.stringify(requestBody),
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();

        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[D1 Sync] Sync error:', error);
        return Response.json({
          synced: 0,
          failed: 0,
          errors: [error.message || 'Failed to sync data'],
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ========================================================================
    // END D1 PROVISIONING ENDPOINTS
    // ========================================================================

    // Aggregator orders sync endpoint: POST /api/aggregator-orders/{tenantId}/sync
    const aggregatorSyncMatch = url.pathname.match(/^\/api\/aggregator-orders\/([^\/]+)\/sync$/);
    if (aggregatorSyncMatch && request.method === 'POST') {
      const tenantId = aggregatorSyncMatch[1];
      console.log(`[OrdersRouter] Aggregator orders sync for tenant: ${tenantId}`);

      try {
        const body = await request.json() as { orders: any[] };
        const orders = body.orders || [];

        if (orders.length === 0) {
          return Response.json({ success: true, synced: 0, errors: [] }, { headers: CORS_HEADERS });
        }

        // Forward to tenant worker for D1 storage
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/aggregator-orders/sync';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: JSON.stringify({ orders }),
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();

        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Aggregator sync error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to sync aggregator orders',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Aggregator orders fetch endpoint: GET /api/aggregator-orders/{tenantId}
    const aggregatorFetchMatch = url.pathname.match(/^\/api\/aggregator-orders\/([^\/]+)$/);
    if (aggregatorFetchMatch && request.method === 'GET') {
      const tenantId = aggregatorFetchMatch[1];
      console.log(`[OrdersRouter] Fetching aggregator orders for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/aggregator-orders';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();

        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Aggregator fetch error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to fetch aggregator orders',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Aggregator orders archived fetch endpoint: GET /api/aggregator-orders/{tenantId}/archived
    const aggregatorArchivedMatch = url.pathname.match(/^\/api\/aggregator-orders\/([^\/]+)\/archived$/);
    if (aggregatorArchivedMatch && request.method === 'GET') {
      const tenantId = aggregatorArchivedMatch[1];
      console.log(`[OrdersRouter] Fetching archived aggregator orders for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/aggregator-orders/archived';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();

        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Aggregator archived fetch error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to fetch archived aggregator orders',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Aggregator order archive endpoint: PATCH /api/aggregator-orders/{tenantId}/{orderId}/archive
    const aggregatorArchiveMatch = url.pathname.match(/^\/api\/aggregator-orders\/([^\/]+)\/([^\/]+)\/archive$/);
    if (aggregatorArchiveMatch && request.method === 'PATCH') {
      const tenantId = aggregatorArchiveMatch[1];
      const orderId = aggregatorArchiveMatch[2];
      console.log(`[OrdersRouter] Archiving aggregator order ${orderId} for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/aggregator-orders/${orderId}/archive`;

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'PATCH',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();

        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Aggregator archive error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to archive aggregator order',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Aggregator archive all endpoint: POST /api/aggregator-orders/{tenantId}/archive-all
    const aggregatorArchiveAllMatch = url.pathname.match(/^\/api\/aggregator-orders\/([^\/]+)\/archive-all$/);
    if (aggregatorArchiveAllMatch && request.method === 'POST') {
      const tenantId = aggregatorArchiveAllMatch[1];
      console.log(`[OrdersRouter] Archiving all aggregator orders for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/aggregator-orders/archive-all';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();

        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Aggregator archive all error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to archive all aggregator orders',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // WebSocket upgrade for real-time order updates
    // Path: /ws/orders/{tenantId}
    const wsMatch = url.pathname.match(/^\/ws\/orders\/([^\/]+)$/);
    if (wsMatch) {
      // Check for WebSocket upgrade header
      if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
        const tenantId = wsMatch[1];
        console.log(`[OrdersRouter] WebSocket upgrade for tenant: ${tenantId}`);

        const doId = env.ORDER_NOTIFICATION.idFromName(tenantId);
        const doStub = env.ORDER_NOTIFICATION.get(doId);

        // Forward the upgrade request to the Durable Object
        return doStub.fetch(request);
      }
      // Non-WebSocket request to WebSocket path - return helpful error
      return Response.json({
        error: 'WebSocket upgrade required',
        message: 'This endpoint only accepts WebSocket connections. Use the "Upgrade: websocket" header.',
        path: url.pathname,
      }, { status: 426, headers: CORS_HEADERS });
    }

    // QR Order endpoint: POST /api/qr-orders/{tenantId}
    // Public endpoint for guest ordering (no auth required)
    const qrOrderMatch = url.pathname.match(/^\/api\/qr-orders\/([^\/]+)$/);
    if (qrOrderMatch && request.method === 'POST') {
      const tenantId = qrOrderMatch[1];
      console.log(`[OrdersRouter] QR order for tenant: ${tenantId}`);

      try {
        const body = await request.json() as any;

        // Build order payload from guest order
        const orderPayload = {
          orderType: 'dine_in',
          source: 'qr_code',
          tableId: body.tableId,
          items: body.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            modifiers: item.modifiers?.map((m: any) => m.name).join(', ') || null,
            specialInstructions: item.specialInstructions || null,
          })),
          customerName: body.guestName || 'Guest',
          specialInstructions: body.specialInstructions || null,
          paymentMethod: body.paymentMethod,
          sessionToken: body.sessionToken,
          subtotal: body.items.reduce((sum: number, item: any) => {
            const modTotal = item.modifiers?.reduce((s: number, m: any) => s + (m.priceAdjustment || 0), 0) || 0;
            return sum + (item.price + modTotal) * item.quantity;
          }, 0),
          tax: 0, // Will be calculated by tenant worker
          total: 0, // Will be calculated by tenant worker
        };

        // Forward to tenant worker
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/orders';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: JSON.stringify(orderPayload),
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json() as any;

        if (response.ok && responseData.success) {
          // Notify the Durable Object for QR order
          const doId = env.ORDER_NOTIFICATION.idFromName(tenantId);
          const doStub = env.ORDER_NOTIFICATION.get(doId);

          const kitchenOrder = {
            id: responseData.orderId,
            orderNumber: responseData.orderNumber,
            orderType: 'dine_in',
            source: 'qr_code',
            status: 'pending',
            items: orderPayload.items.map((item: any, index: number) => ({
              id: `${responseData.orderId}-item-${index}`,
              name: item.name,
              quantity: item.quantity,
              status: 'pending',
              modifiers: item.modifiers ? [item.modifiers] : [],
              specialInstructions: item.specialInstructions || null,
            })),
            createdAt: responseData.createdAt,
            estimatedPrepTime: 15,
            isUrgent: false,
            elapsedMinutes: 0,
            customer: { name: orderPayload.customerName },
            tableId: body.tableId,
          };

          // Get table info for notification (would need lookup from tenant worker)
          const tableInfo = {
            tableId: body.tableId,
            tableNumber: 0, // Would be looked up
            sectionName: '', // Would be looked up
          };

          await doStub.fetch(new Request('https://do/notify/qr-order-created', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: orderPayload, tableInfo, kitchenOrder }),
          }));

          return Response.json({
            orderId: responseData.orderId,
            orderNumber: responseData.orderNumber,
            status: 'pending',
            tableNumber: tableInfo.tableNumber,
            total: responseData.total || orderPayload.subtotal,
          }, { headers: CORS_HEADERS });
        }

        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] QR order error:', error);
        return Response.json({
          error: error.message || 'Failed to submit QR order',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Get QR order status: GET /api/qr-orders/{tenantId}/{orderId}
    const qrOrderStatusMatch = url.pathname.match(/^\/api\/qr-orders\/([^\/]+)\/([^\/]+)$/);
    if (qrOrderStatusMatch && request.method === 'GET') {
      const tenantId = qrOrderStatusMatch[1];
      const orderId = qrOrderStatusMatch[2];

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/orders/${orderId}`;

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();

        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] QR order status error:', error);
        return Response.json({
          error: error.message || 'Failed to get order status',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Service request endpoint: POST /api/service-requests/{tenantId}
    // Public endpoint for Call Waiter functionality (rate-limited)
    const serviceRequestMatch = url.pathname.match(/^\/api\/service-requests\/([^\/]+)$/);
    if (serviceRequestMatch && request.method === 'POST') {
      const tenantId = serviceRequestMatch[1];
      console.log(`[OrdersRouter] Service request for tenant: ${tenantId}`);

      try {
        const body = await request.json() as { tableId: string; type: string };

        // TODO: Implement rate limiting (1 request per 30 seconds per table)
        // Would use KV or Durable Object state to track last request time

        const requestId = `sr-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const request_data = {
          id: requestId,
          tableId: body.tableId,
          tableNumber: 0, // Would be looked up from table
          sectionId: '',
          sectionName: '',
          type: body.type,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        // Notify the Durable Object to broadcast to staff devices
        const doId = env.ORDER_NOTIFICATION.idFromName(tenantId);
        const doStub = env.ORDER_NOTIFICATION.get(doId);

        await doStub.fetch(new Request('https://do/notify/service-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request: request_data }),
        }));

        return Response.json({
          requestId,
          message: 'Request sent successfully',
        }, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Service request error:', error);
        return Response.json({
          error: error.message || 'Failed to send service request',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Table info endpoint: GET /api/tables/{tenantId}/{tableId}
    // Public endpoint for QR code pages to get table details
    const tableInfoMatch = url.pathname.match(/^\/api\/tables\/([^\/]+)\/([^\/]+)$/);
    if (tableInfoMatch && request.method === 'GET') {
      const tenantId = tableInfoMatch[1];
      const tableId = tableInfoMatch[2];

      try {
        // Fetch floor plan from tenant worker to get real table data
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/floor-plan';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const floorPlanData = await response.json() as {
          sections?: Array<{ id: string; name: string }>;
          tables?: Array<{
            id: string;
            sectionId: string;
            tableNumber: string;
            capacity: number;
            status: string;
          }>;
        };

        // Find the specific table
        const table = floorPlanData.tables?.find((t) => t.id === tableId);
        if (!table) {
          return Response.json({
            error: 'Table not found',
            tableId,
          }, { status: 404, headers: CORS_HEADERS });
        }

        // Find the section name
        const section = floorPlanData.sections?.find((s) => s.id === table.sectionId);

        return Response.json({
          tableId: table.id,
          tableNumber: parseInt(table.tableNumber, 10) || table.tableNumber,
          capacity: table.capacity,
          sectionId: table.sectionId,
          sectionName: section?.name || 'Main',
          status: table.status,
          restaurantName: tenantId,
          restaurantLogo: null, // Could be fetched from settings if needed
        }, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Table info error:', error);
        // Fallback to basic info if tenant worker fails
        return Response.json({
          tableId,
          tableNumber: 0,
          capacity: 4,
          sectionId: 'unknown',
          sectionName: 'Unknown',
          status: 'available',
          restaurantName: tenantId,
          restaurantLogo: null,
          error: 'Could not fetch full table info',
        }, { headers: CORS_HEADERS });
      }
    }

    // ==================== SALES TRANSACTIONS ====================

    // Sales sync endpoint: POST /api/sales/{tenantId}/sync
    const salesSyncMatch = url.pathname.match(/^\/api\/sales\/([^\/]+)\/sync$/);
    if (salesSyncMatch && request.method === 'POST') {
      const tenantId = salesSyncMatch[1];
      console.log(`[OrdersRouter] Sales sync for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/sales/sync';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();

        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Sales sync error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to sync sales transactions',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Sales summary endpoint: GET /api/sales/{tenantId}/summary
    const salesSummaryMatch = url.pathname.match(/^\/api\/sales\/([^\/]+)\/summary$/);
    if (salesSummaryMatch && request.method === 'GET') {
      const tenantId = salesSummaryMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/sales/summary';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Sales summary error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to get sales summary',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Sales breakdown endpoint: GET /api/sales/{tenantId}/breakdown
    const salesBreakdownMatch = url.pathname.match(/^\/api\/sales\/([^\/]+)\/breakdown$/);
    if (salesBreakdownMatch && request.method === 'GET') {
      const tenantId = salesBreakdownMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/sales/breakdown';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Sales breakdown error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to get sales breakdown',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Sales items endpoint: GET /api/sales/{tenantId}/items
    const salesItemsMatch = url.pathname.match(/^\/api\/sales\/([^\/]+)\/items$/);
    if (salesItemsMatch && request.method === 'GET') {
      const tenantId = salesItemsMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/sales/items';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Sales items error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to get top items',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Sales transactions list endpoint: GET /api/sales/{tenantId}/transactions
    const salesTransactionsMatch = url.pathname.match(/^\/api\/sales\/([^\/]+)\/transactions$/);
    if (salesTransactionsMatch && request.method === 'GET') {
      const tenantId = salesTransactionsMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/sales/transactions';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Sales transactions error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to get transactions',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Sales combined endpoint: GET /api/sales/{tenantId}/combined
    const salesCombinedMatch = url.pathname.match(/^\/api\/sales\/([^\/]+)\/combined$/);
    if (salesCombinedMatch && request.method === 'GET') {
      const tenantId = salesCombinedMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/sales/combined';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Sales combined error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to get combined sales',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== MENU ====================

    // Get menu items: GET /api/menu/{tenantId} or GET /api/menu-d1/{tenantId} (legacy)
    const menuListMatch = url.pathname.match(/^\/api\/menu(?:-d1)?\/([^\/]+)$/);
    if (menuListMatch && request.method === 'GET') {
      const tenantId = menuListMatch[1];
      console.log(`[OrdersRouter] Getting menu for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/menu';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Menu list error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to get menu',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Create menu item: POST /api/menu/{tenantId}
    if (menuListMatch && request.method === 'POST') {
      const tenantId = menuListMatch[1];
      console.log(`[OrdersRouter] Creating menu item for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/menu';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Create menu item error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to create menu item',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Get/Update/Delete menu item: /api/menu/{tenantId}/{itemId} or /api/menu-d1/{tenantId}/{itemId} (legacy)
    const menuItemMatch = url.pathname.match(/^\/api\/menu(?:-d1)?\/([^\/]+)\/([^\/]+)$/);
    if (menuItemMatch) {
      const tenantId = menuItemMatch[1];
      const itemId = menuItemMatch[2];
      console.log(`[OrdersRouter] Menu item ${request.method} for tenant: ${tenantId}, item: ${itemId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/menu/${itemId}`;

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: request.method,
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.method !== 'GET' && request.method !== 'DELETE' ? request.body : undefined,
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Menu item error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to process menu item request',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Individual category operations: GET/PATCH/DELETE /api/categories/{tenantId}/{categoryId}
    const categoryItemMatch = url.pathname.match(/^\/api\/categories\/([^\/]+)\/([^\/]+)$/);
    if (categoryItemMatch) {
      const tenantId = categoryItemMatch[1];
      const categoryId = categoryItemMatch[2];
      console.log(`[OrdersRouter] Category ${request.method} for tenant: ${tenantId}, category: ${categoryId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/categories/${categoryId}`;

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId
          },
          body: (request.method === 'PATCH' || request.method === 'POST') ? request.body : undefined,
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Category item error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to process category request',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Categories sync endpoint: POST /categories/sync (for D1 sync from POS)
    const categoriesSyncMatch = url.pathname.match(/^\/categories\/sync$/);
    if (categoriesSyncMatch && request.method === 'POST') {
      const tenantId = request.headers.get('X-Tenant-Id');
      if (!tenantId) {
        return Response.json({
          success: false,
          error: 'Missing X-Tenant-Id header',
        }, { status: 400, headers: CORS_HEADERS });
      }

      console.log(`[OrdersRouter] Categories sync for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/categories/sync';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Categories sync error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to sync categories',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Menu sync endpoint: POST /menu/sync (for D1 sync from POS)
    const menuSyncMatch = url.pathname.match(/^\/menu\/sync$/);
    if (menuSyncMatch && request.method === 'POST') {
      const tenantId = request.headers.get('X-Tenant-Id');
      if (!tenantId) {
        return Response.json({
          success: false,
          error: 'Missing X-Tenant-Id header',
        }, { status: 400, headers: CORS_HEADERS });
      }

      console.log(`[OrdersRouter] Menu sync for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/menu/sync';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Menu sync error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to sync menu',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Get categories: GET /api/categories/{tenantId}
    // Create category: POST /api/categories/{tenantId}
    const categoriesMatch = url.pathname.match(/^\/api\/categories\/([^\/]+)$/);
    if (categoriesMatch) {
      const tenantId = categoriesMatch[1];
      console.log(`[OrdersRouter] Categories ${request.method} for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/categories';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId
          },
          body: request.method === 'POST' ? request.body : undefined,
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Categories error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to process categories request',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== RESTAURANT SETTINGS ====================

    // Get restaurant settings: GET /api/settings/{tenantId}
    const settingsGetMatch = url.pathname.match(/^\/api\/settings\/([^\/]+)$/);
    if (settingsGetMatch && request.method === 'GET') {
      const tenantId = settingsGetMatch[1];
      console.log(`[OrdersRouter] Getting restaurant settings for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/settings';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Settings get error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to get restaurant settings',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Save restaurant settings: PUT /api/settings/{tenantId}
    const settingsPutMatch = url.pathname.match(/^\/api\/settings\/([^\/]+)$/);
    if (settingsPutMatch && request.method === 'PUT') {
      const tenantId = settingsPutMatch[1];
      console.log(`[OrdersRouter] Saving restaurant settings for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/settings';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Settings save error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to save restaurant settings',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== FLOOR PLAN ====================

    // Get floor plan: GET /api/floor-plan/{tenantId}
    const floorPlanGetMatch = url.pathname.match(/^\/api\/floor-plan\/([^\/]+)$/);
    if (floorPlanGetMatch && request.method === 'GET') {
      const tenantId = floorPlanGetMatch[1];
      console.log(`[OrdersRouter] Getting floor plan for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/floor-plan';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Floor plan get error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to get floor plan',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Save floor plan: PUT /api/floor-plan/{tenantId}
    const floorPlanPutMatch = url.pathname.match(/^\/api\/floor-plan\/([^\/]+)$/);
    if (floorPlanPutMatch && request.method === 'PUT') {
      const tenantId = floorPlanPutMatch[1];
      console.log(`[OrdersRouter] Saving floor plan for tenant: ${tenantId}`);

      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);

        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/floor-plan';

        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });

        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Floor plan save error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to save floor plan',
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== STAFF ====================

    // Get staff: GET /api/staff/{tenantId}
    const staffGetMatch = url.pathname.match(/^\/api\/staff\/([^\/]+)$/);
    if (staffGetMatch && request.method === 'GET') {
      const tenantId = staffGetMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/staff';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Staff get error:', error);
        return Response.json({ success: false, error: error.message || 'Failed to get staff' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Save staff: PUT /api/staff/{tenantId}
    const staffPutMatch = url.pathname.match(/^\/api\/staff\/([^\/]+)$/);
    if (staffPutMatch && request.method === 'PUT') {
      const tenantId = staffPutMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/staff';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Staff save error:', error);
        return Response.json({ success: false, error: error.message || 'Failed to save staff' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== DEVICES ====================

    // List devices: GET /api/devices/{tenantId}
    const devicesListMatch = url.pathname.match(/^\/api\/devices\/([^\/]+)$/);
    if (devicesListMatch && request.method === 'GET') {
      const tenantId = devicesListMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/devices';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Devices list error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Device heartbeat: POST /api/devices/{tenantId}/heartbeat
    const deviceHeartbeatMatch = url.pathname.match(/^\/api\/devices\/([^\/]+)\/heartbeat$/);
    if (deviceHeartbeatMatch && request.method === 'POST') {
      const tenantId = deviceHeartbeatMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/devices/heartbeat';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Device heartbeat error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Device actions: PATCH /api/devices/{tenantId}/{deviceId}/{action}
    const deviceActionMatch = url.pathname.match(/^\/api\/devices\/([^\/]+)\/([^\/]+)\/(suspend|revoke|name|reactivate)$/);
    if (deviceActionMatch && request.method === 'PATCH') {
      const [, tenantId, deviceId, action] = deviceActionMatch;
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/devices/${deviceId}/${action}`;
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error(`[OrdersRouter] Device ${action} error:`, error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== CHAINS ====================

    // Get chain: GET /api/chains/{chainId}
    const chainGetMatch = url.pathname.match(/^\/api\/chains\/([^\/]+)$/);
    if (chainGetMatch && request.method === 'GET') {
      const chainId = chainGetMatch[1];
      try {
        // Chain operations go to any tenant worker since they query TENANTS_DB
        const workerName = `tenant-system`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/chains/${chainId}`;
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': 'system' },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Get chain error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Create chain: POST /api/chains
    if (url.pathname === '/api/chains' && request.method === 'POST') {
      try {
        const workerName = `tenant-system`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/chains';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'system' },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Create chain error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Chain locations: GET/POST /api/chains/{chainId}/locations
    const chainLocationsMatch = url.pathname.match(/^\/api\/chains\/([^\/]+)\/locations$/);
    if (chainLocationsMatch) {
      const chainId = chainLocationsMatch[1];
      try {
        const workerName = `tenant-system`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/chains/${chainId}/locations`;
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: request.method,
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'system' },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Chain locations error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Location activation: POST /api/locations/activate
    if (url.pathname === '/api/locations/activate' && request.method === 'POST') {
      try {
        const body = await request.json() as { activation_code: string };
        const { activation_code } = body;

        // Validate code format
        if (!activation_code || !/^[A-Z0-9]{4}-[A-Z0-9]{4}-\d{4}$/.test(activation_code)) {
          return Response.json({
            success: false,
            error: 'Invalid activation code format. Expected: XXXX-XXXX-9999'
          }, { status: 400, headers: CORS_HEADERS });
        }

        console.log(`[LocationActivation] Validating code: ${activation_code}`);

        // Query TENANTS_DB for location by activation code
        const location = await env.TENANTS_DB.prepare(`
          SELECT
            location_id,
            location_tenant_id,
            location_name,
            chain_id,
            subdomain,
            address_line1,
            address_line2,
            city,
            state,
            pincode,
            phone,
            email,
            activation_code_used_at
          FROM location_tenants
          WHERE activation_code = ?1
        `).bind(activation_code).first();

        if (!location) {
          console.log(`[LocationActivation] Code not found: ${activation_code}`);
          return Response.json({
            success: false,
            error: 'Invalid activation code. Please check the code and try again.'
          }, { status: 404, headers: CORS_HEADERS });
        }

        // Check if code already used
        if (location.activation_code_used_at) {
          console.log(`[LocationActivation] Code already used: ${activation_code}`);
          return Response.json({
            success: false,
            error: 'This activation code has already been used. Please contact your administrator for a new code.',
            used_at: location.activation_code_used_at
          }, { status: 400, headers: CORS_HEADERS });
        }

        // Get master_tenant_id from chain
        const chain = await env.TENANTS_DB.prepare(`
          SELECT master_tenant_id, chain_name
          FROM restaurant_chains
          WHERE id = ?1
        `).bind(location.chain_id).first();

        if (!chain) {
          console.error(`[LocationActivation] Chain not found: ${location.chain_id}`);
          return Response.json({
            success: false,
            error: 'Chain configuration error. Please contact support.'
          }, { status: 500, headers: CORS_HEADERS });
        }

        // Mark code as used
        const deviceId = `device-${Date.now()}`;
        await env.TENANTS_DB.prepare(`
          UPDATE location_tenants
          SET activation_code_used_at = CURRENT_TIMESTAMP,
              activated_by_device_id = ?1
          WHERE location_id = ?2
        `).bind(deviceId, location.location_id).run();

        console.log(`[LocationActivation] ✅ Code validated and marked as used: ${activation_code}`);

        // Return location metadata for device setup
        return Response.json({
          success: true,
          location: {
            location_id: location.location_id,
            location_tenant_id: location.location_tenant_id,
            location_name: location.location_name,
            chain_id: location.chain_id,
            chain_name: chain.chain_name,
            master_tenant_id: chain.master_tenant_id,
            subdomain: location.subdomain,
            address: {
              line1: location.address_line1,
              line2: location.address_line2,
              city: location.city,
              state: location.state,
              pincode: location.pincode,
            },
            phone: location.phone,
            email: location.email,
          }
        }, { headers: CORS_HEADERS });

      } catch (error: any) {
        console.error('[LocationActivation] Error:', error);
        return Response.json({
          success: false,
          error: error.message || 'Failed to validate activation code'
        }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Chain menu operations: /api/chain/{tenantId}/menu/*
    const chainMenuMatch = url.pathname.match(/^\/api\/chain\/([^\/]+)\/menu\/(.+)$/);
    if (chainMenuMatch) {
      const [, tenantId, menuPath] = chainMenuMatch;
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/chain/${menuPath}`;
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: request.method,
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Chain menu error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Chain reports: GET /api/chains/{chainId}/reports/{reportType}
    const chainReportsMatch = url.pathname.match(/^\/api\/chains\/([^\/]+)\/reports\/(sales|menu|staff)$/);
    if (chainReportsMatch && request.method === 'GET') {
      const [, chainId, reportType] = chainReportsMatch;
      try {
        const workerName = `tenant-system`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/chains/${chainId}/reports/${reportType}`;
        const tenantRequest = new Request(tenantUrl.toString() + (url.search || ''), {
          method: 'GET',
          headers: { 'X-Tenant-Id': 'system' },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Chain reports error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Chain sales sync: POST /api/chain/{chainId}/location/{locationId}/sync-sales
    const chainSalesSyncMatch = url.pathname.match(/^\/api\/chain\/([^\/]+)\/location\/([^\/]+)\/sync-sales$/);
    if (chainSalesSyncMatch && request.method === 'POST') {
      const [, chainId, locationId] = chainSalesSyncMatch;
      console.log(`[OrdersRouter] Chain sales sync: chain=${chainId}, location=${locationId}`);
      try {
        const workerName = `tenant-system`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/chain/${chainId}/location/${locationId}/sync-sales`;
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'system' },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Chain sales sync error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Chain sales: GET /api/chain/{chainId}/sales
    const chainSalesMatch = url.pathname.match(/^\/api\/chain\/([^\/]+)\/sales$/);
    if (chainSalesMatch && request.method === 'GET') {
      const chainId = chainSalesMatch[1];
      try {
        const workerName = `tenant-system`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/chain/${chainId}/sales`;
        const tenantRequest = new Request(tenantUrl.toString() + (url.search || ''), {
          method: 'GET',
          headers: { 'X-Tenant-Id': 'system' },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Chain sales error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Chain sales summary: GET /api/chain/{chainId}/sales/summary
    const chainSalesSummaryMatch = url.pathname.match(/^\/api\/chain\/([^\/]+)\/sales\/summary$/);
    if (chainSalesSummaryMatch && request.method === 'GET') {
      const chainId = chainSalesSummaryMatch[1];
      try {
        const workerName = `tenant-system`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/chain/${chainId}/sales/summary`;
        const tenantRequest = new Request(tenantUrl.toString() + (url.search || ''), {
          method: 'GET',
          headers: { 'X-Tenant-Id': 'system' },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Chain sales summary error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== OUT OF STOCK ====================

    // Get out-of-stock: GET /api/out-of-stock/{tenantId}
    const oosGetMatch = url.pathname.match(/^\/api\/out-of-stock\/([^\/]+)$/);
    if (oosGetMatch && request.method === 'GET') {
      const tenantId = oosGetMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/out-of-stock';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Out-of-stock get error:', error);
        return Response.json({ success: false, error: error.message || 'Failed to get out-of-stock items' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Save out-of-stock: PUT /api/out-of-stock/{tenantId}
    const oosPutMatch = url.pathname.match(/^\/api\/out-of-stock\/([^\/]+)$/);
    if (oosPutMatch && request.method === 'PUT') {
      const tenantId = oosPutMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/out-of-stock';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Out-of-stock save error:', error);
        return Response.json({ success: false, error: error.message || 'Failed to save out-of-stock items' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== PRINTER CONFIG ====================

    // Get printer config: GET /api/printer-config/{tenantId}
    const printerGetMatch = url.pathname.match(/^\/api\/printer-config\/([^\/]+)$/);
    if (printerGetMatch && request.method === 'GET') {
      const tenantId = printerGetMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/printer-config';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Printer config get error:', error);
        return Response.json({ success: false, error: error.message || 'Failed to get printer config' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Save printer config: PUT /api/printer-config/{tenantId}
    const printerPutMatch = url.pathname.match(/^\/api\/printer-config\/([^\/]+)$/);
    if (printerPutMatch && request.method === 'PUT') {
      const tenantId = printerPutMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/printer-config';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Printer config save error:', error);
        return Response.json({ success: false, error: error.message || 'Failed to save printer config' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== AGGREGATOR SETTINGS ====================

    // Get aggregator settings: GET /api/aggregator-settings/{tenantId}
    const aggSettingsGetMatch = url.pathname.match(/^\/api\/aggregator-settings\/([^\/]+)$/);
    if (aggSettingsGetMatch && request.method === 'GET') {
      const tenantId = aggSettingsGetMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/aggregator-settings';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Aggregator settings get error:', error);
        return Response.json({ success: false, error: error.message || 'Failed to get aggregator settings' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Save aggregator settings: PUT /api/aggregator-settings/{tenantId}
    const aggSettingsPutMatch = url.pathname.match(/^\/api\/aggregator-settings\/([^\/]+)$/);
    if (aggSettingsPutMatch && request.method === 'PUT') {
      const tenantId = aggSettingsPutMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/aggregator-settings';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.body,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Aggregator settings save error:', error);
        return Response.json({ success: false, error: error.message || 'Failed to save aggregator settings' }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // ==================== INVENTORY MANAGEMENT ====================

    // Inventory suppliers: GET/POST /api/inventory/suppliers/{tenantId}
    const inventorySuppliersMatch = url.pathname.match(/^\/api\/inventory\/suppliers\/([^\/]+)$/);
    if (inventorySuppliersMatch && (request.method === 'GET' || request.method === 'POST')) {
      const tenantId = inventorySuppliersMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/inventory/suppliers';
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: request.method,
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.method === 'POST' ? request.body : undefined,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Inventory suppliers error:', error);
        return Response.json({ success: false, error: error.message || 'Inventory management not available for this tenant' }, { status: 503, headers: CORS_HEADERS });
      }
    }

    // Individual supplier: GET/PUT/DELETE /api/inventory/suppliers/{tenantId}/{supplierId}
    const inventorySupplierItemMatch = url.pathname.match(/^\/api\/inventory\/suppliers\/([^\/]+)\/([^\/]+)$/);
    if (inventorySupplierItemMatch && (request.method === 'GET' || request.method === 'PUT' || request.method === 'DELETE')) {
      const tenantId = inventorySupplierItemMatch[1];
      const supplierId = inventorySupplierItemMatch[2];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/inventory/suppliers/${supplierId}`;
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: request.method,
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.method === 'PUT' ? request.body : undefined,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Inventory supplier error:', error);
        return Response.json({ success: false, error: error.message || 'Inventory management not available for this tenant' }, { status: 503, headers: CORS_HEADERS });
      }
    }

    // Inventory items: GET/POST /api/inventory/items/{tenantId}
    const inventoryItemsMatch = url.pathname.match(/^\/api\/inventory\/items\/([^\/]+)$/);
    if (inventoryItemsMatch && (request.method === 'GET' || request.method === 'POST')) {
      const tenantId = inventoryItemsMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/inventory/items';
        tenantUrl.search = url.search; // Preserve query parameters
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: request.method,
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.method === 'POST' ? request.body : undefined,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Inventory items error:', error);
        return Response.json({ success: false, error: error.message || 'Inventory management not available for this tenant' }, { status: 503, headers: CORS_HEADERS });
      }
    }

    // Individual inventory item: GET/PUT/DELETE /api/inventory/items/{tenantId}/{itemId}
    const inventoryItemMatch = url.pathname.match(/^\/api\/inventory\/items\/([^\/]+)\/([^\/]+)$/);
    if (inventoryItemMatch && (request.method === 'GET' || request.method === 'PUT' || request.method === 'DELETE')) {
      const tenantId = inventoryItemMatch[1];
      const itemId = inventoryItemMatch[2];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = `/inventory/items/${itemId}`;
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: request.method,
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
          body: request.method === 'PUT' ? request.body : undefined,
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Inventory item error:', error);
        return Response.json({ success: false, error: error.message || 'Inventory management not available for this tenant' }, { status: 503, headers: CORS_HEADERS });
      }
    }

    // Inventory alias: GET /api/inventory/{tenantId} (maps to /inventory/items)
    const inventoryAliasMatch = url.pathname.match(/^\/api\/inventory\/([^\/]+)$/);
    if (inventoryAliasMatch && request.method === 'GET') {
      const tenantId = inventoryAliasMatch[1];
      try {
        const workerName = `tenant-${tenantId}`;
        const tenantWorker = env.TENANT_DISPATCH.get(workerName);
        const tenantUrl = new URL(request.url);
        tenantUrl.pathname = '/inventory';
        tenantUrl.search = url.search; // Preserve query parameters
        const tenantRequest = new Request(tenantUrl.toString(), {
          method: 'GET',
          headers: { 'X-Tenant-Id': tenantId },
        });
        const response = await tenantWorker.fetch(tenantRequest);
        const responseData = await response.json();
        return Response.json(responseData, { status: response.status, headers: CORS_HEADERS });
      } catch (error: any) {
        console.error('[OrdersRouter] Inventory error:', error);
        return Response.json({ success: false, error: error.message || 'Inventory management not available for this tenant' }, { status: 503, headers: CORS_HEADERS });
      }
    }

    // Internal notification endpoint (called by tenant workers)
    // Path: /internal/notify/{tenantId}/order-created or /internal/notify/{tenantId}/status-update
    if (url.pathname.startsWith('/internal/notify/')) {
      const notifyMatch = url.pathname.match(/^\/internal\/notify\/([^\/]+)\/(order-created|status-update)$/);
      if (notifyMatch) {
        const tenantId = notifyMatch[1];
        const notifyType = notifyMatch[2];

        console.log(`[OrdersRouter] Notification for tenant ${tenantId}: ${notifyType}`);

        const doId = env.ORDER_NOTIFICATION.idFromName(tenantId);
        const doStub = env.ORDER_NOTIFICATION.get(doId);

        // Forward to DO's notification endpoint
        const notifyUrl = new URL(request.url);
        notifyUrl.pathname = `/notify/${notifyType}`;

        return doStub.fetch(new Request(notifyUrl.toString(), {
          method: 'POST',
          headers: request.headers,
          body: request.body,
        }));
      }
      return Response.json({ error: 'Invalid notification path' }, { status: 400, headers: CORS_HEADERS });
    }

    // Extract tenant from path: /api/orders/{tenantId}/...
    // Also support: /orders/{tenantId}/...
    const match = url.pathname.match(/^\/(api\/)?orders\/([^\/]+)(\/.*)?$/);

    if (!match) {
      return Response.json({
        error: 'Invalid path. Expected: /api/orders/{tenantId} or /orders/{tenantId}',
      }, { status: 404, headers: CORS_HEADERS });
    }

    const tenantId = match[2];
    const subPath = match[3] || '';

    // Validate tenant exists (optional - can check KV)
    // const tenantConfig = await env.TENANT_METADATA.get(`tenant:storage:${tenantId}`, 'json');
    // if (!tenantConfig) {
    //   return Response.json({ error: `Tenant not found: ${tenantId}` }, { status: 404, headers: CORS_HEADERS });
    // }

    // Get tenant worker name
    const workerName = `tenant-${tenantId}`;

    // For POST requests, read the body BEFORE forwarding so we can use it for DO notification
    let originalBody: any = null;
    if (request.method === 'POST' && !subPath) {
      try {
        originalBody = await request.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS_HEADERS });
      }
    }

    try {
      console.log(`[OrdersRouter] Dispatching to ${workerName} for path /orders${subPath}`);

      // Dispatch to tenant worker
      const tenantWorker = env.TENANT_DISPATCH.get(workerName);

      // Rewrite URL path to /orders/...
      const tenantUrl = new URL(request.url);
      tenantUrl.pathname = `/orders${subPath}`;

      // Clone headers and add tenant ID
      const newHeaders = new Headers(request.headers);
      newHeaders.set('X-Tenant-Id', tenantId);

      // Clone request with new URL and tenant header
      // Use the already-parsed body for POST requests, otherwise use the original body stream
      const tenantRequest = new Request(tenantUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: originalBody ? JSON.stringify(originalBody) : (request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined),
      });

      // Forward to tenant worker
      const response = await tenantWorker.fetch(tenantRequest);

      // Clone the response body for reading
      const responseClone = response.clone();

      // If this was a POST to create an order and it succeeded, notify the DO
      if (request.method === 'POST' && !subPath && response.ok && originalBody) {
        try {
          const responseData = await responseClone.json() as any;
          if (responseData.success && responseData.orderId) {
            console.log(`[OrdersRouter] Order created, notifying DO: ${responseData.orderNumber}`);

            // Build notification payload using the pre-parsed originalBody
            const orderData = {
              orderId: responseData.orderId,
              orderNumber: responseData.orderNumber,
              orderType: originalBody.orderType,
              status: 'pending',
              createdAt: responseData.createdAt,
              customerName: originalBody.customerName || 'Guest',
              customerPhone: originalBody.customerPhone || null,
              tableNumber: originalBody.tableNumber || null,
              total: originalBody.total,
              source: originalBody.source || 'pos',
            };

            const kitchenOrder = {
              id: responseData.orderId,
              orderNumber: responseData.orderNumber,
              orderType: originalBody.orderType,
              source: originalBody.source || 'online',
              status: 'pending',
              items: (originalBody.items || []).map((item: any, index: number) => ({
                id: `${responseData.orderId}-item-${index}`,
                name: item.name,
                quantity: item.quantity,
                status: 'pending',
                modifiers: item.modifiers ? [item.modifiers] : [],
                specialInstructions: item.specialInstructions || null,
              })),
              createdAt: responseData.createdAt,
              estimatedPrepTime: 15,
              isUrgent: false,
              elapsedMinutes: 0,
              customer: {
                name: originalBody.customerName || 'Guest',
                phone: originalBody.customerPhone || null,
              },
              tableNumber: originalBody.tableNumber || null,
            };

            // Notify the Durable Object directly
            const doId = env.ORDER_NOTIFICATION.idFromName(tenantId);
            const doStub = env.ORDER_NOTIFICATION.get(doId);

            await doStub.fetch(new Request('https://do/notify/order-created', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: orderData, kitchenOrder }),
            }));

            console.log(`[OrdersRouter] Successfully notified DO for order ${responseData.orderNumber}`);
          }
        } catch (notifyError) {
          console.error('[OrdersRouter] Failed to notify DO:', notifyError);
          // Don't fail the request if notification fails
        }
      }

      // Add CORS headers to response
      const responseHeaders = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

    } catch (error: any) {
      console.error(`[OrdersRouter] Error dispatching to ${workerName}:`, error);

      // Check if it's a "worker not found" error
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        return Response.json({
          error: `Tenant worker not deployed: ${tenantId}`,
          hint: 'Run: npm run deploy:tenant -- <tenantId> <databaseId>',
        }, { status: 404, headers: CORS_HEADERS });
      }

      return Response.json({
        error: 'Failed to process order request',
        message: error.message,
      }, { status: 500, headers: CORS_HEADERS });
    }
  },
};

// ============================================================================
// HELPER: DNS verification for custom domains
// ============================================================================

/**
 * Verify that a domain's CNAME record points to the expected tenantId.handsfree.tech target.
 * Uses Cloudflare DNS-over-HTTPS for reliable resolution.
 */
async function verifyCustomDomainCNAME(
  domain: string,
  tenantId: string,
): Promise<{ valid: boolean; cnameTarget: string | null }> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=CNAME`,
      { headers: { Accept: 'application/dns-json' } },
    );
    const data = await res.json() as any;
    // Strip trailing dot from CNAME target (standard DNS format)
    const cnameTarget = data.Answer?.[0]?.data?.replace(/\.$/, '') ?? null;
    const expected = `${tenantId}.handsfree.tech`;
    const valid = cnameTarget === expected;
    return { valid, cnameTarget };
  } catch {
    return { valid: false, cnameTarget: null };
  }
}
