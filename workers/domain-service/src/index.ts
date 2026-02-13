import type { 
  DomainRequest, 
  DomainStatus, 
  ValidationInstructions,
  DomainMetrics,
  HealthCheckResponse,
  SubdomainAssignRequest,
  SubdomainUpdateRequest
} from '../types/domain';
import type { 
  APIResponse, 
  PaginatedResponse, 
  DomainListQuery,
  HealthCheckResponse as APIHealthCheckResponse 
} from '../types/api';

import { DomainValidator } from '../utils/validation';
import { CloudflareAPI } from '../utils/cloudflare-api';
import { SubdomainService } from './core/subdomain-service';
import { ProvisioningTracker } from './core/provisioning-tracker';
import { DatabaseProvisioner } from './core/database-provisioner';
import { initTokenManager, getCloudflareStorageToken } from './lib/token-manager';
import { TenantSecretsManager, generateTenantEncryptionKey, type SecretType, type SecretEnvironment } from './lib/tenant-secrets';
import * as CustomerManager from './lib/customer-manager';
import * as CustomerCache from './lib/customer-cache';
import * as CustomerTags from './lib/customer-tags';
import { hashPhoneNumber } from './lib/customer-encryption';

// Export Durable Objects
export { DeploymentStatusDO } from './durable-objects/deployment-status';

