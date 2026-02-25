/**
 * Dynamic D1 Database Client
 *
 * Provides functions to access tenant-specific D1 databases dynamically
 * using the Cloudflare D1 HTTP API instead of static bindings.
 */

interface D1QueryResult {
  success: boolean;
  result: Array<{
    results: any[];
    success: boolean;
    meta: {
      duration: number;
      changes?: number;
      last_row_id?: number;
      rows_read?: number;
      rows_written?: number;
    };
  }>;
  errors?: Array<{ code: number; message: string }>;
}

// Token cache - avoids fetching from Token Manager on every request
// This is a MAJOR performance optimization (saves 100-500ms per request)
let cachedToken: { value: string; expiresAt: number } | null = null;
const TOKEN_CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch Cloudflare API token from Token Manager with caching
 */
async function getCloudflareApiToken(): Promise<string> {
  // Check cache first
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.value;
  }

  const tokenManagerUrl = 'https://handsfree-token-manager.suyesh.workers.dev';
  const tokenKey = 'cloudflare:d1_token';

  console.log('[D1Client] Fetching D1 token from Token Manager...');

  const tokenResponse = await fetch(`${tokenManagerUrl}/api/tokens/${encodeURIComponent(tokenKey)}`, {
    headers: {
      'X-Worker-Name': 'handsfree-restaurant-client',
    },
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('[D1Client] Failed to fetch token from Token Manager:', tokenResponse.status, errorText);
    throw new Error(`Failed to fetch D1 token from Token Manager (status: ${tokenResponse.status})`);
  }

  const tokenData = await tokenResponse.json() as {
    success: boolean;
    data?: { value: string };
    error?: string;
  };

  if (!tokenData.success || !tokenData.data?.value) {
    console.error('[D1Client] Invalid token response:', tokenData);
    throw new Error('Failed to retrieve valid D1 token');
  }

  // Cache the token
  cachedToken = {
    value: tokenData.data.value,
    expiresAt: now + TOKEN_CACHE_DURATION_MS,
  };

  console.log('[D1Client] D1 token retrieved and cached for 10 minutes');
  return tokenData.data.value;
}

/**
 * Get tenant database ID from KV storage
 */
export async function getTenantDatabaseId(
  tenantId: string,
  env: { TENANT_METADATA: KVNamespace }
): Promise<string | null> {
  const storageKey = `tenant:storage:${tenantId}`;
  const storageConfig = await env.TENANT_METADATA.get(storageKey, 'json');

  if (!storageConfig || typeof storageConfig !== 'object') {
    console.error(`[D1] No storage config found for tenant: ${tenantId}`);
    return null;
  }

  const config = storageConfig as { databaseId?: string };
  return config.databaseId || null;
}

/**
 * Query tenant database using Cloudflare D1 HTTP API
 */
export async function queryTenantDatabase(
  databaseId: string,
  sql: string,
  params: any[] = [],
  env: { CLOUDFLARE_ACCOUNT_ID: string }
): Promise<any[]> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;

  if (!accountId) {
    throw new Error('Missing CLOUDFLARE_ACCOUNT_ID environment variable');
  }

  // Fetch token from Token Manager
  const apiToken = await getCloudflareApiToken();

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[D1] HTTP API error:', errorText);
    throw new Error(`D1 API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as D1QueryResult;

  if (!data.success) {
    const errorMsg = data.errors?.map(e => e.message).join(', ') || 'Unknown error';
    console.error('[D1] Query failed:', errorMsg);
    throw new Error(`D1 query failed: ${errorMsg}`);
  }

  // Return results from first query result
  return data.result[0]?.results || [];
}

/**
 * Execute a prepared statement on tenant database
 */
export async function executeTenantQuery(
  tenantId: string,
  sql: string,
  params: any[] = [],
  env: {
    TENANT_METADATA: KVNamespace;
    CLOUDFLARE_ACCOUNT_ID: string;
  }
): Promise<any[]> {
  // Step 1: Get database ID from KV
  const databaseId = await getTenantDatabaseId(tenantId, env);

  if (!databaseId) {
    throw new Error(`No database found for tenant: ${tenantId}`);
  }

  // Step 2: Execute query via HTTP API
  return await queryTenantDatabase(databaseId, sql, params, env);
}

/**
 * Execute a write operation (INSERT, UPDATE, DELETE) on tenant database
 * Returns the number of affected rows
 */
export async function executeTenantWrite(
  tenantId: string,
  sql: string,
  params: any[] = [],
  env: {
    TENANT_METADATA: KVNamespace;
    CLOUDFLARE_ACCOUNT_ID: string;
  }
): Promise<{ changes: number; lastRowId?: number }> {
  const databaseId = await getTenantDatabaseId(tenantId, env);

  if (!databaseId) {
    throw new Error(`No database found for tenant: ${tenantId}`);
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;

  if (!accountId) {
    throw new Error('Missing CLOUDFLARE_ACCOUNT_ID environment variable');
  }

  // Fetch token from Token Manager
  const apiToken = await getCloudflareApiToken();

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[D1] HTTP API error:', errorText);
    throw new Error(`D1 API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as D1QueryResult;

  if (!data.success) {
    const errorMsg = data.errors?.map(e => e.message).join(', ') || 'Unknown error';
    console.error('[D1] Query failed:', errorMsg);
    throw new Error(`D1 query failed: ${errorMsg}`);
  }

  const meta = data.result[0]?.meta;
  return {
    changes: meta?.changes || 0,
    lastRowId: meta?.last_row_id,
  };
}

/**
 * Execute multiple queries in a batch (transaction)
 */
export async function executeTenantBatch(
  tenantId: string,
  queries: Array<{ sql: string; params?: any[] }>,
  env: {
    TENANT_METADATA: KVNamespace;
    CLOUDFLARE_ACCOUNT_ID: string;
  }
): Promise<any[][]> {
  const databaseId = await getTenantDatabaseId(tenantId, env);

  if (!databaseId) {
    throw new Error(`No database found for tenant: ${tenantId}`);
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;

  if (!accountId) {
    throw new Error('Missing CLOUDFLARE_ACCOUNT_ID environment variable');
  }

  // Fetch token from Token Manager
  const apiToken = await getCloudflareApiToken();

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  // Execute queries sequentially (D1 HTTP API doesn't support true batch/transaction)
  const results: any[][] = [];

  for (const query of queries) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: query.sql,
        params: query.params || [],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[D1] Batch query error:', errorText);
      throw new Error(`D1 batch query failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as D1QueryResult;

    if (!data.success) {
      const errorMsg = data.errors?.map(e => e.message).join(', ') || 'Unknown error';
      console.error('[D1] Batch query failed:', errorMsg);
      throw new Error(`D1 batch query failed: ${errorMsg}`);
    }

    results.push(data.result[0]?.results || []);
  }

  return results;
}
