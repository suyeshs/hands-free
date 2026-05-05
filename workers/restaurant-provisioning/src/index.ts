/**
 * Restaurant Provisioning Worker
 *
 * Direct API for POS systems to provision new restaurant tenants.
 * No middleman - handles complete end-to-end provisioning.
 */

import { RestaurantProvisioningService, type RestaurantProvisioningRequest } from './core/restaurant-provisioning-service';
import { getCloudflareStorageToken, initTokenManager } from './lib/token-manager';

// Export Durable Object
export { ProvisioningCoordinator } from './durable-objects/ProvisioningCoordinator';

// Helper function to create KV namespace with idempotency
async function createKVNamespace(env: CloudflareEnv, title: string, description: string): Promise<string> {
  initTokenManager(env);
  const apiToken = await getCloudflareStorageToken();

  // Try to create the namespace
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    }
  );

  if (response.ok) {
    const result = await response.json() as any;
    return result.result.id;
  }

  // Check if it already exists (idempotency)
  const errorData = await response.json() as any;
  if (errorData.errors?.[0]?.code === 10014) {
    // Namespace already exists - fetch the existing one
    console.log(`[KV] Namespace ${title} already exists (error 10014), attempting to fetch existing ID...`);

    try {
      const listResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
          },
        }
      );

      console.log(`[KV] List namespaces response status: ${listResponse.status}`);

      if (!listResponse.ok) {
        const listError = await listResponse.text();
        console.error(`[KV] Failed to list namespaces:`, listError);
        throw new Error(`Failed to list KV namespaces: ${listError}`);
      }

      const listResult = await listResponse.json() as any;
      console.log(`[KV] Found ${listResult.result?.length || 0} total namespaces`);

      const existing = listResult.result.find((ns: any) => ns.title === title);
      if (existing) {
        console.log(`[KV] ✅ Found existing namespace ${title}: ${existing.id}`);
        return existing.id;
      } else {
        console.error(`[KV] ❌ Namespace ${title} not found in list despite error 10014!`);
        console.error(`[KV] Available namespaces:`, listResult.result?.map((ns: any) => ns.title).join(', '));

        // Wait 5 seconds for initial propagation, then retry with exponential backoff
        console.log(`[KV] Waiting 5 seconds for API propagation before retrying...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log(`[KV] Retrying with exponential backoff (5 attempts, up to 62 seconds total)...`);

        // Exponential backoff: 2s, 4s, 8s, 16s, 32s = 62 seconds total
        for (let attempt = 0; attempt < 5; attempt++) {
          const waitTime = Math.min(2000 * Math.pow(2, attempt), 32000);

          if (attempt > 0) {
            console.log(`[KV] Waiting ${waitTime}ms before retry attempt ${attempt + 1}/5...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }

          const retryListResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`,
            {
              headers: {
                'Authorization': `Bearer ${apiToken}`,
              },
            }
          );

          if (retryListResponse.ok) {
            const retryListResult = await retryListResponse.json() as any;
            const retryExisting = retryListResult.result.find((ns: any) => ns.title === title);
            if (retryExisting) {
              console.log(`[KV] ✅ Found existing namespace ${title} on retry attempt ${attempt + 1}: ${retryExisting.id}`);
              return retryExisting.id;
            }
            console.log(`[KV] Retry attempt ${attempt + 1}/5 - namespace still not found, continuing...`);
          }
        }

        console.error(`[KV] ❌ After 5 retry attempts (67 seconds total), namespace ${title} still not found`);
        console.error(`[KV] This is a Cloudflare eventual consistency issue - the namespace exists but isn't visible yet`);

        throw new Error(
          `KV namespace "${title}" exists but cannot be found in list after 5 retries (67 seconds). ` +
          `This may be due to API propagation delays. Please retry provisioning in a few minutes.`
        );
      }
    } catch (listError: any) {
      console.error(`[KV] Error during idempotency check:`, listError);
      throw new Error(`Failed to handle existing KV namespace ${title}: ${listError.message}`);
    }
  }

  throw new Error(`Failed to create KV namespace ${title}: ${JSON.stringify(errorData)}`);
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'restaurant-provisioning',
        version: env.SERVICE_VERSION || '1.0.0',
        timestamp: new Date().toISOString(),
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Verify tenant activation code (for mobile app auth)
    if (url.pathname === '/api/verify-tenant' && request.method === 'POST') {
      try {
        const body = await request.json() as { activationCode: string };

        if (!body.activationCode) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Activation code is required',
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        // Normalize activation code (remove hyphens and uppercase)
        const normalizedCode = body.activationCode.replace(/-/g, '').toUpperCase();
        const activationKey = `pos_activation:${normalizedCode}`;

        // Check KV for activation code
        const activationDataStr = await env.TENANT_METADATA.get(activationKey);

        if (!activationDataStr) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid or expired activation code',
          }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        const activationData = JSON.parse(activationDataStr);

        // Check if activation code has been used
        if (activationData.usedAt) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Activation code has already been used',
          }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        // Get tenant details from TENANTS_DB
        const tenant = await env.TENANTS_DB.prepare(
          `SELECT tenant_id, company_name, subdomain, full_domain, phone, email, business_category
           FROM restaurant_tenants
           WHERE tenant_id = ?`
        ).bind(activationData.tenantId).first();

        if (!tenant) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Tenant not found',
          }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        // Return tenant details
        return new Response(JSON.stringify({
          success: true,
          tenantId: tenant.tenant_id,
          tenantName: tenant.company_name,
          subdomain: tenant.subdomain,
          apiUrl: `https://${tenant.subdomain}.handsfree.tech`,
          fullDomain: tenant.full_domain,
          businessCategory: tenant.business_category,
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });

      } catch (error: any) {
        console.error('[API] Error verifying tenant:', error);

        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Failed to verify activation code',
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    // Provision restaurant endpoint
    if (url.pathname === '/api/provision' && request.method === 'POST') {
      try {
        const body = await request.json() as RestaurantProvisioningRequest;

        // Validate required fields
        if (!body.tenantId || !body.companyName || !body.email) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: tenantId, companyName, email',
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        console.log(`[API] ASYNC provisioning request for tenant: ${body.tenantId}`);
        console.log(`[API] Company: ${body.companyName}`);
        console.log(`[API] Email: ${body.email}`);
        if (body.ownerName) console.log(`[API] Owner: ${body.ownerName}`);

        const { tenantId } = body;
        const subdomain = tenantId.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').substring(0, 63);
        const fullDomain = `${subdomain}.${env.BASE_DOMAIN}`;
        const storeUrl = `https://${fullDomain}`;

        // STEP 1: Quick sync operations (10-15s)

        // Generate activation code immediately
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 16; i++) {
          code += chars[Math.floor(Math.random() * chars.length)];
        }
        const activationCode = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
        const normalizedCode = activationCode.replace(/-/g, '').toUpperCase();

        console.log(`[API] Generated activation code: ${activationCode}`);

        // Create only KV namespaces (fast operations)
        const kvDataId = await createKVNamespace(env, `${subdomain}_data`, `Data storage for ${subdomain}`);
        const kvCacheId = await createKVNamespace(env, `${subdomain}_cache`, `Cache for ${subdomain}`);
        const kvSessionsId = await createKVNamespace(env, `${subdomain}_sessions`, `Sessions for ${subdomain}`);

        console.log(`[API] KV namespaces created: data=${kvDataId}, cache=${kvCacheId}, sessions=${kvSessionsId}`);

        const kvNamespaces = {
          data: kvDataId,
          cache: kvCacheId,
          sessions: kvSessionsId,
        };

        // Store activation code in KV
        const now = new Date().toISOString();
        const activationKey = `pos_activation:${normalizedCode}`;
        await env.TENANT_METADATA.put(activationKey, JSON.stringify({
          tenantId,
          companyName: body.companyName,
          ownerName: body.ownerName,
          createdAt: now,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        }));

        // Store basic tenant metadata
        await env.TENANT_METADATA.put(`tenant:${tenantId}`, JSON.stringify({
          tenant_id: tenantId,
          subdomain,
          full_domain: fullDomain,
          kv_namespace_id: kvDataId,
          owner_name: body.ownerName,
          provisioningStatus: 'in_progress',
          created_at: now,
        }));

        console.log(`[API] Activation code and metadata stored in KV`);

        // STEP 2: Initialize Durable Object for async provisioning

        const doId = env.PROVISIONING_DO.idFromName(tenantId);
        const doStub = env.PROVISIONING_DO.get(doId);

        // Start async provisioning (non-blocking)
        const doResponse = await doStub.fetch('https://provisioning/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            request: body,
            kvNamespaces,
            activationCode,
          })
        });

        if (!doResponse.ok) {
          throw new Error('Failed to start background provisioning');
        }

        console.log(`[API] Background provisioning started via Durable Object`);

        // STEP 3: Return immediately (~15 seconds total)

        return new Response(JSON.stringify({
          success: true,
          tenantId,
          subdomain,
          fullDomain,
          storeUrl,
          activationCode,
          storage: {
            kvNamespaceData: kvDataId,
            kvNamespaceCache: kvCacheId,
            kvNamespaceSessions: kvSessionsId,
          },
          provisioning: {
            status: 'in_progress',
            d1Ready: false,
            r2Ready: false,
            progressPercent: 40, // KV done, D1/R2 pending
          },
          provisioningWebSocket: `wss://${request.headers.get('host') || 'handsfree-restaurant-provisioning.suyesh.workers.dev'}/provisioning/${tenantId}/ws`,
          createdAt: now,
        }), {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });

      } catch (error: any) {
        console.error('[API] Error processing provision request:', error);
        console.error('[API] Error stack:', error.stack);

        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Internal server error',
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    // Check provisioning status
    if (url.pathname.startsWith('/api/status/') && request.method === 'GET') {
      const tenantId = url.pathname.split('/').pop();

      if (!tenantId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Tenant ID required',
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      try {
        // Check if tenant exists in TENANTS_DB
        const result = await env.TENANTS_DB.prepare(
          `SELECT tenant_id, company_name, subdomain, full_domain, store_url, status, created_at, d1_database_id
           FROM restaurant_tenants
           WHERE tenant_id = ?`
        ).bind(tenantId).first();

        if (!result) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Tenant not found',
          }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          tenant: result,
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });

      } catch (error: any) {
        console.error('[API] Error checking status:', error);

        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Failed to check status',
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    // WebSocket endpoint for real-time provisioning updates
    if (url.pathname.startsWith('/provisioning/') && url.pathname.endsWith('/ws') && request.method === 'GET') {
      const pathParts = url.pathname.split('/');
      const tenantId = pathParts[pathParts.length - 2];

      if (!tenantId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Tenant ID required',
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      try {
        // Get Durable Object instance for this tenant
        const doId = env.PROVISIONING_DO.idFromName(tenantId);
        const doStub = env.PROVISIONING_DO.get(doId);

        // Forward WebSocket upgrade to Durable Object
        return doStub.fetch(request);
      } catch (error: any) {
        console.error('[API] Error connecting to WebSocket:', error);

        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Failed to connect to provisioning status',
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    // Chain location provisioning endpoint
    // POST /api/provision/chain-location
    if (url.pathname === '/api/provision/chain-location' && request.method === 'POST') {
      try {
        const body = await request.json() as {
          masterTenantId: string;
          restaurantName: string;
          companyName: string;
          ownerName?: string;
          email: string;
          phone?: string;
          city?: string;
          pincode?: string;
          restaurantType?: string;
          subdomain: string;
        };

        if (!body.masterTenantId || !body.companyName || !body.email || !body.subdomain) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: masterTenantId, companyName, email, subdomain',
          }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        // Use the pre-computed subdomain as the tenantId (consistent with chainStore logic)
        const tenantId = body.subdomain;
        const subdomain = tenantId;
        const fullDomain = `${subdomain}.${env.BASE_DOMAIN}`;
        const storeUrl = `https://${fullDomain}`;

        console.log(`[ChainLocation] Provisioning chain location tenant: ${tenantId}`);
        console.log(`[ChainLocation] Master tenant: ${body.masterTenantId}`);
        console.log(`[ChainLocation] Company: ${body.companyName}, Location: ${body.restaurantName}`);

        // Generate activation code immediately
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 16; i++) {
          code += chars[Math.floor(Math.random() * chars.length)];
        }
        const activationCode = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
        const normalizedCode = activationCode.replace(/-/g, '').toUpperCase();

        console.log(`[ChainLocation] Generated activation code: ${activationCode}`);

        // Create KV namespaces (fast sync operations)
        const kvDataId = await createKVNamespace(env, `${subdomain}_data`, `Data storage for ${subdomain}`);
        const kvCacheId = await createKVNamespace(env, `${subdomain}_cache`, `Cache for ${subdomain}`);
        const kvSessionsId = await createKVNamespace(env, `${subdomain}_sessions`, `Sessions for ${subdomain}`);

        const kvNamespaces = { data: kvDataId, cache: kvCacheId, sessions: kvSessionsId };
        const now = new Date().toISOString();

        // Store activation code in KV
        await env.TENANT_METADATA.put(`pos_activation:${normalizedCode}`, JSON.stringify({
          tenantId,
          companyName: body.companyName,
          ownerName: body.ownerName,
          masterTenantId: body.masterTenantId,
          createdAt: now,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        }));

        // Store basic tenant metadata in KV (completed by DO when D1/R2 finish)
        await env.TENANT_METADATA.put(`tenant:${tenantId}`, JSON.stringify({
          tenantId,
          subdomain,
          fullDomain,
          storeUrl,
          masterTenantId: body.masterTenantId,
          companyName: body.companyName,
          locationName: body.restaurantName,
          ownerName: body.ownerName,
          kv_namespace_id: kvDataId,
          activationCode,
          provisioningStatus: 'in_progress',
          createdAt: now,
        }));

        console.log(`[ChainLocation] Activation code and KV metadata stored`);

        // Fire off Durable Object for async D1 + R2 + worker deployment
        const doId = env.PROVISIONING_DO.idFromName(tenantId);
        const doStub = env.PROVISIONING_DO.get(doId);

        const doResponse = await doStub.fetch('https://provisioning/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            request: {
              tenantId,
              companyName: body.companyName,
              ownerName: body.ownerName,
              email: body.email,
              phone: body.phone,
              city: body.city,
              pincode: body.pincode,
              restaurantType: body.restaurantType,
              subdomain,
              masterTenantId: body.masterTenantId,
              locationName: body.restaurantName,
            },
            kvNamespaces,
            activationCode,
          }),
        });

        if (!doResponse.ok) {
          throw new Error('Failed to start background provisioning');
        }

        console.log(`[ChainLocation] Background provisioning started via Durable Object`);

        return new Response(JSON.stringify({
          success: true,
          provisioningId: tenantId,
          tenantId,
          subdomain,
          fullDomain,
          storeUrl,
          activationCode,
          storage: {
            kvNamespaceData: kvDataId,
            kvNamespaceCache: kvCacheId,
            kvNamespaceSessions: kvSessionsId,
          },
          provisioning: {
            status: 'in_progress',
            d1Ready: false,
            r2Ready: false,
            progressPercent: 40,
          },
          createdAt: now,
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

      } catch (error: any) {
        console.error('[ChainLocation] Error processing chain location provision request:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Internal server error',
        }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // Chain location provisioning status endpoint
    // GET /api/provision/chain-location/status/:provisioningId
    const chainLocationStatusMatch = url.pathname.match(/^\/api\/provision\/chain-location\/status\/([^/]+)$/);
    if (chainLocationStatusMatch && request.method === 'GET') {
      const provisioningId = chainLocationStatusMatch[1];

      try {
        // Query the Durable Object for current status
        const doId = env.PROVISIONING_DO.idFromName(provisioningId);
        const doStub = env.PROVISIONING_DO.get(doId);
        const doResponse = await doStub.fetch('https://provisioning/status');

        if (!doResponse.ok) {
          return new Response(JSON.stringify({
            status: 'provisioning',
            message: 'Initializing...',
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        const doStatus = await doResponse.json() as any;

        // Map DO status to the format chainStore polling expects
        if (doStatus.status === 'complete') {
          // Fetch the full tenant metadata from KV to build cloudflareResources
          const tenantMeta = await env.TENANT_METADATA.get(`tenant:${provisioningId}`, 'json') as any;

          return new Response(JSON.stringify({
            status: 'completed',
            result: {
              tenantId: provisioningId,
              activationCode: tenantMeta?.activationCode || '',
              cloudflareResources: {
                d1DatabaseId: doStatus.resourceIds?.d1DatabaseId || tenantMeta?.databaseId || '',
                kvNamespaceId: tenantMeta?.kvNamespaceData || tenantMeta?.kv_namespace_id || '',
                r2BucketName: doStatus.resourceIds?.r2BucketName || '',
                workerUrl: tenantMeta?.storeUrl || `https://${provisioningId}.${env.BASE_DOMAIN}`,
              },
            },
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        if (doStatus.status === 'failed') {
          return new Response(JSON.stringify({
            status: 'failed',
            error: doStatus.error || 'Provisioning failed',
            message: doStatus.currentStep,
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        // Still in progress
        return new Response(JSON.stringify({
          status: 'provisioning',
          message: doStatus.currentStep || 'Provisioning infrastructure...',
          progressPercent: doStatus.progressPercent || 50,
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

      } catch (error: any) {
        console.error('[ChainLocation] Error checking provisioning status:', error);
        return new Response(JSON.stringify({
          status: 'provisioning',
          message: 'Checking status...',
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // Admin: list all tenants with activation codes
    if (url.pathname === '/admin/tenants' && request.method === 'GET') {
      // Basic auth: Authorization: Bearer <CLOUDFLARE_DISPATCH_TOKEN>
      const authHeader = request.headers.get('Authorization') || '';
      const expectedToken = env.CLOUDFLARE_DISPATCH_TOKEN || env.CLOUDFLARE_API_TOKEN || '';
      if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return new Response('Unauthorized', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer realm="Admin"' },
        });
      }

      try {
        // 1. List all tenant:* keys from KV
        const tenantList = await env.TENANT_METADATA.list({ prefix: 'tenant:' });

        // 2. Fetch all tenant metadata in parallel
        const tenantValues = await Promise.all(
          tenantList.keys.map(k => env.TENANT_METADATA.get(k.name))
        );

        // 3. Parse each tenant's metadata
        const tenants: Array<{
          tenantId: string;
          companyName: string;
          email: string;
          status: string;
          activationCode: string;
          masterTenantId: string | null;
          d1DatabaseId: string;
          createdAt: string;
          subdomain: string;
        }> = [];

        tenantList.keys.forEach((key, i) => {
          const raw = tenantValues[i];
          if (!raw) return;
          const d = JSON.parse(raw) as any;
          const tenantId: string = d.tenantId || key.name.replace('tenant:', '');
          const activationCode: string = d.activationCode || '—';
          const formatted = activationCode !== '—' && !activationCode.includes('-')
            ? activationCode.replace(/(.{4})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4')
            : activationCode;
          tenants.push({
            tenantId,
            companyName: d.companyName || d.company_name || '—',
            email: d.email || '—',
            status: d.status || d.provisioningStatus || '—',
            activationCode: formatted,
            masterTenantId: d.masterTenantId || null,
            d1DatabaseId: d.databaseId || d.d1_database_id || d.resourceIds?.d1DatabaseId || '—',
            createdAt: d.createdAt || d.created_at || '—',
            subdomain: d.subdomain || tenantId,
          });
        });

        // Sort newest first
        tenants.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        const rows = tenants.map(t => {
          const statusColor = t.status === 'active' || t.status === 'complete' ? '#16a34a' : '#dc2626';
          const isChain = t.masterTenantId ? `<span style="color:#7c3aed;font-size:11px">↳ ${t.masterTenantId}</span>` : '';
          return `<tr>
            <td><code style="font-size:12px">${t.tenantId}</code>${isChain ? '<br>' + isChain : ''}</td>
            <td>${t.companyName}</td>
            <td>${t.email}</td>
            <td><span style="color:${statusColor};font-weight:600">${t.status}</span></td>
            <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px;letter-spacing:1px">${t.activationCode}</code></td>
            <td><code style="font-size:11px;color:#64748b">${t.d1DatabaseId.substring(0, 8)}…</code></td>
            <td style="font-size:12px;color:#64748b">${t.createdAt.substring(0, 19).replace('T', ' ')}</td>
          </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tenant Admin — Handsfree POS</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;padding:24px}
    h1{font-size:22px;font-weight:700;margin-bottom:4px}
    .meta{font-size:13px;color:#64748b;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden}
    th{background:#1e293b;color:#f8fafc;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:10px 14px;text-align:left}
    td{padding:10px 14px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:13px}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#f8fafc}
    .count{display:inline-block;background:#3b82f6;color:#fff;border-radius:12px;padding:2px 10px;font-size:12px;margin-left:8px;vertical-align:middle}
  </style>
</head>
<body>
  <h1>Handsfree POS — Tenants <span class="count">${tenants.length}</span></h1>
  <p class="meta">Generated ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC · Sorted newest first</p>
  <table>
    <thead>
      <tr>
        <th>Tenant ID</th>
        <th>Company</th>
        <th>Email</th>
        <th>Status</th>
        <th>Activation Code</th>
        <th>D1 Database</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

        return new Response(html, {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      } catch (err: any) {
        return new Response(`Error: ${err.message}`, { status: 500 });
      }
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not found',
      available_endpoints: [
        'GET /health',
        'POST /api/provision',
        'POST /api/provision/chain-location',
        'GET /api/provision/chain-location/status/{provisioningId}',
        'GET /api/status/{tenantId}',
        'GET /provisioning/{tenantId}/ws',
        'GET /admin/tenants (Bearer auth)',
      ],
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  },
};
