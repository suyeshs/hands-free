/**
 * Token Manager Service
 *
 * Centralized token/secret management for all Handsfree platform workers.
 *
 * Features:
 * - Secure token storage with encryption
 * - Automatic token rotation
 * - Access control per worker
 * - Audit logging
 * - Cloudflare API token creation and management
 */

import { TokenVault } from './core/token-vault';
import { TokenRotator } from './core/token-rotator';
import { AccessControl } from './core/access-control';
import { AuditLogger } from './core/audit-logger';
import { CloudflareTokenManager } from './core/cloudflare-token-manager';

export { TokenRotatorDO } from './durable-objects/token-rotator-do';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Worker-Name',
    };

    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Initialize services
      const vault = new TokenVault(env);
      const accessControl = new AccessControl(env);
      const auditLogger = new AuditLogger(env);
      const cfTokenManager = new CloudflareTokenManager(env);

      // Extract authentication
      const workerName = request.headers.get('X-Worker-Name');
      const authHeader = request.headers.get('Authorization');

      // API Routes
      let response: Response;

      switch (true) {
        // ===== Public Token Access (for workers) =====
        case method === 'GET' && path.startsWith('/api/tokens/'):
          response = await handleGetToken(request, env, workerName, vault, accessControl, auditLogger);
          break;

        // ===== Admin Routes (require admin auth) =====
        case method === 'POST' && path === '/api/admin/tokens':
          response = await handleCreateToken(request, env, authHeader, vault, auditLogger);
          break;

        case method === 'PUT' && path.startsWith('/api/admin/tokens/'):
          response = await handleUpdateToken(request, env, authHeader, vault, auditLogger);
          break;

        case method === 'DELETE' && path.startsWith('/api/admin/tokens/'):
          response = await handleDeleteToken(request, env, authHeader, vault, auditLogger);
          break;

        case method === 'POST' && path === '/api/admin/tokens/rotate':
          response = await handleRotateToken(request, env, authHeader, vault, cfTokenManager, auditLogger);
          break;

        case method === 'GET' && path === '/api/admin/tokens':
          response = await handleListTokens(request, env, authHeader, vault);
          break;

        // ===== Access Policy Management =====
        case method === 'POST' && path === '/api/admin/policies':
          response = await handleCreatePolicy(request, env, authHeader, accessControl);
          break;

        case method === 'GET' && path === '/api/admin/policies':
          response = await handleListPolicies(request, env, authHeader, accessControl);
          break;

        // ===== Cloudflare Token Management =====
        case method === 'POST' && path === '/api/admin/cloudflare/create-token':
          response = await handleCreateCloudflareToken(request, env, authHeader, cfTokenManager, vault, auditLogger);
          break;

        case method === 'GET' && path === '/api/admin/cloudflare/permissions':
          response = await handleGetCloudflarePermissions(request, env, authHeader, cfTokenManager);
          break;

        // ===== Audit Logs =====
        case method === 'GET' && path === '/api/admin/audit':
          response = await handleGetAuditLogs(request, env, authHeader, auditLogger);
          break;

        // ===== Health Check =====
        case method === 'GET' && path === '/api/health':
          response = await handleHealthCheck(env);
          break;

        default:
          response = new Response(
            JSON.stringify({ error: 'Not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
      }

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;

    } catch (error) {
      console.error('Token Manager error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return new Response(
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
    }
  },

  // Scheduled handler for token rotation and cleanup
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Token Manager cron:', event.cron);

    const rotator = new TokenRotator(env);
    const auditLogger = new AuditLogger(env);

    switch (event.cron) {
      case '0 */6 * * *': // Every 6 hours
        await rotator.checkExpiringTokens();
        break;

      case '0 2 * * *': // Daily at 2 AM
        await rotator.performScheduledRotations();
        break;

      case '0 0 * * 0': // Weekly on Sunday
        await auditLogger.generateWeeklyReport();
        break;
    }
  },
};

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * Get token for a worker
 */
