/**
 * Tenant Database Resolver
 *
 * Maps tenant IDs to their respective D1 database bindings.
 * Each tenant has their own isolated database for customer and order data.
 *
 * IMPORTANT: This now supports BOTH static (legacy) and dynamic (new provisioning) tenant databases.
 */

export interface RestaurantEnv {
  // KV Namespaces
  TENANT_METADATA: KVNamespace;
  CUSTOMER_CACHE: KVNamespace;

  // R2 Buckets
  ASSETS: R2Bucket;

  // Service Bindings
  TOKEN_MANAGER: Fetcher;

  // Workers for Platforms - Dispatch namespace for tenant-specific workers
  TENANT_DISPATCH: DispatchNamespace;

  // D1 Databases (tenant-specific - LEGACY static bindings)
  KHAO_PIYO_DB: D1Database;
  COORG_DB: D1Database;

  // Environment variables
  PLATFORM_DOMAIN: string;
  RESTAURANT_CLIENT_URL: string;
  SERVICE_VERSION: string;

  // Inventory integration (optional)
  INVENTORY_API_URL?: string;    // URL to vision-inventory worker
  INVENTORY_API_KEY?: string;    // API key for authentication

  // Cloudflare configuration
  CLOUDFLARE_ACCOUNT_ID?: string;

  // Secrets
  CUSTOMER_ENCRYPTION_KEYS?: string; // JSON: {"<canonicalTenantId>": "<base64Key>", ...}
}

/**
 * Tenant-to-Database mapping (LEGACY - for existing tenants)
 *
 * EXACT matching for specific legacy tenant IDs to database bindings
 * NEW TENANTS: These are provisioned dynamically and stored in TENANT_METADATA KV
 */
function getTenantDatabaseBinding(tenantId: string): keyof Pick<RestaurantEnv, 'KHAO_PIYO_DB' | 'COORG_DB'> | null {
  // Pattern matching for legacy tenants - all variants share the same DB
  if (tenantId.startsWith('khao-piyo-')) {
    return 'KHAO_PIYO_DB';
  }

  if (tenantId.startsWith('coorg-food-company-')) {
    return 'COORG_DB';
  }

  return null;
}

/**
 * Get the canonical tenant ID for encryption key lookup.
 * Pattern-based (legacy) tenants share one database and one encryption key.
 * New tenants always have their own canonical ID.
 */
export function getCanonicalTenantId(tenantId: string): string {
  if (tenantId.startsWith('khao-piyo-')) {
    return 'khao-piyo-7766';
  }
  if (tenantId.startsWith('coorg-food-company-')) {
    return 'coorg-food-company-6163';
  }
  return tenantId;
}


/**
 * Tenant metadata from KV
 */
interface TenantMetadataFromKV {
  tenant_id: string;
  subdomain?: string;
  full_domain?: string;
  database_id?: string;        // D1 database UUID
  database_name?: string;       // D1 database name
  d1_database_id?: string;      // Alternative field name
  d1_database_name?: string;    // Alternative field name
  kv_namespace_id?: string;
  r2_bucket_name?: string;
  created_at?: string;
}

/**
 * Get D1 database for a tenant
 *
 * @param tenantId - Tenant ID
 * @param env - Worker environment
 * @returns D1Database instance for the tenant
 * @throws Error if tenant database not found
 */
export function getTenantDatabase(tenantId: string, env: RestaurantEnv): D1Database {
  // Use pattern matching for legacy tenants
  const dbBinding = getTenantDatabaseBinding(tenantId);

  if (!dbBinding) {
    throw new Error(`No database configured for tenant: ${tenantId}`);
  }

  const db = env[dbBinding];

  if (!db) {
    throw new Error(`Database binding ${dbBinding} not found for tenant: ${tenantId}`);
  }

  return db;
}

/**
 * Check if a tenant has a configured database
 *
 * IMPORTANT: This function is now ASYNC to support dynamic tenant lookup
 *
 * @param tenantId - Tenant ID
 * @param env - Worker environment (optional, for dynamic lookup)
 * @returns true if tenant has a database configured (static or dynamic)
 */
export async function hasTenantDatabase(tenantId: string, env?: RestaurantEnv): Promise<boolean> {
  // Check static (legacy) tenants first using pattern matching
  if (getTenantDatabaseBinding(tenantId)) {
    return true;
  }

  // Check dynamically provisioned tenants from TENANT_METADATA KV
  if (env?.TENANT_METADATA) {
    try {
      const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}`, 'json') as TenantMetadataFromKV | null;

      if (metadata) {
        // Check if tenant has a D1 database ID
        const hasDatabaseId = !!(metadata.database_id || metadata.d1_database_id);
        if (hasDatabaseId) {
          console.log(`[TenantDBResolver] Tenant ${tenantId} has dynamic D1 database: ${metadata.database_id || metadata.d1_database_id}`);
          return true;
        }
      }
    } catch (error) {
      console.error(`[TenantDBResolver] Error checking dynamic tenant database for ${tenantId}:`, error);
    }
  }

  return false;
}

/**
 * LEGACY: Synchronous version for backward compatibility
 * Only checks static (hardcoded) tenants
 *
 * @deprecated Use hasTenantDatabase(tenantId, env) instead
 */
export function hasTenantDatabaseSync(tenantId: string): boolean {
  return !!getTenantDatabaseBinding(tenantId);
}

/**
 * Get list of all configured legacy tenant IDs
 *
 * @returns Array of legacy tenant IDs with static database bindings
 */
export function getConfiguredTenants(): string[] {
  return ['khao-piyo-7766', 'coorg-food-company-6163'];
}

/**
 * Get database info for a tenant
 *
 * @param tenantId - Tenant ID
 * @returns Database info or null if not found
 */
export function getTenantDatabaseInfo(tenantId: string): {
  tenantId: string;
  bindingName: string;
  databaseName: string;
  databaseId: string;
} | null {
  const bindingName = getTenantDatabaseBinding(tenantId);

  if (!bindingName) {
    return null;
  }

  // Database metadata (from wrangler.jsonc)
  const dbMetadata: Record<string, { name: string; id: string }> = {
    KHAO_PIYO_DB: {
      name: 'khao-piyo-7766_db',
      id: '42180598-d587-44a3-b867-c2624a891716',
    },
    COORG_DB: {
      name: 'coorg-food-company-6163_db',
      id: 'ad7d6f69-594d-4651-8250-4ec3fdb28435',
    },
  };

  const metadata = dbMetadata[bindingName];

  return {
    tenantId,
    bindingName,
    databaseName: metadata.name,
    databaseId: metadata.id,
  };
}