// Main service worker
export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    // Initialize token manager for service binding access
    initTokenManager(env);

    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
    };

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let response: Response;

      // API Routes
      switch (true) {
        // Subdomain management
        case method === 'POST' && path === '/api/subdomains/assign':
          response = await handleAutoAssignSubdomain(request, env);
          break;
        case method === 'POST' && path === '/api/subdomains/provision-database':
          response = await handleProvisionDatabase(request, env);
          break;
        case method === 'GET' && path === '/api/subdomains':
          response = await handleGetTenantSubdomain(request, env);
          break;
        case method === 'PUT' && path === '/api/subdomains':
          response = await handleUpdateTenantSubdomain(request, env);
          break;
        case method === 'DELETE' && path === '/api/subdomains':
          response = await handleDeleteTenantSubdomain(request, env);
          break;
        case method === 'POST' && path === '/api/subdomains/check-availability':
          response = await handleCheckSubdomainAvailability(request, env);
          break;
        case method === 'POST' && path === '/api/subdomains/fix-dns':
          response = await handleFixDNS(request, env);
          break;
        case method === 'DELETE' && path.startsWith('/api/subdomains/delete/'):
          response = await handleDeleteSubdomain(request, env);
          break;
        case method === 'POST' && path === '/api/cleanup/dns-records':
          response = await handleCleanupDNSRecords(request, env);
          break;
        case method === 'GET' && path.startsWith('/api/cleanup/dns-records/'):
          response = await handleListDNSRecords(request, env);
          break;
        case method === 'POST' && path === '/api/cleanup/bulk-delete':
          response = await handleBulkDeleteDNSRecords(request, env);
          break;

        // Domain management
        case method === 'POST' && path === '/api/domains':
          response = await handleAddDomain(request, env);
          break;
        case method === 'GET' && path === '/api/domains':
          response = await handleListDomains(request, env);
          break;
        case method === 'PUT' && path.startsWith('/api/domains/'):
          response = await handleUpdateDomain(request, env, path);
          break;
        case method === 'DELETE' && path.startsWith('/api/domains/'):
          response = await handleDeleteDomain(request, env, path);
          break;
        case method === 'GET' && path.startsWith('/api/domains/') && path.endsWith('/status'):
          response = await handleGetDomainStatus(request, env, path);
          break;
        case method === 'POST' && path.startsWith('/api/domains/') && path.endsWith('/validate'):
          response = await handleValidateDomain(request, env, path);
          break;
        case method === 'POST' && path.startsWith('/api/domains/') && path.endsWith('/activate'):
          response = await handleActivateDomain(request, env, path);
          break;
        case method === 'POST' && path.startsWith('/api/domains/') && path.endsWith('/suspend'):
          response = await handleSuspendDomain(request, env, path);
          break;
        case method === 'POST' && path.startsWith('/api/domains/') && path.endsWith('/health-check'):
          response = await handleHealthCheck(request, env, path);
          break;

        // Validation instructions
        case method === 'GET' && path.startsWith('/api/domains/') && path.endsWith('/instructions'):
          response = await handleGetValidationInstructions(request, env, path);
          break;

        // Tenant metrics
        case method === 'GET' && path === '/api/tenants/metrics':
          response = await handleGetTenantMetrics(request, env);
          break;

        // Provisioning status (NEW)
        case method === 'GET' && path === '/api/provisioning/status':
          response = await handleGetProvisioningStatus(request, env);
          break;

        // Tenant secrets management
        case method === 'POST' && path === '/api/tenant-secrets':
          response = await handleStoreSecret(request, env);
          break;
        case method === 'GET' && path === '/api/tenant-secrets':
          response = await handleListSecrets(request, env);
          break;
        case method === 'DELETE' && path.startsWith('/api/tenant-secrets/'):
          response = await handleDeleteSecret(request, env);
          break;

        // Customer management
        case method === 'POST' && path === '/api/customers':
          response = await handleUpsertCustomer(request, env);
          break;
        case method === 'GET' && path === '/api/customers':
          response = await handleListCustomers(request, env);
          break;
        case method === 'GET' && path.startsWith('/api/customers/phone/'):
          response = await handleGetCustomerByPhone(request, env);
          break;
        case method === 'GET' && path.startsWith('/api/customers/') && !path.includes('/tags') && !path.includes('/addresses'):
          response = await handleGetCustomer(request, env);
          break;
        case method === 'PATCH' && path.startsWith('/api/customers/'):
          response = await handleUpdateCustomer(request, env);
          break;
        case method === 'DELETE' && path.startsWith('/api/customers/'):
          response = await handleDeleteCustomer(request, env);
          break;

        // Customer tags
        case method === 'GET' && path.startsWith('/api/customers/') && path.endsWith('/tags'):
          response = await handleGetCustomerTags(request, env);
          break;
        case method === 'POST' && path.startsWith('/api/customers/') && path.endsWith('/tags'):
          response = await handleAssignTag(request, env);
          break;
        case method === 'DELETE' && path.match(/\/api\/customers\/[^/]+\/tags\/[^/]+$/):
          response = await handleRemoveTag(request, env);
          break;

        // Tag definitions
        case method === 'GET' && path === '/api/tag-definitions':
          response = await handleGetTagDefinitions(request, env);
          break;
        case method === 'POST' && path === '/api/tag-definitions':
          response = await handleCreateTagDefinition(request, env);
          break;
        case method === 'PATCH' && path.startsWith('/api/tag-definitions/'):
          response = await handleUpdateTagDefinition(request, env);
          break;
        case method === 'DELETE' && path.startsWith('/api/tag-definitions/'):
          response = await handleDeleteTagDefinition(request, env);
          break;
        case method === 'GET' && path === '/api/tag-definitions/stats':
          response = await handleGetTagStats(request, env);
          break;

        // Customer addresses
        case method === 'GET' && path.startsWith('/api/customers/') && path.endsWith('/addresses'):
          response = await handleGetCustomerAddresses(request, env);
          break;
        case method === 'POST' && path.startsWith('/api/customers/') && path.endsWith('/addresses'):
          response = await handleAddCustomerAddress(request, env);
          break;

        // Deployment status endpoints (Durable Object)
        case path.startsWith('/deployment-status/'):
          response = await handleDeploymentStatus(request, env);
          break;

        // Health check
        case method === 'GET' && path === '/api/health':
          response = await handleServiceHealthCheck(env);
          break;

        // Test endpoints
        case method === 'GET' && path === '/test':
          response = await handleTestUI();
          break;
        case method === 'POST' && path === '/api/test/workflow':
          response = await handleRunWorkflowTest(request, env);
          break;
        case method === 'GET' && path === '/api/test/kv':
          response = await handleTestKV(env);
          break;
        case method === 'GET' && path === '/api/test/tenant-metadata':
          response = await handleTestTenantMetadata(request, env);
          break;
        case method === 'GET' && path === '/api/test/all-tenants':
          response = await handleGetAllTenants(env);
          break;

        // Webhooks
        case method === 'POST' && path === '/api/webhooks/cloudflare':
          response = await handleCloudflareWebhook(request, env);
          break;

        default:
          response = new Response(
            JSON.stringify({ error: 'Not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
      }

      // Add CORS headers to response (except for Durable Object responses)
      // Durable Object responses and WebSocket upgrades have immutable headers
      // We skip CORS for deployment-status path since it's handled by Durable Object
      const isDurableObjectResponse = url.pathname.startsWith('/deployment-status/');
      const isWebSocketUpgrade = response.status === 101;
      
      if (!isDurableObjectResponse && !isWebSocketUpgrade) {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }

      return response;

    } catch (error) {
      console.error('Service error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const errorResponse = new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );

      return errorResponse;
    }
  },

  // Cron triggers for automated tasks
  async scheduled(event: ScheduledEvent, env: CloudflareEnv, ctx: ExecutionContext): Promise<void> {
    console.log('Cron trigger:', event.cron);

    switch (event.cron) {
      case '*/5 * * * *': // Every 5 minutes
        await handleValidationChecks(env);
        break;
      case '0 */6 * * *': // Every 6 hours
        await handleSSLChecks(env);
        break;
      case '0 0 * * *': // Daily
        await handleDailyCleanup(env);
        break;
      case '0 2 * * 0': // Weekly
        await handleWeeklyHealthChecks(env);
        break;
    }
  },
};

// Subdomain Management Handlers
async function handleAutoAssignSubdomain(request: Request, env: CloudflareEnv): Promise<Response> {
  const subdomainRequest: SubdomainAssignRequest = await request.json();
  
  // Validate request
  if (!subdomainRequest.tenantId || !subdomainRequest.tenantSlug) {
    throw new Error('Missing required fields: tenantId, tenantSlug');
  }

  const subdomainService = new SubdomainService(env);
  const result = await subdomainService.autoAssignSubdomain(subdomainRequest);

  if (!result.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        subdomain: result.subdomain,
        fullDomain: result.fullDomain,
        url: `https://${result.fullDomain}`,
        ...(result.storage && { storage: result.storage }),
        ...(result.database && { database: result.database }),
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleGetTenantSubdomain(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');
  
  if (!tenantId) {
    throw new Error('tenantId parameter is required');
  }

  const subdomainService = new SubdomainService(env);
  const subdomain = await subdomainService.getTenantSubdomain(tenantId);

  if (!subdomain) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'No subdomain assigned to this tenant',
        timestamp: new Date().toISOString(),
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const subdomainPart = subdomain.split('.')[0];
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        subdomain: subdomainPart,
        fullDomain: subdomain,
        url: `https://${subdomain}`,
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateTenantSubdomain(request: Request, env: CloudflareEnv): Promise<Response> {
  const updateRequest: SubdomainUpdateRequest = await request.json();
  
  if (!updateRequest.tenantId || !updateRequest.newSubdomain) {
    throw new Error('Missing required fields: tenantId, newSubdomain');
  }

  const subdomainService = new SubdomainService(env);
  const result = await subdomainService.updateTenantSubdomain(
    updateRequest.tenantId,
    updateRequest.newSubdomain
  );

  if (!result.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        subdomain: result.subdomain,
        fullDomain: result.fullDomain,
        url: `https://${result.fullDomain}`,
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleDeleteTenantSubdomain(request: Request, env: CloudflareEnv): Promise<Response> {
  const { tenantId } = await request.json() as { tenantId: string };
  
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  const subdomainService = new SubdomainService(env);
  const success = await subdomainService.deleteTenantSubdomain(tenantId);

  if (!success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to delete subdomain',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Subdomain deleted successfully',
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleCheckSubdomainAvailability(request: Request, env: CloudflareEnv): Promise<Response> {
  const { subdomain } = await request.json() as { subdomain: string };
  
  if (!subdomain) {
    throw new Error('subdomain is required');
  }

  const subdomainService = new SubdomainService(env);
  const isAvailable = await subdomainService.isSubdomainAvailable(subdomain);
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        subdomain,
        available: isAvailable,
        fullDomain: isAvailable ? `${subdomain}.${env.BASE_DOMAIN}` : null,
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleProvisionDatabase(request: Request, env: CloudflareEnv): Promise<Response> {
  const { databaseId, tenantId, subdomain } = await request.json() as {
    databaseId: string;
    tenantId: string;
    subdomain: string;
  };

  if (!databaseId || !tenantId || !subdomain) {
    throw new Error('Missing required fields: databaseId, tenantId, subdomain');
  }

  console.log(`[Manual Provision] Starting database provisioning for ${subdomain} (${databaseId})`);

  // Get API token from Token Manager
  const apiToken = await getCloudflareStorageToken();
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('Missing required credentials: API token and CLOUDFLARE_ACCOUNT_ID');
  }

  // Create DatabaseProvisioner with R2 bucket for schema storage
  const provisioner = new DatabaseProvisioner(
    apiToken,
    accountId,
    env.SCHEMA_STORAGE // R2 bucket binding
  );

  try {
    const result = await provisioner.provisionDatabase({
      databaseId,
      tenantId,
      subdomain,
      includeSeeds: true,
      schemaVersion: 'latest', // Use latest schema from R2
    });

    console.log(`[Manual Provision] ✅ Success: ${result.tablesCreated} tables, ${result.rowsInserted} rows`);

    return new Response(
      JSON.stringify({
        success: result.success,
        data: {
          databaseId: result.databaseId,
          tablesCreated: result.tablesCreated,
          rowsInserted: result.rowsInserted,
          duration: result.duration,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error(`[Manual Provision] ❌ Failed:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Database provisioning failed',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Domain Management Handlers
async function handleAddDomain(request: Request, env: CloudflareEnv): Promise<Response> {
  const domainRequest: DomainRequest = await request.json();
  
  // Validate request
  if (!domainRequest.tenantId || !domainRequest.domain) {
    throw new Error('Missing required fields: tenantId, domain');
  }

  if (!DomainValidator.isValidDomain(domainRequest.domain)) {
    throw new Error('Invalid domain format');
  }

  // Get domain manager Durable Object
  const domainManager = env.DOMAIN_MANAGER.get(
    env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainRequest.tenantId}`)
  );

  const response = await domainManager.fetch(
    new Request(`${request.url}/add`, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(domainRequest),
    })
  );

  const result = await response.json() as any;
  
  return new Response(
    JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleListDomains(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');

  if (!tenantId) {
    throw new Error('tenantId parameter is required');
  }

  const domainManager = env.DOMAIN_MANAGER.get(
    env.DOMAIN_MANAGER.idFromName(`domain-manager-${tenantId}`)
  );

  const response = await domainManager.fetch(
    new Request(`${request.url}/list?tenantId=${tenantId}&status=${status}&page=${page}&limit=${limit}`)
  );

  const result = await response.json() as any;
  
  return new Response(
    JSON.stringify({
      success: true,
      data: result.domains,
      pagination: {
        page,
        limit,
        total: result.domains.length,
        totalPages: Math.ceil(result.domains.length / limit),
        hasNext: page * limit < result.domains.length,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateDomain(request: Request, env: CloudflareEnv, path: string): Promise<Response> {
  const domain = extractDomainFromPath(path);
  const updates = await request.json();

  // Get tenant ID from domain lookup
  const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`);
  if (!domainData) {
    throw new Error('Domain not found');
  }

  const domainStatus = JSON.parse(domainData);
  const domainManager = env.DOMAIN_MANAGER.get(
    env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainStatus.tenantId}`)
  );

  const response = await domainManager.fetch(
    new Request(`${request.url}/update`, {
      method: 'PUT',
      headers: request.headers,
      body: JSON.stringify({ domain, updates }),
    })
  );

  const result = await response.json() as any;
  
  return new Response(
    JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleDeleteDomain(request: Request, env: CloudflareEnv, path: string): Promise<Response> {
  const domain = extractDomainFromPath(path);

  // Get tenant ID from domain lookup
  const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`);
  if (!domainData) {
    throw new Error('Domain not found');
  }

  const domainStatus = JSON.parse(domainData);
  const domainManager = env.DOMAIN_MANAGER.get(
    env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainStatus.tenantId}`)
  );

  const response = await domainManager.fetch(
    new Request(`${request.url}/delete`, {
      method: 'DELETE',
      headers: request.headers,
      body: JSON.stringify({ domain }),
    })
  );

  const result = await response.json() as any;
  
  return new Response(
    JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleGetDomainStatus(request: Request, env: CloudflareEnv, path: string): Promise<Response> {
  const domain = extractDomainFromPath(path);

  // Get tenant ID from domain lookup
  const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`);
  if (!domainData) {
    throw new Error('Domain not found');
  }

  const domainStatus = JSON.parse(domainData);
  const domainManager = env.DOMAIN_MANAGER.get(
    env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainStatus.tenantId}`)
  );

  const response = await domainManager.fetch(
    new Request(`${request.url}/status?domain=${domain}`)
  );

  const result = await response.json() as any;
  
  return new Response(
    JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleValidateDomain(request: Request, env: CloudflareEnv, path: string): Promise<Response> {
  const domain = extractDomainFromPath(path);

  // Get tenant ID from domain lookup
  const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`);
  if (!domainData) {
    throw new Error('Domain not found');
  }

  const domainStatus = JSON.parse(domainData);
  const domainManager = env.DOMAIN_MANAGER.get(
    env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainStatus.tenantId}`)
  );

  const response = await domainManager.fetch(
    new Request(`${request.url}/validate`, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ domain }),
    })
  );

  const result = await response.json() as any;
  
  return new Response(
    JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleActivateDomain(request: Request, env: CloudflareEnv, path: string): Promise<Response> {
  const domain = extractDomainFromPath(path);

  // Get tenant ID from domain lookup
  const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`);
  if (!domainData) {
    throw new Error('Domain not found');
  }

  const domainStatus = JSON.parse(domainData);
  const domainManager = env.DOMAIN_MANAGER.get(
    env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainStatus.tenantId}`)
  );

  const response = await domainManager.fetch(
    new Request(`${request.url}/activate`, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ domain }),
    })
  );

  const result = await response.json() as any;
  
  return new Response(
    JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleSuspendDomain(request: Request, env: CloudflareEnv, path: string): Promise<Response> {
  const domain = extractDomainFromPath(path);
  const { reason } = await request.json() as { reason?: string };

  // Get tenant ID from domain lookup
  const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`);
  if (!domainData) {
    throw new Error('Domain not found');
  }

  const domainStatus = JSON.parse(domainData);
  const domainManager = env.DOMAIN_MANAGER.get(
    env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainStatus.tenantId}`)
  );

  const response = await domainManager.fetch(
    new Request(`${request.url}/suspend`, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ domain, reason }),
    })
  );

  const result = await response.json() as any;
  
  return new Response(
    JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleHealthCheck(request: Request, env: CloudflareEnv, path: string): Promise<Response> {
  const domain = extractDomainFromPath(path);

  // Get tenant ID from domain lookup
  const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`);
  if (!domainData) {
    throw new Error('Domain not found');
  }

  const domainStatus = JSON.parse(domainData);
  const domainManager = env.DOMAIN_MANAGER.get(
    env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainStatus.tenantId}`)
  );

  const response = await domainManager.fetch(
    new Request(`${request.url}/health-check`, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ domain }),
    })
  );

  const result = await response.json() as any;
  
  return new Response(
    JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleGetValidationInstructions(request: Request, env: CloudflareEnv, path: string): Promise<Response> {
  const domain = extractDomainFromPath(path);

  const validationData = await env.VALIDATION_TOKENS.get(`validation:${domain}`, 'json') as any;
  if (!validationData) {
    throw new Error('Validation data not found');
  }

  const instructions = DomainValidator.createValidationInstructions(validationData);
  
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        type: validationData.method,
        instructions,
        expiresAt: new Date(validationData.expiresAt).toISOString(),
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleGetTenantMetrics(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');
  
  if (!tenantId) {
    throw new Error('tenantId parameter is required');
  }

  const domainList = await env.DOMAIN_METADATA.get(`tenant:${tenantId}:domains`, 'json') as any[] || [];
  
  const metrics: DomainMetrics = {
    tenantId,
    totalDomains: domainList.length,
    activeDomains: 0,
    pendingDomains: 0,
    failedDomains: 0,
    expiredDomains: 0,
    totalSSL: 0,
    activeSSL: 0,
    expiringSSL: 0,
    expiredSSL: 0,
    lastUpdated: new Date().toISOString(),
  };

  // Count domains by status
  for (const domain of domainList) {
    const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`, 'json') as any;
    if (domainData) {
      switch (domainData.status) {
        case 'active':
          metrics.activeDomains++;
          break;
        case 'pending':
        case 'validating':
          metrics.pendingDomains++;
          break;
        case 'failed':
          metrics.failedDomains++;
          break;
        case 'expired':
          metrics.expiredDomains++;
          break;
      }

      // SSL metrics
      if (domainData.sslStatus) {
        metrics.totalSSL++;
        switch (domainData.sslStatus) {
          case 'active':
            metrics.activeSSL++;
            break;
          case 'expired':
            metrics.expiredSSL++;
            break;
          case 'renewing':
            metrics.expiringSSL++;
            break;
        }
      }
    }
  }
  
  return new Response(
    JSON.stringify({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// Provisioning Status Handler
async function handleGetProvisioningStatus(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');
  
  if (!tenantId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'tenantId parameter is required',
        timestamp: new Date().toISOString(),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const tracker = new ProvisioningTracker(env.DOMAIN_METADATA);
  const status = await tracker.get(tenantId);

  if (!status) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Provisioning status not found',
        message: 'Store may already be completed or tenant ID is invalid',
        timestamp: new Date().toISOString(),
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        ...status,
        statusMessage: ProvisioningTracker.getStatusMessage(status),
        currentStepMessage: ProvisioningTracker.getCurrentStepMessage(status),
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// Deployment Status Handler (Durable Object)
async function handleDeploymentStatus(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    
    console.log(`[Worker] Handling deployment status request: ${path}`);
    console.log(`[Worker] Upgrade header: ${request.headers.get('Upgrade')}`);
    
    // Extract deployment ID from path: /deployment-status/{deploymentId}/...
    const match = path.match(/^\/deployment-status\/([^\/]+)(\/.*)?$/);
    if (!match) {
      return new Response('Invalid deployment status URL', { status: 400 });
    }
    
    const deploymentId = match[1];
    if (!deploymentId) {
      return new Response('Invalid deployment ID', { status: 400 });
    }
    
    console.log(`[Worker] Forwarding to DO: deploymentId=${deploymentId}`);
    
    // Get Durable Object stub
    const id = env.DEPLOYMENT_STATUS.idFromName(deploymentId);
    const stub = env.DEPLOYMENT_STATUS.get(id);
    
    // Create new request with same URL to avoid header mutation issues
    const newRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    // IMPORTANT: Return response directly without adding CORS headers
    // The response from Durable Object has immutable headers
    return stub.fetch(newRequest);
  } catch (error) {
    console.error('[Worker] Error in handleDeploymentStatus:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleServiceHealthCheck(env: CloudflareEnv): Promise<Response> {
  const healthCheck: APIHealthCheckResponse = {
    status: 'healthy',
    version: env.SERVICE_VERSION,
    uptime: 0, // Would be calculated in real implementation
    checks: {
      database: await checkDatabaseHealth(env),
      kv: await checkKVHealth(env),
      r2: await checkR2Health(env),
      durableObjects: await checkDurableObjectsHealth(env),
      cloudflareApi: await checkCloudflareAPIHealth(env),
      letsencryptApi: true, // Simplified
    },
    metrics: {
      totalDomains: await getTotalDomains(env),
      activeDomains: await getActiveDomains(env),
      pendingValidations: await getPendingValidations(env),
      sslRenewals: await getSSLRenewals(env),
    },
    timestamp: new Date().toISOString(),
  };

  // Determine overall status
  const allChecksPass = Object.values(healthCheck.checks).every(Boolean);
  healthCheck.status = allChecksPass ? 'healthy' : 'degraded';

  return new Response(
    JSON.stringify({
      success: true,
      data: healthCheck,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleCloudflareWebhook(request: Request, env: CloudflareEnv): Promise<Response> {
  // Verify webhook signature
  const signature = request.headers.get('X-Cloudflare-Signature');
  if (!signature || !verifyWebhookSignature(request, signature, env.WEBHOOK_SECRET)) {
    throw new Error('Invalid webhook signature');
  }

  const webhookData = await request.json() as any;
  
  // Process webhook based on event type
  switch (webhookData.event) {
    case 'custom_hostname.ssl_issued':
      await handleSSLIssuedWebhook(webhookData, env);
      break;
    case 'custom_hostname.ssl_failed':
      await handleSSLFailedWebhook(webhookData, env);
      break;
    default:
      console.log('Unhandled webhook event:', webhookData.event);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// Cron job handlers
async function handleValidationChecks(env: CloudflareEnv): Promise<void> {
  console.log('Running validation checks...');
  
  const validationTokens = await env.VALIDATION_TOKENS.list();
  
  for (const token of validationTokens.keys) {
    const validationData = await env.VALIDATION_TOKENS.get(token.name, 'json') as any;
    if (validationData && validationData.expiresAt > Date.now()) {
      // Trigger validation check
      const domain = validationData.domain;
      const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`, 'json') as any;
      
      if (domainData && domainData.status === 'validating') {
        const domainManager = env.DOMAIN_MANAGER.get(
          env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainData.tenantId}`)
        );
        
        await domainManager.fetch(
          new Request(`/validate`, {
            method: 'POST',
            body: JSON.stringify({ domain }),
          })
        );
      }
    }
  }
}

async function handleSSLChecks(env: CloudflareEnv): Promise<void> {
  console.log('Running SSL checks...');
  
  const sslCertificates = await env.SSL_CERTIFICATES.list();
  
  for (const cert of sslCertificates.keys) {
    const sslData = await env.SSL_CERTIFICATES.get(cert.name, 'json') as any;
    if (sslData && sslData.expiresAt) {
      const daysUntilExpiry = DomainValidator.getDaysUntilExpiry(sslData.expiresAt);
      
      if (daysUntilExpiry <= 30) {
        // Trigger SSL renewal
        console.log(`SSL certificate for ${sslData.domain} expires in ${daysUntilExpiry} days`);
      }
    }
  }
}

async function handleDailyCleanup(env: CloudflareEnv): Promise<void> {
  console.log('Running daily cleanup...');
  
  // Clean up expired validation tokens
  const validationTokens = await env.VALIDATION_TOKENS.list();
  
  for (const token of validationTokens.keys) {
    const validationData = await env.VALIDATION_TOKENS.get(token.name, 'json') as any;
    if (validationData && validationData.expiresAt < Date.now()) {
      await env.VALIDATION_TOKENS.delete(token.name);
    }
  }
  
  // Clean up failed validations older than 30 days
  const domains = await env.DOMAIN_METADATA.list({ prefix: 'domain:' });
  
  for (const domain of domains.keys) {
    const domainData = await env.DOMAIN_METADATA.get(domain.name, 'json') as any;
    if (domainData && domainData.status === 'failed' && domainData.failedAt) {
      const failedDate = new Date(domainData.failedAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (failedDate < thirtyDaysAgo) {
        await env.DOMAIN_METADATA.delete(domain.name);
      }
    }
  }
}

async function handleWeeklyHealthChecks(env: CloudflareEnv): Promise<void> {
  console.log('Running weekly health checks...');
  
  const domains = await env.DOMAIN_METADATA.list({ prefix: 'domain:' });
  
  for (const domain of domains.keys) {
    const domainData = await env.DOMAIN_METADATA.get(domain.name, 'json') as any;
    if (domainData && domainData.status === 'active') {
      // Perform health check
      const domainManager = env.DOMAIN_MANAGER.get(
        env.DOMAIN_MANAGER.idFromName(`domain-manager-${domainData.tenantId}`)
      );
      
      await domainManager.fetch(
        new Request(`/health-check`, {
          method: 'POST',
          body: JSON.stringify({ domain: domainData.domain }),
        })
      );
    }
  }
}

// Helper functions
function extractDomainFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 2] || ''; // Assuming format: /api/domains/{domain}/action
}

async function checkDatabaseHealth(env: CloudflareEnv): Promise<boolean> {
  try {
    await env.DOMAIN_DB.prepare('SELECT 1').first();
    return true;
  } catch {
    return false;
  }
}

async function checkKVHealth(env: CloudflareEnv): Promise<boolean> {
  try {
    await env.DOMAIN_METADATA.get('health-check');
    return true;
  } catch {
    return false;
  }
}

async function checkR2Health(env: CloudflareEnv): Promise<boolean> {
  try {
    await env.SSL_CERT_STORAGE.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}

async function checkDurableObjectsHealth(env: CloudflareEnv): Promise<boolean> {
  try {
    const testDO = env.DOMAIN_MANAGER.get(env.DOMAIN_MANAGER.idFromName('health-check'));
    await testDO.fetch(new Request('/health'));
    return true;
  } catch {
    return false;
  }
}

async function checkCloudflareAPIHealth(env: CloudflareEnv): Promise<boolean> {
  try {
    const api = new CloudflareAPI({
      apiToken: env.CLOUDFLARE_API_TOKEN,
      zoneId: env.CLOUDFLARE_ZONE_ID,
      accountId: env.CLOUDFLARE_ACCOUNT_ID
    });
    return await api.healthCheck();
  } catch {
    return false;
  }
}

async function getTotalDomains(env: CloudflareEnv): Promise<number> {
  const domains = await env.DOMAIN_METADATA.list({ prefix: 'domain:' });
  return domains.keys.length;
}

async function getActiveDomains(env: CloudflareEnv): Promise<number> {
  const domains = await env.DOMAIN_METADATA.list({ prefix: 'domain:' });
  let activeCount = 0;
  
  for (const domain of domains.keys) {
    const domainData = await env.DOMAIN_METADATA.get(domain.name, 'json') as any;
    if (domainData?.status === 'active') {
      activeCount++;
    }
  }
  
  return activeCount;
}

async function getPendingValidations(env: CloudflareEnv): Promise<number> {
  const tokens = await env.VALIDATION_TOKENS.list();
  return tokens.keys.length;
}

async function getSSLRenewals(env: CloudflareEnv): Promise<number> {
  const certificates = await env.SSL_CERTIFICATES.list();
  let renewalCount = 0;
  
  for (const cert of certificates.keys) {
    const sslData = await env.SSL_CERTIFICATES.get(cert.name, 'json') as any;
    if (sslData?.status === 'renewing') {
      renewalCount++;
    }
  }
  
  return renewalCount;
}

function verifyWebhookSignature(request: Request, signature: string, secret: string): boolean {
  // Implement webhook signature verification
  // This would use HMAC-SHA256 or similar
  return true; // Simplified for now
}

async function handleSSLIssuedWebhook(webhookData: any, env: CloudflareEnv): Promise<void> {
  const { custom_hostname } = webhookData;
  const domain = custom_hostname.hostname;
  
  // Update domain SSL status
  const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`, 'json') as any;
  if (domainData) {
    domainData.sslStatus = 'active';
    await env.DOMAIN_METADATA.put(`domain:${domain}`, JSON.stringify(domainData));
  }
}

async function handleSSLFailedWebhook(webhookData: any, env: CloudflareEnv): Promise<void> {
  const { custom_hostname } = webhookData;
  const domain = custom_hostname.hostname;
  
  // Update domain SSL status
  const domainData = await env.DOMAIN_METADATA.get(`domain:${domain}`, 'json') as any;
  if (domainData) {
    domainData.sslStatus = 'failed';
    domainData.error = webhookData.error || 'SSL certificate failed';
    await env.DOMAIN_METADATA.put(`domain:${domain}`, JSON.stringify(domainData));
  }
}

/**
 * Fix DNS records for a subdomain
 * Updates CNAME to point to the correct target
 */
async function handleFixDNS(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const body = await request.json() as { subdomain: string; tenantId?: string };
    const { subdomain, tenantId } = body;

    if (!subdomain) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subdomain is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fullDomain = `${subdomain}.${env.BASE_DOMAIN || 'handsfree.tech'}`;
    console.log(`[DNS-FIX] Fixing DNS for ${fullDomain}`);

    // Get the correct target domain
    const targetDomain = env.PLATFORM_DOMAIN || 'handsfree-store-front-prod.suyesh.workers.dev';
    
    // Create CloudflareAPI instance
    const cloudflareApi = new CloudflareAPI({
      apiToken: env.CLOUDFLARE_API_TOKEN,
      zoneId: env.CLOUDFLARE_ZONE_ID,
      accountId: env.CLOUDFLARE_ACCOUNT_ID
    });

    // First, try to get existing DNS record
    let existingRecord = null;
    try {
      const records = await cloudflareApi.getDNSRecords(fullDomain);
      if (records && records.length > 0) {
        existingRecord = records[0];
        console.log(`[DNS-FIX] Found existing record: ${existingRecord.type} -> ${existingRecord.content}`);
      }
    } catch (error) {
      console.log(`[DNS-FIX] No existing record found for ${fullDomain}`);
    }

    // Update or create DNS record
    if (existingRecord) {
      // Update existing record
      console.log(`[DNS-FIX] Updating existing ${existingRecord.type} record to point to ${targetDomain}`);
      await cloudflareApi.updateDNSRecord(existingRecord.id, {
        type: 'CNAME',
        content: targetDomain,
        ttl: 1,
        proxied: true
      });
    } else {
      // Create new CNAME record
      console.log(`[DNS-FIX] Creating new CNAME record pointing to ${targetDomain}`);
      await cloudflareApi.createDNSRecord({
        name: fullDomain,
        type: 'CNAME',
        content: targetDomain,
        ttl: 1,
        proxied: true
      });
    }

    // Update tenant configuration if tenantId provided
    if (tenantId) {
      const tenantKey = `tenant:${tenantId}`;
      const tenantConfig = await env.TENANT_CONFIG.get(tenantKey, 'json') as any;
      if (tenantConfig) {
        tenantConfig.dnsFixed = true;
        tenantConfig.dnsFixedAt = new Date().toISOString();
        await env.TENANT_CONFIG.put(tenantKey, JSON.stringify(tenantConfig));
        console.log(`[DNS-FIX] Updated tenant configuration for ${tenantId}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `DNS record fixed for ${fullDomain}`,
      data: {
        subdomain,
        fullDomain,
        targetDomain,
        action: existingRecord ? 'updated' : 'created'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[DNS-FIX] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fix DNS record'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Delete a subdomain and its DNS records
 */
async function handleDeleteSubdomain(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const subdomain = url.pathname.split('/').pop();
    
    if (!subdomain) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subdomain is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fullDomain = `${subdomain}.${env.BASE_DOMAIN || 'handsfree.tech'}`;
    console.log(`[DELETE] Deleting subdomain: ${fullDomain}`);

    // Create CloudflareAPI instance
    const cloudflareApi = new CloudflareAPI({
      apiToken: env.CLOUDFLARE_API_TOKEN,
      zoneId: env.CLOUDFLARE_ZONE_ID,
      accountId: env.CLOUDFLARE_ACCOUNT_ID
    });

    // Find and delete DNS records
    let deletedRecords = 0;
    try {
      const records = await cloudflareApi.getDNSRecords(fullDomain);
      if (records && records.length > 0) {
        for (const record of records) {
          console.log(`[DELETE] Deleting DNS record: ${record.type} -> ${record.content}`);
          await cloudflareApi.deleteDNSRecord(record.id);
          deletedRecords++;
        }
      }
    } catch (error) {
      console.log(`[DELETE] No DNS records found for ${fullDomain}`);
    }

    // Delete tenant configuration
    const tenantKey = `tenant:${subdomain}`;
    const tenantConfig = await env.TENANT_CONFIG.get(tenantKey, 'json');
    if (tenantConfig) {
      await env.TENANT_CONFIG.delete(tenantKey);
      console.log(`[DELETE] Deleted tenant configuration for ${subdomain}`);
    }

    // Delete domain metadata
    const domainKey = `domain:${fullDomain}`;
    const domainData = await env.DOMAIN_METADATA.get(domainKey, 'json');
    if (domainData) {
      await env.DOMAIN_METADATA.delete(domainKey);
      console.log(`[DELETE] Deleted domain metadata for ${fullDomain}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Subdomain ${subdomain} deleted successfully`,
      data: {
        subdomain,
        fullDomain,
        deletedRecords,
        deletedConfig: !!tenantConfig,
        deletedMetadata: !!domainData
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[DELETE] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to delete subdomain'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Cleanup DNS records for a specific domain
 */
async function handleCleanupDNSRecords(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const body = await request.json() as { domain: string; dryRun?: boolean };
    const { domain, dryRun = false } = body;

    if (!domain) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Domain is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[CLEANUP] ${dryRun ? 'DRY RUN' : 'LIVE'} cleanup for domain: ${domain}`);

    // Create CloudflareAPI instance
    const cloudflareApi = new CloudflareAPI({
      apiToken: env.CLOUDFLARE_API_TOKEN,
      zoneId: env.CLOUDFLARE_ZONE_ID,
      accountId: env.CLOUDFLARE_ACCOUNT_ID
    });

    if (dryRun) {
      // Just list the records that would be deleted
      const records = await cloudflareApi.findDNSRecordsByDomain(domain);
      return new Response(JSON.stringify({
        success: true,
        message: `Found ${records.length} DNS records for ${domain}`,
        data: {
          domain,
          dryRun: true,
          records: records.map(r => ({
            id: r.id,
            type: r.type,
            name: r.name,
            content: r.content,
            proxied: r.proxied,
            ttl: r.ttl
          }))
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Actually delete the records
      const result = await cloudflareApi.deleteAllDNSRecordsForDomain(domain);
      
      return new Response(JSON.stringify({
        success: result.errors.length === 0,
        message: `DNS cleanup completed for ${domain}`,
        data: {
          domain,
          deleted: result.deleted,
          errors: result.errors,
          records: result.records.map(r => ({
            id: r.id,
            type: r.type,
            name: r.name,
            content: r.content
          }))
        }
      }), {
        status: result.errors.length === 0 ? 200 : 207, // 207 = Multi-Status
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('[CLEANUP] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to cleanup DNS records'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * List DNS records for a domain
 */
async function handleListDNSRecords(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const domain = url.pathname.split('/').pop();
    
    if (!domain) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Domain is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[LIST] Listing DNS records for domain: ${domain}`);

    // Create CloudflareAPI instance
    const cloudflareApi = new CloudflareAPI({
      apiToken: env.CLOUDFLARE_API_TOKEN,
      zoneId: env.CLOUDFLARE_ZONE_ID,
      accountId: env.CLOUDFLARE_ACCOUNT_ID
    });

    const records = await cloudflareApi.findDNSRecordsByDomain(domain);

    return new Response(JSON.stringify({
      success: true,
      message: `Found ${records.length} DNS records for ${domain}`,
      data: {
        domain,
        count: records.length,
        records: records.map(r => ({
          id: r.id,
          type: r.type,
          name: r.name,
          content: r.content,
          proxied: r.proxied,
          ttl: r.ttl,
          created_on: r.created_on,
          modified_on: r.modified_on
        }))
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[LIST] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to list DNS records'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Bulk delete DNS records by IDs
 */
async function handleBulkDeleteDNSRecords(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const body = await request.json() as { recordIds: string[]; dryRun?: boolean };
    const { recordIds, dryRun = false } = body;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'recordIds array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[BULK-DELETE] ${dryRun ? 'DRY RUN' : 'LIVE'} bulk delete for ${recordIds.length} records`);

    // Create CloudflareAPI instance
    const cloudflareApi = new CloudflareAPI({
      apiToken: env.CLOUDFLARE_API_TOKEN,
      zoneId: env.CLOUDFLARE_ZONE_ID,
      accountId: env.CLOUDFLARE_ACCOUNT_ID
    });

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        message: `Would delete ${recordIds.length} DNS records`,
        data: {
          recordIds,
          dryRun: true,
          count: recordIds.length
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const result = await cloudflareApi.bulkDeleteDNSRecords(recordIds);
      
      return new Response(JSON.stringify({
        success: result.errors.length === 0,
        message: `Bulk delete completed`,
        data: {
          requested: recordIds.length,
          deleted: result.deleted,
          failed: result.failedIds.length,
          errors: result.errors,
          failedIds: result.failedIds
        }
      }), {
        status: result.errors.length === 0 ? 200 : 207, // 207 = Multi-Status
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('[BULK-DELETE] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to bulk delete DNS records'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


/**
 * Handle Test UI - Returns HTML interface for testing workflow
 */
async function handleTestUI(): Promise<Response> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SaaS Workflow Test</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 900px; margin: 0 auto; }
        .card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 { color: #333; margin-bottom: 10px; font-size: 32px; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .input-group { margin-bottom: 20px; }
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
        }
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input:focus { outline: none; border-color: #667eea; }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 14px 30px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
            width: 100%;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .results { margin-top: 30px; display: none; }
        .results.show { display: block; }
        .step {
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            background: #f8f9fa;
            border-left: 4px solid #ddd;
        }
        .step.success { border-left-color: #10b981; background: #f0fdf4; }
        .step.failed { border-left-color: #ef4444; background: #fef2f2; }
        .step-title { font-weight: 600; margin-bottom: 5px; color: #333; }
        .step-details { font-size: 14px; color: #666; }
        .summary {
            background: #f0fdf4;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 2px solid #10b981;
        }
        .summary.error { background: #fef2f2; border-color: #ef4444; }
        .summary-title { font-size: 20px; font-weight: 600; margin-bottom: 10px; }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
            margin-right: 10px;
            vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>🚀 SaaS Workflow Test</h1>
            <p class="subtitle">Test complete multi-tenant provisioning workflow</p>
            <div class="input-group">
                <label for="tenantSlug">Tenant Subdomain (optional)</label>
                <input type="text" id="tenantSlug" placeholder="Leave empty for auto-generated">
            </div>
            <button id="runTest" onclick="runTest()">Run Workflow Test</button>
        </div>
        <div class="results" id="results">
            <div class="card">
                <div id="summary"></div>
                <div id="steps"></div>
            </div>
        </div>
    </div>
    <script>
        async function runTest() {
            const button = document.getElementById('runTest');
            const results = document.getElementById('results');
            const summary = document.getElementById('summary');
            const stepsDiv = document.getElementById('steps');
            const tenantSlug = document.getElementById('tenantSlug').value;

            button.disabled = true;
            button.innerHTML = '<span class="loading"></span>Running test...';
            results.classList.add('show');
            summary.innerHTML = '<div class="summary"><div class="summary-title">Running workflow test...</div></div>';
            stepsDiv.innerHTML = '';

            try {
                const response = await fetch('/api/test/workflow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenantSlug: tenantSlug || undefined })
                });

                const data = await response.json();

                if (data.success) {
                    summary.innerHTML = \`
                        <div class="summary">
                            <div class="summary-title">✅ Test Completed Successfully!</div>
                            <p><strong>Tenant ID:</strong> \${data.tenantId}</p>
                            <p><strong>Subdomain:</strong> \${data.subdomain}</p>
                            <p><strong>Full Domain:</strong> <a href="https://\${data.fullDomain}" target="_blank">\${data.fullDomain}</a></p>
                            \${data.databaseId ? '<p><strong>Database ID:</strong> ' + data.databaseId + '</p>' : ''}
                            <p><strong>Duration:</strong> \${data.duration}ms</p>
                        </div>
                    \`;
                } else {
                    summary.innerHTML = \`
                        <div class="summary error">
                            <div class="summary-title">❌ Test Failed</div>
                            <p><strong>Error:</strong> \${data.error || 'Unknown error'}</p>
                            <p><strong>Duration:</strong> \${data.duration}ms</p>
                        </div>
                    \`;
                }

                stepsDiv.innerHTML = data.steps.map(step => \`
                    <div class="step \${step.status}">
                        <div class="step-title">
                            \${step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : '⏭️'}
                            \${step.step}
                        </div>
                        <div class="step-details">
                            Duration: \${step.duration}ms
                            \${step.error ? '<br>Error: ' + step.error : ''}
                            \${step.details ? '<br><pre>' + JSON.stringify(step.details, null, 2) + '</pre>' : ''}
                        </div>
                    </div>
                \`).join('');

            } catch (error) {
                summary.innerHTML = \`
                    <div class="summary error">
                        <div class="summary-title">❌ Test Failed</div>
                        <p><strong>Error:</strong> \${error.message}</p>
                    </div>
                \`;
            } finally {
                button.disabled = false;
                button.innerHTML = 'Run Workflow Test';
            }
        }
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

/**
 * Handle Run Workflow Test - Executes complete provisioning workflow
 */
async function handleRunWorkflowTest(request: Request, env: CloudflareEnv): Promise<Response> {
  const startTime = Date.now();

  try {
    const body = await request.json() as { tenantSlug?: string };
    const tenantId = `tenant-${Date.now()}`;
    const subdomain = body.tenantSlug || `test-store-${Date.now()}`;
    const steps: any[] = [];

    let fullDomain = '';
    let databaseId: string | undefined;

    // Step 1: Check service health (skip zone check, just verify env is configured)
    const healthStepStart = Date.now();
    try {
      // Just check that required env vars are present
      const hasRequiredEnv = !!(
        env.CLOUDFLARE_API_TOKEN &&
        env.CLOUDFLARE_ZONE_ID &&
        env.CLOUDFLARE_ACCOUNT_ID &&
        env.BASE_DOMAIN
      );

      if (!hasRequiredEnv) {
        throw new Error('Missing required environment variables');
      }

      steps.push({
        step: 'Service Health Check',
        status: 'success',
        duration: Date.now() - healthStepStart,
        details: {
          status: 'healthy',
          baseDomain: env.BASE_DOMAIN,
          accountId: env.CLOUDFLARE_ACCOUNT_ID?.substring(0, 8) + '...'
        },
      });
    } catch (error: any) {
      steps.push({
        step: 'Service Health Check',
        status: 'failed',
        duration: Date.now() - healthStepStart,
        error: error.message,
      });
      throw error;
    }

    // Step 2: Assign subdomain and provision
    const assignStepStart = Date.now();
    try {
      const subdomainService = new SubdomainService(env);

      const assignResult = await subdomainService.autoAssignSubdomain({
        tenantId,
        tenantSlug: subdomain,
        customSubdomain: body.tenantSlug, // Use custom if provided
        provisionStorage: true,
        provisionDatabase: true,
      });

      if (!assignResult.success) {
        throw new Error(assignResult.error || 'Failed to assign subdomain');
      }

      fullDomain = assignResult.fullDomain!;
      databaseId = assignResult.storage?.databaseId;

      steps.push({
        step: 'Subdomain Assignment & Provisioning',
        status: 'success',
        duration: Date.now() - assignStepStart,
        details: {
          subdomain: assignResult.subdomain,
          fullDomain: assignResult.fullDomain,
          databaseId: assignResult.storage?.databaseId,
          tablesCreated: assignResult.database?.tablesCreated,
          rowsInserted: assignResult.database?.rowsInserted,
        },
      });
    } catch (error: any) {
      steps.push({
        step: 'Subdomain Assignment & Provisioning',
        status: 'failed',
        duration: Date.now() - assignStepStart,
        error: error.message,
      });
      throw error;
    }

    // Step 3: Initialize database via DB_PROVISIONER if not already done
    if (databaseId && (!assignResult.database || !assignResult.database.tablesCreated)) {
      const dbProvisionStepStart = Date.now();
      try {
        console.log(`[Test] Calling DB_PROVISIONER for database ${databaseId}`);

        const storageToken = env.CLOUDFLARE_STORAGE_TOKEN || env.CLOUDFLARE_API_TOKEN;

        const provisionRequest = {
          databaseId,
          tenantId,
          subdomain,
          includeSeeds: true,
          accountId: env.CLOUDFLARE_ACCOUNT_ID,
          apiToken: storageToken,
        };

        const dbResponse = await env.DB_PROVISIONER.fetch('https://provisioner/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(provisionRequest),
        });

        const dbResult = await dbResponse.json() as any;

        if (dbResult.success) {
          steps.push({
            step: 'Database Initialization (DB_PROVISIONER)',
            status: 'success',
            duration: Date.now() - dbProvisionStepStart,
            details: {
              tablesCreated: dbResult.tablesCreated,
              rowsInserted: dbResult.rowsInserted,
              duration: dbResult.duration,
            },
          });
        } else {
          throw new Error(dbResult.error || 'Database initialization failed');
        }
      } catch (error: any) {
        steps.push({
          step: 'Database Initialization (DB_PROVISIONER)',
          status: 'failed',
          duration: Date.now() - dbProvisionStepStart,
          error: error.message,
        });
        console.error('[Test] Database initialization failed:', error);
        // Don't throw - continue to verification
      }
    }

    // Step 4: Verify database tables
    if (databaseId) {
      const tablesStepStart = Date.now();
      try {
        const cloudflareApi = new CloudflareAPI({
          apiToken: env.CLOUDFLARE_API_TOKEN,
          zoneId: env.CLOUDFLARE_ZONE_ID,
          accountId: env.CLOUDFLARE_ACCOUNT_ID
        });

        const tablesResult = await cloudflareApi.queryD1Database(
          databaseId,
          'SELECT name FROM sqlite_master WHERE type="table" ORDER BY name'
        );

        const tables = tablesResult.map((row: any) => row.name);

        steps.push({
          step: 'Database Tables Verification',
          status: 'success',
          duration: Date.now() - tablesStepStart,
          details: {
            tablesCount: tables.length,
            tables: tables.slice(0, 5), // Show first 5
          },
        });
      } catch (error: any) {
        steps.push({
          step: 'Database Tables Verification',
          status: 'failed',
          duration: Date.now() - tablesStepStart,
          error: error.message,
        });
      }
    }

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        tenantId,
        subdomain,
        fullDomain,
        databaseId,
        steps,
        duration,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Test failed',
        steps: [],
        duration,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Test reading tenant metadata
async function handleTestTenantMetadata(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');

  if (!tenantId) {
    return new Response(JSON.stringify({ error: 'tenantId query parameter required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const key = `tenant:${tenantId}`;
    console.log('[Test] Reading key:', key);

    const value = await env.TENANT_METADATA.get(key);

    console.log('[Test] Value:', value);

    return new Response(JSON.stringify({
      tenant_id: tenantId,
      key: key,
      found: !!value,
      value: value ? JSON.parse(value) : null
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get all tenants from KV storage
async function handleGetAllTenants(env: CloudflareEnv): Promise<Response> {
  try {
    // Try to get the admin_tenants list from KV
    const adminTenants = await env.TENANT_METADATA.get('admin_tenants', 'json') as any[] | null;

    if (!adminTenants || !Array.isArray(adminTenants)) {
      return new Response(JSON.stringify({
        success: true,
        count: 0,
        tenants: [],
        message: 'No tenants found in KV storage'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract tenant IDs
    const tenantIds = adminTenants.map(t => t.tenantId || t.id).filter(Boolean);

    return new Response(JSON.stringify({
      success: true,
      count: tenantIds.length,
      tenants: adminTenants,
      tenantIds: tenantIds
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Test KV binding
async function handleTestKV(env: CloudflareEnv): Promise<Response> {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    // Test 1: Check binding exists
    results.tests.push({
      name: 'Check TENANT_METADATA binding',
      binding_type: typeof env.TENANT_METADATA,
      binding_exists: !!env.TENANT_METADATA,
      success: !!env.TENANT_METADATA
    });

    // Test 2: Try to write
    const testKey = `test-kv-${Date.now()}`;
    const testValue = JSON.stringify({ test: 'data', timestamp: new Date().toISOString() });

    console.log('[KV Test] Writing key:', testKey);
    console.log('[KV Test] Value:', testValue);

    const putResult = await env.TENANT_METADATA.put(testKey, testValue);

    console.log('[KV Test] Put result:', putResult);

    results.tests.push({
      name: 'Write to TENANT_METADATA',
      key: testKey,
      put_result: putResult,
      success: true
    });

    // Test 3: Try to read back
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    const getValue = await env.TENANT_METADATA.get(testKey);

    console.log('[KV Test] Get result:', getValue);

    results.tests.push({
      name: 'Read from TENANT_METADATA',
      key: testKey,
      value_retrieved: getValue,
      matches: getValue === testValue,
      success: getValue === testValue
    });

    results.overall_success = results.tests.every((t: any) => t.success);

    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    results.error = {
      message: error.message,
      name: error.name,
      stack: error.stack
    };
    results.overall_success = false;

    return new Response(JSON.stringify(results, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Store a tenant secret (encrypted)
 */
async function handleStoreSecret(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const { tenantId, secretType, secretKey, value, environment } = await request.json();

    // Validate required fields
    if (!tenantId || !secretType || !secretKey || !value || !environment) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: tenantId, secretType, secretKey, value, environment',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate environment
    if (environment !== 'test' && environment !== 'production') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid environment. Must be "test" or "production"',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant database
    const tenantDbKey = `tenant:${tenantId}`;
    const tenantData = await env.DOMAIN_METADATA.get(tenantDbKey, 'json') as any;

    if (!tenantData || !tenantData.database?.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Tenant database not found for ${tenantId}`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get D1 database binding dynamically
    // Note: In production, you'd need to bind the tenant DB or use Cloudflare API
    // For now, we'll use a workaround to access tenant databases
    const databaseId = tenantData.database.id;

    // Store secret via Cloudflare D1 API (since we can't bind tenant DBs dynamically)
    const storageToken = env.CLOUDFLARE_STORAGE_TOKEN || env.CLOUDFLARE_API_TOKEN;

    // Get tenant encryption key from Token Manager
    const { getCloudflareStorageToken } = await import('./lib/token-manager');
    const apiToken = await getCloudflareStorageToken();

    // Generate encryption key for tenant if not exists
    let encryptionKey: string;
    try {
      encryptionKey = await import('./lib/token-manager').then(m => m.fetchToken(`tenant:${tenantId}:encryption_key`));
    } catch {
      // Generate new encryption key for this tenant
      encryptionKey = await generateTenantEncryptionKey();

      // Store in Token Manager
      const tokenManagerUrl = 'https://handsfree-token-manager.suyesh.workers.dev';
      const adminApiKey = env.TOKEN_MANAGER_ADMIN_KEY;

      if (adminApiKey) {
        await fetch(`${tokenManagerUrl}/api/admin/tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service: 'tenant',
            key: `${tenantId}:encryption_key`,
            value: encryptionKey,
            metadata: {
              description: `Encryption key for tenant ${tenantId} secrets`,
              tenantId,
            },
          }),
        });
      }
    }

    // Encrypt the value
    const encrypted = await encryptValue(value, encryptionKey);

    // Store in tenant D1 database
    const sql = `
      INSERT INTO tenant_secrets (
        tenant_id, secret_type, secret_key, environment,
        encrypted_value, encryption_version, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(tenant_id, secret_type, secret_key, environment)
      DO UPDATE SET
        encrypted_value = excluded.encrypted_value,
        encryption_version = excluded.encryption_version,
        updated_at = datetime('now')
    `;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql,
          params: [tenantId, secretType, secretKey, environment, encrypted, 1],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to store secret: ${JSON.stringify(error)}`);
    }

    console.log(`[TenantSecrets] Stored ${secretType}:${secretKey} for tenant ${tenantId} (${environment})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Secret stored successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantSecrets] Error storing secret:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to store secret',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * List tenant secrets (metadata only, not values)
 */
async function handleListSecrets(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');
    const secretType = url.searchParams.get('secretType');

    if (!tenantId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameter: tenantId',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant database
    const tenantDbKey = `tenant:${tenantId}`;
    const tenantData = await env.DOMAIN_METADATA.get(tenantDbKey, 'json') as any;

    if (!tenantData || !tenantData.database?.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Tenant database not found for ${tenantId}`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const databaseId = tenantData.database.id;
    const { getCloudflareStorageToken } = await import('./lib/token-manager');
    const apiToken = await getCloudflareStorageToken();

    // Query secrets
    const sql = secretType
      ? `SELECT id, tenant_id, secret_type, secret_key, environment,
                encryption_version, metadata, created_at, updated_at, last_used_at
         FROM tenant_secrets
         WHERE tenant_id = ? AND secret_type = ?
         ORDER BY secret_type, secret_key, environment`
      : `SELECT id, tenant_id, secret_type, secret_key, environment,
                encryption_version, metadata, created_at, updated_at, last_used_at
         FROM tenant_secrets
         WHERE tenant_id = ?
         ORDER BY secret_type, secret_key, environment`;

    const params = secretType ? [tenantId, secretType] : [tenantId];

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to list secrets: ${JSON.stringify(error)}`);
    }

    const data = await response.json() as any;
    const secrets = data.result[0]?.results || [];

    return new Response(
      JSON.stringify({
        success: true,
        secrets: secrets.map((s: any) => ({
          id: s.id,
          tenantId: s.tenant_id,
          secretType: s.secret_type,
          secretKey: s.secret_key,
          environment: s.environment,
          encryptionVersion: s.encryption_version,
          metadata: s.metadata ? JSON.parse(s.metadata) : null,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          lastUsedAt: s.last_used_at,
        })),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantSecrets] Error listing secrets:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to list secrets',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Delete a tenant secret
 */
async function handleDeleteSecret(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const { tenantId, secretType, secretKey, environment } = await request.json();

    if (!tenantId || !secretType || !secretKey || !environment) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: tenantId, secretType, secretKey, environment',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant database
    const tenantDbKey = `tenant:${tenantId}`;
    const tenantData = await env.DOMAIN_METADATA.get(tenantDbKey, 'json') as any;

    if (!tenantData || !tenantData.database?.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Tenant database not found for ${tenantId}`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const databaseId = tenantData.database.id;
    const { getCloudflareStorageToken } = await import('./lib/token-manager');
    const apiToken = await getCloudflareStorageToken();

    // Delete secret
    const sql = `
      DELETE FROM tenant_secrets
      WHERE tenant_id = ? AND secret_type = ? AND secret_key = ? AND environment = ?
    `;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql,
          params: [tenantId, secretType, secretKey, environment],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete secret: ${JSON.stringify(error)}`);
    }

    console.log(`[TenantSecrets] Deleted ${secretType}:${secretKey} for tenant ${tenantId} (${environment})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Secret deleted successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantSecrets] Error deleting secret:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to delete secret',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Helper: Encrypt a value using AES-256-GCM
 */
async function encryptValue(plaintext: string, keyString: string): Promise<string> {
  // Convert key string to CryptoKey
  const keyData = base64ToArrayBuffer(keyString);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return arrayBufferToBase64(combined);
}

/**
 * Helper: Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Helper: ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ============================================================================
// CUSTOMER MANAGEMENT HANDLERS
// ============================================================================

/**
 * Helper: Get tenant ID from request headers
 */
function getTenantIdFromHeaders(request: Request): string {
  const tenantId = request.headers.get('X-Tenant-ID');
  if (!tenantId) {
    throw new Error('Missing X-Tenant-ID header');
  }
  return tenantId;
}

/**
 * Helper: Get tenant database from KV metadata
 */
async function getTenantDatabase(tenantId: string, env: CloudflareEnv): Promise<D1Database> {
  // Fetch tenant metadata from KV
  const metadataKey = `tenant:${tenantId}`;
  const metadata = await env.DOMAIN_METADATA.get(metadataKey, 'json') as any;

  if (!metadata || !metadata.database) {
    throw new Error(`No database found for tenant: ${tenantId}`);
  }

  // Get the D1 binding by database name
  const dbName = metadata.database.name;
  const db = (env as any)[dbName];

  if (!db) {
    throw new Error(`Database binding not found: ${dbName}`);
  }

  return db as D1Database;
}

/**
 * POST /api/customers - Create or update customer
 */
async function handleUpsertCustomer(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const input = await request.json() as CustomerManager.CustomerInput;

    const db = await getTenantDatabase(tenantId, env);

    const customer = await CustomerManager.upsertCustomer(tenantId, input, {
      DB: db,
      TOKEN_MANAGER: env.TOKEN_MANAGER,
      CUSTOMER_CACHE: env.CUSTOMER_CACHE,
    });

    // Cache the customer if KV is available
    if (env.CUSTOMER_CACHE) {
      const phoneHash = hashPhoneNumber(customer.phone, tenantId);
      const tags = await CustomerTags.getCustomerTags(customer.id, db);
      await CustomerCache.cacheCustomer(customer, phoneHash, tags.map(t => t.id), env.CUSTOMER_CACHE);
    }

    // Auto-assign tags
    await CustomerTags.autoAssignTags(customer.id, tenantId, db);

    return new Response(JSON.stringify({ success: true, customer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Upsert customer error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/customers - List customers with pagination
 */
async function handleListCustomers(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);

    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || undefined;
    const tagId = url.searchParams.get('tagId') || undefined;
    const sortBy = (url.searchParams.get('sortBy') as any) || undefined;
    const sortOrder = (url.searchParams.get('sortOrder') as any) || undefined;

    const db = await getTenantDatabase(tenantId, env);

    const result = await CustomerManager.listCustomers(tenantId, {
      DB: db,
      TOKEN_MANAGER: env.TOKEN_MANAGER,
      CUSTOMER_CACHE: env.CUSTOMER_CACHE,
    }, {
      page,
      limit,
      search,
      tagId,
      sortBy,
      sortOrder,
    });

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List customers error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/customers/:customerId - Get customer by ID
 */
async function handleGetCustomer(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const customerId = url.pathname.split('/').pop() || '';

    const db = await getTenantDatabase(tenantId, env);

    // Try cache first
    let customer: CustomerManager.Customer | null = null;
    if (env.CUSTOMER_CACHE) {
      customer = await CustomerCache.getCachedCustomer(customerId, tenantId, env.CUSTOMER_CACHE);
      if (customer) {
        await CustomerCache.recordCacheHit(tenantId, env.CUSTOMER_CACHE);
      } else {
        await CustomerCache.recordCacheMiss(tenantId, env.CUSTOMER_CACHE);
      }
    }

    // Fallback to database
    if (!customer) {
      customer = await CustomerManager.getCustomer(customerId, tenantId, {
        DB: db,
        TOKEN_MANAGER: env.TOKEN_MANAGER,
        CUSTOMER_CACHE: env.CUSTOMER_CACHE,
      });

      // Cache it
      if (customer && env.CUSTOMER_CACHE) {
        const phoneHash = hashPhoneNumber(customer.phone, tenantId);
        const tags = await CustomerTags.getCustomerTags(customer.id, db);
        await CustomerCache.cacheCustomer(customer, phoneHash, tags.map(t => t.id), env.CUSTOMER_CACHE);
      }
    }

    if (!customer) {
      return new Response(JSON.stringify({ success: false, error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, customer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get customer error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/customers/phone/:phoneNumber - Get customer by phone
 */
async function handleGetCustomerByPhone(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const phoneNumber = decodeURIComponent(url.pathname.split('/').pop() || '');

    const db = await getTenantDatabase(tenantId, env);

    // Try cache first
    let customer: CustomerManager.Customer | null = null;
    if (env.CUSTOMER_CACHE) {
      const phoneHash = hashPhoneNumber(phoneNumber, tenantId);
      customer = await CustomerCache.getCachedCustomerByPhone(phoneHash, tenantId, env.CUSTOMER_CACHE);
      if (customer) {
        await CustomerCache.recordCacheHit(tenantId, env.CUSTOMER_CACHE);
      } else {
        await CustomerCache.recordCacheMiss(tenantId, env.CUSTOMER_CACHE);
      }
    }

    // Fallback to database
    if (!customer) {
      customer = await CustomerManager.getCustomerByPhone(phoneNumber, tenantId, {
        DB: db,
        TOKEN_MANAGER: env.TOKEN_MANAGER,
        CUSTOMER_CACHE: env.CUSTOMER_CACHE,
      });

      // Cache it
      if (customer && env.CUSTOMER_CACHE) {
        const phoneHash = hashPhoneNumber(customer.phone, tenantId);
        const tags = await CustomerTags.getCustomerTags(customer.id, db);
        await CustomerCache.cacheCustomer(customer, phoneHash, tags.map(t => t.id), env.CUSTOMER_CACHE);
      }
    }

    if (!customer) {
      return new Response(JSON.stringify({ success: false, error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, customer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get customer by phone error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * PATCH /api/customers/:customerId - Update customer
 */
async function handleUpdateCustomer(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const customerId = url.pathname.split('/').filter(Boolean).pop() || '';
    const updates = await request.json() as CustomerManager.CustomerInput;

    const db = await getTenantDatabase(tenantId, env);

    // Update is same as upsert for customers
    const customer = await CustomerManager.upsertCustomer(tenantId, updates, {
      DB: db,
      TOKEN_MANAGER: env.TOKEN_MANAGER,
      CUSTOMER_CACHE: env.CUSTOMER_CACHE,
    });

    // Invalidate cache
    if (env.CUSTOMER_CACHE) {
      const phoneHash = hashPhoneNumber(customer.phone, tenantId);
      await CustomerCache.invalidateCustomerCache(customerId, tenantId, phoneHash, env.CUSTOMER_CACHE);
    }

    return new Response(JSON.stringify({ success: true, customer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update customer error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /api/customers/:customerId - Delete customer (GDPR)
 */
async function handleDeleteCustomer(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const customerId = url.pathname.split('/').filter(Boolean).pop() || '';

    const db = await getTenantDatabase(tenantId, env);

    // Get customer first for cache invalidation
    const customer = await CustomerManager.getCustomer(customerId, tenantId, {
      DB: db,
      TOKEN_MANAGER: env.TOKEN_MANAGER,
      CUSTOMER_CACHE: env.CUSTOMER_CACHE,
    });

    if (customer) {
      await CustomerManager.deleteCustomer(customerId, tenantId, {
        DB: db,
        TOKEN_MANAGER: env.TOKEN_MANAGER,
        CUSTOMER_CACHE: env.CUSTOMER_CACHE,
      });

      // Invalidate cache
      if (env.CUSTOMER_CACHE) {
        const phoneHash = hashPhoneNumber(customer.phone, tenantId);
        await CustomerCache.invalidateCustomerCache(customerId, tenantId, phoneHash, env.CUSTOMER_CACHE);
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Customer deleted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/customers/:customerId/tags - Get customer tags
 */
async function handleGetCustomerTags(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const customerId = parts[parts.indexOf('customers') + 1];

    const db = await getTenantDatabase(tenantId, env);

    const tags = await CustomerTags.getCustomerTags(customerId, db);

    return new Response(JSON.stringify({ success: true, tags }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get customer tags error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/customers/:customerId/tags - Assign tag to customer
 */
async function handleAssignTag(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const customerId = parts[parts.indexOf('customers') + 1];
    const { tagId, assignedBy } = await request.json() as { tagId: string; assignedBy: string };

    const db = await getTenantDatabase(tenantId, env);

    await CustomerTags.assignTag(customerId, tagId, assignedBy, db);

    // Invalidate cache
    if (env.CUSTOMER_CACHE) {
      const customer = await CustomerManager.getCustomer(customerId, tenantId, {
        DB: db,
        TOKEN_MANAGER: env.TOKEN_MANAGER,
        CUSTOMER_CACHE: env.CUSTOMER_CACHE,
      });
      if (customer) {
        const phoneHash = hashPhoneNumber(customer.phone, tenantId);
        await CustomerCache.invalidateCustomerCache(customerId, tenantId, phoneHash, env.CUSTOMER_CACHE);
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Tag assigned' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Assign tag error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /api/customers/:customerId/tags/:tagId - Remove tag from customer
 */
async function handleRemoveTag(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const customerId = parts[parts.indexOf('customers') + 1];
    const tagId = parts[parts.length - 1];

    const db = await getTenantDatabase(tenantId, env);

    await CustomerTags.removeTag(customerId, tagId, db);

    // Invalidate cache
    if (env.CUSTOMER_CACHE) {
      const customer = await CustomerManager.getCustomer(customerId, tenantId, {
        DB: db,
        TOKEN_MANAGER: env.TOKEN_MANAGER,
        CUSTOMER_CACHE: env.CUSTOMER_CACHE,
      });
      if (customer) {
        const phoneHash = hashPhoneNumber(customer.phone, tenantId);
        await CustomerCache.invalidateCustomerCache(customerId, tenantId, phoneHash, env.CUSTOMER_CACHE);
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Tag removed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Remove tag error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/tag-definitions - Get all tag definitions for tenant
 */
async function handleGetTagDefinitions(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const db = await getTenantDatabase(tenantId, env);

    const tags = await CustomerTags.getTagDefinitions(tenantId, db);

    return new Response(JSON.stringify({ success: true, tags }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get tag definitions error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/tag-definitions - Create tag definition
 */
async function handleCreateTagDefinition(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const tagData = await request.json() as {
      name: string;
      color?: string;
      icon?: string;
      autoAssignRule?: CustomerTags.AutoAssignRule;
    };

    const db = await getTenantDatabase(tenantId, env);

    const tag = await CustomerTags.createTagDefinition(tenantId, tagData, db);

    return new Response(JSON.stringify({ success: true, tag }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create tag definition error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * PATCH /api/tag-definitions/:tagId - Update tag definition
 */
async function handleUpdateTagDefinition(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const tagId = url.pathname.split('/').filter(Boolean).pop() || '';
    const updates = await request.json() as {
      name?: string;
      color?: string;
      icon?: string;
      autoAssignRule?: CustomerTags.AutoAssignRule;
    };

    const db = await getTenantDatabase(tenantId, env);

    await CustomerTags.updateTagDefinition(tagId, updates, db);

    return new Response(JSON.stringify({ success: true, message: 'Tag updated' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update tag definition error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /api/tag-definitions/:tagId - Delete tag definition
 */
async function handleDeleteTagDefinition(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const tagId = url.pathname.split('/').filter(Boolean).pop() || '';

    const db = await getTenantDatabase(tenantId, env);

    await CustomerTags.deleteTagDefinition(tagId, db);

    return new Response(JSON.stringify({ success: true, message: 'Tag deleted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete tag definition error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/tag-definitions/stats - Get tag usage statistics
 */
async function handleGetTagStats(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const db = await getTenantDatabase(tenantId, env);

    const stats = await CustomerTags.getTagStats(tenantId, db);

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get tag stats error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/customers/:customerId/addresses - Get customer addresses
 */
async function handleGetCustomerAddresses(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const customerId = parts[parts.indexOf('customers') + 1];

    const db = await getTenantDatabase(tenantId, env);

    const addresses = await CustomerManager.getCustomerAddresses(customerId, tenantId, {
      DB: db,
      TOKEN_MANAGER: env.TOKEN_MANAGER,
      CUSTOMER_CACHE: env.CUSTOMER_CACHE,
    });

    return new Response(JSON.stringify({ success: true, addresses }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get customer addresses error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/customers/:customerId/addresses - Add customer address
 */
async function handleAddCustomerAddress(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const tenantId = getTenantIdFromHeaders(request);
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const customerId = parts[parts.indexOf('customers') + 1];
    const addressData = await request.json() as {
      label?: string;
      addressLine1: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      isDefault?: boolean;
    };

    const db = await getTenantDatabase(tenantId, env);

    const address = await CustomerManager.addCustomerAddress(customerId, tenantId, addressData, {
      DB: db,
      TOKEN_MANAGER: env.TOKEN_MANAGER,
      CUSTOMER_CACHE: env.CUSTOMER_CACHE,
    });

    return new Response(JSON.stringify({ success: true, address }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Add customer address error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