async function handleGetToken(
  request: Request,
  env: Env,
  workerName: string | null,
  vault: TokenVault,
  accessControl: AccessControl,
  auditLogger: AuditLogger
): Promise<Response> {
  if (!workerName) {
    return new Response(
      JSON.stringify({ error: 'X-Worker-Name header required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const tokenKeyEncoded = url.pathname.split('/').pop();

  if (!tokenKeyEncoded) {
    return new Response(
      JSON.stringify({ error: 'Token key required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Decode the token key (it may contain special characters like :)
  const tokenKey = decodeURIComponent(tokenKeyEncoded);

  // Check access
  const hasAccess = await accessControl.checkAccess(workerName, tokenKey);
  if (!hasAccess) {
    await auditLogger.logUnauthorizedAccess(workerName, tokenKey, request);
    return new Response(
      JSON.stringify({ error: 'Access denied' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get token
  const token = await vault.getToken(tokenKey);
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Token not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Log access
  await auditLogger.logTokenAccess(workerName, tokenKey, request);

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        value: token.value,
        expires: token.expires,
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Create new token (admin only)
 */
async function handleCreateToken(
  request: Request,
  env: Env,
  authHeader: string | null,
  vault: TokenVault,
  auditLogger: AuditLogger
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json() as any;
  const { service, key, value, expires, metadata } = body;

  if (!service || !key || !value) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: service, key, value' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const tokenKey = `${service}:${key}`;
  await vault.storeToken(tokenKey, value, expires, metadata);
  await auditLogger.logTokenCreation('admin', tokenKey);

  return new Response(
    JSON.stringify({
      success: true,
      data: { key: tokenKey },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Update existing token (admin only)
 */
async function handleUpdateToken(
  request: Request,
  env: Env,
  authHeader: string | null,
  vault: TokenVault,
  auditLogger: AuditLogger
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const tokenKey = url.pathname.split('/').pop();
  const body = await request.json() as any;

  if (!tokenKey) {
    return new Response(
      JSON.stringify({ error: 'Token key required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  await vault.storeToken(tokenKey, body.value, body.expires, body.metadata);
  await auditLogger.logTokenUpdate('admin', tokenKey);

  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Delete token (admin only)
 */
async function handleDeleteToken(
  request: Request,
  env: Env,
  authHeader: string | null,
  vault: TokenVault,
  auditLogger: AuditLogger
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const tokenKey = url.pathname.split('/').pop();

  if (!tokenKey) {
    return new Response(
      JSON.stringify({ error: 'Token key required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  await vault.deleteToken(tokenKey);
  await auditLogger.logTokenDeletion('admin', tokenKey);

  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Rotate token (admin only)
 */
async function handleRotateToken(
  request: Request,
  env: Env,
  authHeader: string | null,
  vault: TokenVault,
  cfTokenManager: CloudflareTokenManager,
  auditLogger: AuditLogger
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json() as any;
  const { tokenKey } = body;

  if (!tokenKey) {
    return new Response(
      JSON.stringify({ error: 'tokenKey required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get token metadata to determine type
  const metadata = await vault.getMetadata(tokenKey);

  if (metadata?.service === 'cloudflare') {
    // Rotate Cloudflare token
    const result = await cfTokenManager.rotateToken(tokenKey);
    await vault.storeToken(tokenKey, result.newToken, result.expires);
    await auditLogger.logTokenRotation('admin', tokenKey, 'cloudflare');
  } else {
    return new Response(
      JSON.stringify({ error: 'Token rotation not supported for this service' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Token rotated successfully',
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * List all tokens (admin only)
 */
async function handleListTokens(
  request: Request,
  env: Env,
  authHeader: string | null,
  vault: TokenVault
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const tokens = await vault.listTokens();

  return new Response(
    JSON.stringify({
      success: true,
      data: tokens,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Create access policy (admin only)
 */
async function handleCreatePolicy(
  request: Request,
  env: Env,
  authHeader: string | null,
  accessControl: AccessControl
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json() as any;
  const { workerName, allowedTokens, ipWhitelist } = body;

  if (!workerName || !allowedTokens) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: workerName, allowedTokens' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  await accessControl.createPolicy(workerName, allowedTokens, ipWhitelist);

  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * List access policies (admin only)
 */
async function handleListPolicies(
  request: Request,
  env: Env,
  authHeader: string | null,
  accessControl: AccessControl
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const policies = await accessControl.listPolicies();

  return new Response(
    JSON.stringify({
      success: true,
      data: policies,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Create Cloudflare API token (admin only)
 */
async function handleCreateCloudflareToken(
  request: Request,
  env: Env,
  authHeader: string | null,
  cfTokenManager: CloudflareTokenManager,
  vault: TokenVault,
  auditLogger: AuditLogger
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json() as any;
  const { name, permissions, scope, expiresIn } = body;

  if (!name || !permissions || !scope) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: name, permissions, scope' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const result = await cfTokenManager.createToken({
    name,
    permissions,
    scope,
    expiresIn,
  });

  // Store token in vault
  const tokenKey = `cloudflare:${name}`;
  await vault.storeToken(tokenKey, result.token, result.expiresOn, {
    service: 'cloudflare',
    tokenId: result.tokenId,
    permissions,
  });

  await auditLogger.logTokenCreation('admin', tokenKey, { cloudflareTokenId: result.tokenId });

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        tokenKey,
        tokenId: result.tokenId,
        expiresOn: result.expiresOn,
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Get Cloudflare permission groups (admin only)
 */
async function handleGetCloudflarePermissions(
  request: Request,
  env: Env,
  authHeader: string | null,
  cfTokenManager: CloudflareTokenManager
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const permissions = await cfTokenManager.getPermissionGroups();

  return new Response(
    JSON.stringify({
      success: true,
      data: permissions,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Get audit logs (admin only)
 */
async function handleGetAuditLogs(
  request: Request,
  env: Env,
  authHeader: string | null,
  auditLogger: AuditLogger
): Promise<Response> {
  if (!await verifyAdminAuth(authHeader, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const workerName = url.searchParams.get('worker');
  const tokenKey = url.searchParams.get('token');

  const logs = await auditLogger.getLogs({ limit, offset, workerName, tokenKey });

  return new Response(
    JSON.stringify({
      success: true,
      data: logs,
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Health check
 */
async function handleHealthCheck(env: Env): Promise<Response> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      tokenVault: await checkKVHealth(env.TOKEN_VAULT),
      tokenMetadata: await checkKVHealth(env.TOKEN_METADATA),
      accessPolicies: await checkKVHealth(env.ACCESS_POLICIES),
      auditDb: await checkD1Health(env.AUDIT_DB),
    },
  };

  const allHealthy = Object.values(health.checks).every(check => check === true);

  return new Response(
    JSON.stringify({
      success: allHealthy,
      data: health,
    }),
    {
      status: allHealthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify admin authentication
 */
async function verifyAdminAuth(authHeader: string | null, env: Env): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === env.ADMIN_API_KEY;
}

/**
 * Check KV namespace health
 */
async function checkKVHealth(kv: KVNamespace): Promise<boolean> {
  try {
    await kv.get('health-check');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check D1 database health
 */
async function checkD1Health(db: D1Database): Promise<boolean> {
  try {
    await db.prepare('SELECT 1').first();
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Types
// ============================================================================

interface Env {
  // KV Namespaces
  TOKEN_VAULT: KVNamespace;
  TOKEN_METADATA: KVNamespace;
  ACCESS_POLICIES: KVNamespace;

  // D1 Database
  AUDIT_DB: D1Database;

  // Durable Objects
  TOKEN_ROTATOR: DurableObjectNamespace;

  // Secrets
  MASTER_ENCRYPTION_KEY: string;
  BOOTSTRAP_API_TOKEN: string;
  ADMIN_API_KEY: string;

  // Vars
  SERVICE_VERSION: string;
  TOKEN_ROTATION_DAYS: string;
  AUDIT_LOG_RETENTION_DAYS: string;
}
