/**
 * Tenant Management Router Worker
 *
 * Routes device management and chain (multi-location) requests to tenant-specific workers.
 * Keeps tenant management separate from orders processing for better separation of concerns.
 */

interface Env {
  TENANT_DISPATCH: any; // Dispatch namespace binding
  TENANT_METADATA: any; // KV namespace binding
  ENVIRONMENT?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id, X-Device-Id',
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
        service: 'tenant-management',
        timestamp: new Date().toISOString(),
      }, { headers: CORS_HEADERS });
    }

    try {
      // ==================== DEVICE MANAGEMENT ====================

      // List devices: GET /api/devices/{tenantId}
      const devicesListMatch = url.pathname.match(/^\/api\/devices\/([^\/]+)$/);
      if (devicesListMatch && request.method === 'GET') {
        const tenantId = devicesListMatch[1];
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
      }

      // Device heartbeat: POST /api/devices/{tenantId}/heartbeat
      const deviceHeartbeatMatch = url.pathname.match(/^\/api\/devices\/([^\/]+)\/heartbeat$/);
      if (deviceHeartbeatMatch && request.method === 'POST') {
        const tenantId = deviceHeartbeatMatch[1];
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
      }

      // Device actions: PATCH /api/devices/{tenantId}/{deviceId}/{action}
      const deviceActionMatch = url.pathname.match(/^\/api\/devices\/([^\/]+)\/([^\/]+)\/(suspend|revoke|name|reactivate)$/);
      if (deviceActionMatch && request.method === 'PATCH') {
        const [, tenantId, deviceId, action] = deviceActionMatch;
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
      }

      // ==================== MULTI-LOCATION (CHAINS) ====================

      // Get chain: GET /api/chains/{chainId}
      const chainGetMatch = url.pathname.match(/^\/api\/chains\/([^\/]+)$/);
      if (chainGetMatch && request.method === 'GET') {
        const chainId = chainGetMatch[1];
        // Chain operations can go to any tenant worker since they query TENANTS_DB
        // Use a system worker or the first available tenant
        const workerName = `tenant-zatar-7201`; // Use a specific tenant for system operations
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
      }

      // Create chain: POST /api/chains
      if (url.pathname === '/api/chains' && request.method === 'POST') {
        const workerName = `tenant-zatar-7201`;
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
      }

      // Chain locations: GET/POST /api/chains/{chainId}/locations
      const chainLocationsMatch = url.pathname.match(/^\/api\/chains\/([^\/]+)\/locations$/);
      if (chainLocationsMatch) {
        const chainId = chainLocationsMatch[1];
        const workerName = `tenant-zatar-7201`;
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
      }

      // Chain menu operations: /api/chain/{tenantId}/menu/*
      const chainMenuMatch = url.pathname.match(/^\/api\/chain\/([^\/]+)\/menu\/(.+)$/);
      if (chainMenuMatch) {
        const [, tenantId, menuPath] = chainMenuMatch;
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
      }

      // Chain reports: GET /api/chains/{chainId}/reports/{reportType}
      const chainReportsMatch = url.pathname.match(/^\/api\/chains\/([^\/]+)\/reports\/(sales|menu|staff)$/);
      if (chainReportsMatch && request.method === 'GET') {
        const [, chainId, reportType] = chainReportsMatch;
        const workerName = `tenant-zatar-7201`;
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
      }

      // No matching route
      return Response.json({
        error: 'Not found',
        path: url.pathname,
        hint: 'Expected /api/devices/{tenantId} or /api/chains/{chainId}'
      }, { status: 404, headers: CORS_HEADERS });

    } catch (error: any) {
      console.error('[TenantManagement] Error:', error);

      // Check if it's a "worker not found" error
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        return Response.json({
          error: 'Tenant worker not found',
          hint: 'The tenant worker may not be deployed yet',
          details: error.message
        }, { status: 404, headers: CORS_HEADERS });
      }

      return Response.json({
        error: 'Internal server error',
        message: error.message,
      }, { status: 500, headers: CORS_HEADERS });
    }
  },
};
