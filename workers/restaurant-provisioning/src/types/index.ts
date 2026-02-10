/**
 * Type definitions for Restaurant Provisioning Worker
 */

import type { ProvisioningCoordinator } from '../durable-objects/ProvisioningCoordinator';

export interface CloudflareEnv {
  // Environment variables
  SERVICE_VERSION: string;
  BASE_DOMAIN: string;
  CLOUDFLARE_ACCOUNT_ID: string;

  // Secrets (set via wrangler secret put)
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_STORAGE_TOKEN?: string;

  // KV Namespaces
  TENANT_METADATA: KVNamespace;
  DOMAIN_METADATA: KVNamespace;

  // Service bindings (optional fallback)
  TOKEN_MANAGER?: any;

  // D1 Databases
  TENANTS_DB: D1Database;

  // R2 Buckets
  SCHEMA_STORAGE: R2Bucket;

  // Durable Objects
  PROVISIONING_DO: DurableObjectNamespace<ProvisioningCoordinator>;
}

declare global {
  type CloudflareEnv = import('./index').CloudflareEnv;
}
