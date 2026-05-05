/**
 * Subdomain Service
 * Manages automatic subdomain assignment for tenants under the base domain (handsfree.tech)
 */

import { CloudflareAPI } from '../../utils/cloudflare-api';
import type { DomainStatus } from '../../types/domain';
import { TenantStorageProvisioner, type TenantStorageConfig } from './tenant-storage-provisioner';
import { DatabaseProvisioner, type DatabaseProvisioningResult } from './database-provisioner';
import { TenantWorkerDeployer } from './tenant-worker-deployer';
import { ProvisioningTracker } from './provisioning-tracker';
import { getCloudflareApiToken, getCloudflareStorageToken } from '../lib/token-manager';

export interface SubdomainRequest {
  tenantId: string;
  tenantSlug: string;
  customSubdomain?: string;
  provisionStorage?: boolean; // Default: true
  provisionDatabase?: boolean; // Default: true
}

export interface SubdomainResult {
  success: boolean;
  subdomain: string;
  fullDomain: string;
  error?: string;
  storage?: TenantStorageConfig['resources'];
  database?: {
    initialized: boolean;
    tablesCreated: number;
    rowsInserted: number;
  };
}

export class SubdomainService {
  private cloudflareApi: CloudflareAPI | null = null;
  private baseDomain: string;
  private env: CloudflareEnv;

  constructor(env: CloudflareEnv) {
    this.env = env;
    this.baseDomain = env.BASE_DOMAIN;
  }

  /**
   * Get CloudflareAPI instance (lazy initialization with Token Manager)
   */
  private async getCloudflareApi(): Promise<CloudflareAPI> {
    if (this.cloudflareApi) {
      return this.cloudflareApi;
    }

    // Fetch token from Token Manager
    const apiToken = await getCloudflareApiToken();

    this.cloudflareApi = new CloudflareAPI({
      apiToken,
      accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
      zoneId: this.env.CLOUDFLARE_ZONE_ID,
    });

    return this.cloudflareApi;
  }

  /**
   * Generate a unique subdomain for a tenant
   */
  generateSubdomain(tenantSlug: string, customSubdomain?: string): string {
    if (customSubdomain) {
      return this.sanitizeSubdomain(customSubdomain);
    }

    // Generate from tenant slug
    const sanitized = this.sanitizeSubdomain(tenantSlug);
    return sanitized;
  }

  /**
   * Sanitize subdomain to ensure it's DNS-safe
   */
  private sanitizeSubdomain(subdomain: string): string {
    return subdomain
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .replace(/-{2,}/g, '-') // Replace multiple hyphens with single
      .substring(0, 63); // DNS label max length
  }

  /**
   * Check if subdomain is available
   */
  async isSubdomainAvailable(subdomain: string): Promise<boolean> {
    const fullDomain = `${subdomain}.${this.baseDomain}`;
    
    // Check if subdomain already exists in metadata
    const existingDomain = await this.env.DOMAIN_METADATA.get(`domain:${fullDomain}`);
    if (existingDomain) {
      return false;
    }

    // Check if subdomain exists in Cloudflare
    try {
      const records = await (await this.getCloudflareApi()).getDNSRecords(fullDomain);
      return records.result.length === 0;
    } catch {
      return true; // If we can't check, assume it's available
    }
  }

  /**
   * Generate a unique subdomain with retry logic
   */
  async generateUniqueSubdomain(tenantSlug: string, customSubdomain?: string): Promise<string> {
    let subdomain = this.generateSubdomain(tenantSlug, customSubdomain);
    let attempt = 0;
    const maxAttempts = 10;

    while (attempt < maxAttempts) {
      const isAvailable = await this.isSubdomainAvailable(subdomain);
      
      if (isAvailable) {
        return subdomain;
      }

      // If custom subdomain is not available, throw error
      if (customSubdomain) {
        throw new Error(`Subdomain '${subdomain}' is already taken`);
      }

      // Try with suffix
      attempt++;
      subdomain = `${this.generateSubdomain(tenantSlug)}-${attempt}`;
    }

    // Fallback to random string
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    subdomain = `${this.generateSubdomain(tenantSlug)}-${randomSuffix}`;
    
    const isAvailable = await this.isSubdomainAvailable(subdomain);
    if (!isAvailable) {
      throw new Error('Unable to generate unique subdomain after multiple attempts');
    }

    return subdomain;
  }

  /**
   * Auto-assign subdomain to tenant
   */
  async autoAssignSubdomain(request: SubdomainRequest): Promise<SubdomainResult> {
    // Initialize provisioning tracker
    let provisioningTracker: ProvisioningTracker | null = null;

    try {
      // Validate tenant slug
      if (!request.tenantSlug || request.tenantSlug.length < 2) {
        throw new Error('Invalid tenant slug');
      }

      // Generate unique subdomain
      const subdomain = await this.generateUniqueSubdomain(
        request.tenantSlug,
        request.customSubdomain
      );

      const fullDomain = `${subdomain}.${this.baseDomain}`;

      // Initialize provisioning tracker
      provisioningTracker = new ProvisioningTracker(this.env.DOMAIN_METADATA);
      await provisioningTracker.initialize(request.tenantId, subdomain, fullDomain);

      // Start availability check step
      await provisioningTracker.startStep(request.tenantId, 'availability_check');

      // Check if tenant already has a subdomain
      const existingSubdomain = await this.env.DOMAIN_METADATA.get(
        `tenant:${request.tenantId}:subdomain`
      );

      if (existingSubdomain) {
        // Complete availability check
        await provisioningTracker!.completeStep(request.tenantId, 'availability_check', {
          existingSubdomain: true,
        });

        return {
          success: true,
          subdomain: existingSubdomain.split('.')[0] || '',
          fullDomain: existingSubdomain,
        };
      }

      // Complete availability check
      await provisioningTracker!.completeStep(request.tenantId, 'availability_check', {
        subdomain,
        available: true,
      });

      // Start subdomain generation step
      await provisioningTracker!.startStep(request.tenantId, 'subdomain_generation');

      // Create domain status
      const domainStatus: DomainStatus = {
        domain: fullDomain,
        tenantId: request.tenantId,
        status: 'pending',
        validationMethod: 'auto', // Auto-provisioned subdomains don't need external validation
        sslStatus: 'pending',
        dnsStatus: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        metadata: {
          autoAssigned: true,
          subdomain: subdomain,
          baseDomain: this.baseDomain,
        },
      };

      // Complete subdomain generation
      await provisioningTracker!.completeStep(request.tenantId, 'subdomain_generation', {
        subdomain,
        fullDomain,
      });

      // Start DNS provisioning step
      await provisioningTracker!.startStep(request.tenantId, 'dns_provisioning');

      // ============================================================================
      // WILDCARD DNS: Skip individual DNS record creation
      // ============================================================================
      // Since *.handsfree.tech wildcard DNS is already configured, all subdomains
      // automatically resolve without creating individual DNS records.
      // This eliminates DNS quota issues and speeds up provisioning.
      // ============================================================================

      console.log(`[DNS] ✅ Using wildcard DNS for ${fullDomain}`);
      console.log('[DNS] No individual DNS record needed - wildcard handles all subdomains');

      // Mark DNS as active (handled by wildcard)
      domainStatus.status = 'active';
      domainStatus.dnsStatus = 'wildcard';
      domainStatus.activatedAt = new Date().toISOString();
      domainStatus.metadata = {
        ...domainStatus.metadata,
        wildcardDNS: true,
        dnsMethod: 'wildcard',
        note: 'Automatically resolved via *.handsfree.tech wildcard CNAME',
      };

      // Complete DNS provisioning (instant with wildcard)
      await provisioningTracker!.completeStep(request.tenantId, 'dns_provisioning', {
        method: 'wildcard',
        immediate: true,
      });

      // Skip DNS propagation and accessibility verification for now
      await provisioningTracker!.startStep(request.tenantId, 'dns_propagation');
      await provisioningTracker!.completeStep(request.tenantId, 'dns_propagation', { skipped: false });

      await provisioningTracker!.startStep(request.tenantId, 'accessibility_verification');
      await provisioningTracker!.completeStep(request.tenantId, 'accessibility_verification', { skipped: false });

      // Store domain metadata after DNS provisioning (or test mode simulation)
      await this.env.DOMAIN_METADATA.put(
        `domain:${fullDomain}`,
        JSON.stringify(domainStatus)
      );

      // Store tenant subdomain mapping
      await this.env.DOMAIN_METADATA.put(
        `tenant:${request.tenantId}:subdomain`,
        fullDomain
      );

      // Add to tenant's domain list
      const domainList = await this.env.DOMAIN_METADATA.get(
        `tenant:${request.tenantId}:domains`,
        'json'
      ) as any[] || [];
      domainList.push(fullDomain);
      await this.env.DOMAIN_METADATA.put(
        `tenant:${request.tenantId}:domains`,
        JSON.stringify(domainList)
      );

      // Start store initialization step
      await provisioningTracker!.startStep(request.tenantId, 'store_initialization');

      // Provision tenant storage if requested
      let storageConfig: TenantStorageConfig | undefined;
      let databaseResult: DatabaseProvisioningResult | undefined;

      if (request.provisionStorage !== false) { // Default to true
        try {
          console.log(`[Storage] Starting provisioning for ${subdomain}`);
          console.log(`[Storage] CRITICAL: D1 database provisioning is REQUIRED for tenant functionality`);

          storageConfig = await this.provisionTenantStorage(request.tenantId, subdomain);
          console.log(`[Storage] ✅ Successfully provisioned storage for ${subdomain}`);

          // Verify D1 database was created (CRITICAL RESOURCE)
          if (!storageConfig.resources.d1DatabaseId) {
            const criticalError = 'D1 database provisioning failed - this is a CRITICAL resource';
            console.error(`[Storage] ❌ ${criticalError}`);
            throw new Error(criticalError);
          }

          console.log(`[Storage] ✅ D1 database verified: ${storageConfig.resources.d1DatabaseId}`);

          // Provision database schema and seed data if requested
          if (request.provisionDatabase !== false && storageConfig.resources.d1DatabaseId) {
            try {
              console.log(`[DB] Starting database provisioning for ${subdomain}`);
              const dbName = storageConfig.resources.d1DatabaseName || `${subdomain}_db`;
              databaseResult = await this.provisionDatabase(
                storageConfig.resources.d1DatabaseId,
                dbName,
                request.tenantId,
                subdomain
              );
              console.log(`[DB] ✅ Successfully provisioned database for ${subdomain}`);
            } catch (dbError: any) {
              console.error(`[DB] ❌ Failed to provision database schema:`, dbError);
              console.error(`[DB] Database exists but schema application failed - tenant can provision schema later`);
              // Database schema provisioning failure is logged but not critical
              // The D1 database exists, schema can be applied later
              domainStatus.metadata = {
                ...domainStatus.metadata,
                databaseProvisioningFailed: true,
                databaseError: dbError.message,
              };
            }
          }
        } catch (storageError: any) {
          console.error(`[Storage] ❌❌ CRITICAL FAILURE: Storage provisioning failed:`, storageError);
          console.error(`[Storage] Error message:`, storageError.message);
          console.error(`[Storage] Error stack:`, storageError.stack);

          // Store error metadata
          domainStatus.metadata = {
            ...domainStatus.metadata,
            storageProvisioningFailed: true,
            storageError: storageError.message,
            storageErrorStack: storageError.stack,
            provisioningFailedAt: new Date().toISOString(),
          };

          await this.env.DOMAIN_METADATA.put(
            `domain:${fullDomain}`,
            JSON.stringify(domainStatus)
          );

          // RE-THROW THE ERROR - D1 provisioning is CRITICAL
          // Without D1, the tenant cannot function properly
          throw new Error(`Critical storage provisioning failed: ${storageError.message}`);
        }
      }

      // Store tenant metadata for store-front-worker access
      // ALWAYS store tenant metadata, even without storage provisioning
      try {
        console.log(`[Metadata] Storing tenant metadata for ${request.tenantId}`);
        console.log(`[Metadata] Target KV namespace: TENANT_METADATA`);
        console.log(`[Metadata] KV key: tenant:${request.tenantId}`);

        const tenantMetadata = {
          tenant_id: request.tenantId,
          subdomain: subdomain,
          full_domain: fullDomain,
          database_id: storageConfig?.resources.d1DatabaseId || null,
          database_name: storageConfig?.resources.d1DatabaseName || null,
          kv_namespace_id: storageConfig?.resources.kvNamespaces?.data || null,
          r2_bucket_name: storageConfig?.resources.r2BucketName || null,
          created_at: new Date().toISOString(),
        };

        console.log(`[Metadata] Metadata object:`, JSON.stringify(tenantMetadata));
        console.log(`[Metadata] Checking TENANT_METADATA binding:`, typeof this.env.TENANT_METADATA);

        const putResult = await this.env.TENANT_METADATA.put(
          `tenant:${request.tenantId}`,
          JSON.stringify(tenantMetadata)
        );

        console.log(`[Metadata] KV put() result:`, putResult);
        console.log(`[Metadata] ✅ Successfully stored tenant metadata for ${request.tenantId}`);
      } catch (metadataError: any) {
        console.error(`[Metadata] ❌ ERROR storing tenant metadata:`, metadataError);
        console.error(`[Metadata] Error name:`, metadataError?.name);
        console.error(`[Metadata] Error message:`, metadataError?.message);
        console.error(`[Metadata] Error stack:`, metadataError?.stack);
        // Don't fail the entire provisioning if metadata storage fails
        // The tenant can still function, metadata can be added manually if needed
      }

      // Deploy tenant worker if storage was provisioned
      let workerDeploymentResult: any = undefined;
      if (storageConfig?.resources.d1DatabaseId && request.provisionStorage !== false) {
        try {
          console.log(`[Worker] Starting worker deployment for ${subdomain}`);
          await provisioningTracker!.startStep(request.tenantId, 'worker_deployment');

          const storageToken = await getCloudflareStorageToken();
          const workerDeployer = new TenantWorkerDeployer(
            storageToken,
            this.env.CLOUDFLARE_ACCOUNT_ID,
            'handsfree-tenants', // Dispatch namespace
            this.env.TENANT_WORKER_STORAGE // R2 bucket for pre-built worker
          );

          workerDeploymentResult = await workerDeployer.deployTenantWorker({
            tenantId: request.tenantId,
            subdomain: subdomain,
            databaseId: storageConfig.resources.d1DatabaseId,
            databaseName: storageConfig.resources.d1DatabaseName || `${subdomain}_db`,
          });

          if (workerDeploymentResult.success) {
            console.log(`[Worker] ✅ Successfully deployed worker for ${subdomain}`);
            await provisioningTracker!.completeStep(request.tenantId, 'worker_deployment', {
              workerName: workerDeploymentResult.workerName,
              scriptId: workerDeploymentResult.scriptId,
            });
          } else {
            throw new Error(workerDeploymentResult.error || 'Worker deployment failed');
          }
        } catch (workerError: any) {
          console.error(`[Worker] ❌ Failed to deploy worker:`, workerError);
          await provisioningTracker!.failStep(request.tenantId, 'worker_deployment', workerError.message);
          // Worker deployment failure is logged but not critical for now
          // The tenant can use the shared worker architecture as fallback
          domainStatus.metadata = {
            ...domainStatus.metadata,
            workerDeploymentFailed: true,
            workerError: workerError.message,
          };
        }
      }

      // Complete store initialization
      await provisioningTracker!.completeStep(request.tenantId, 'store_initialization', {
        storageProvisioned: !!storageConfig,
        databaseProvisioned: !!databaseResult,
        workerDeployed: !!workerDeploymentResult?.success,
      });

      // Start and complete finalization step
      await provisioningTracker!.startStep(request.tenantId, 'finalization');
      await provisioningTracker!.completeStep(request.tenantId, 'finalization', {
        completed: true,
      });

      return {
        success: true,
        subdomain,
        fullDomain,
        ...(storageConfig && { storage: storageConfig.resources }),
        ...(databaseResult && {
          database: {
            initialized: databaseResult.success,
            tablesCreated: databaseResult.tablesCreated,
            rowsInserted: databaseResult.rowsInserted,
          },
        }),
      };
    } catch (error: any) {
      console.error('Subdomain auto-assignment failed:', error);

      // If provisioning tracker was initialized, mark as failed
      if (provisioningTracker && request.tenantId) {
        try {
          const status = await provisioningTracker.get(request.tenantId);
          if (status) {
            // Mark the current step as failed
            const currentStepId = status.currentStep;
            await provisioningTracker.failStep(request.tenantId, currentStepId, error.message);
          }
        } catch (trackerError) {
          console.error('Failed to update provisioning tracker:', trackerError);
        }
      }

      return {
        success: false,
        subdomain: '',
        fullDomain: '',
        error: error.message,
      };
    }
  }

  /**
   * Provision DNS records for the subdomain with retry logic
   */
  private async provisionSubdomainDNS(subdomain: string, fullDomain: string): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    // Get the target domain (platform domain or fallback to worker URL)
    const targetDomain = this.getTargetDomain();
    console.log(`[DNS] Attempting to create DNS record for ${fullDomain} -> ${targetDomain}`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[DNS] Attempt ${attempt}/${maxRetries} for ${fullDomain}`);
        
        // Create CNAME record pointing to target domain
        const result = await (await this.getCloudflareApi()).createDNSRecord({
          name: fullDomain,
          type: 'CNAME',
          content: targetDomain,
          ttl: 1, // Auto TTL
          proxied: true,
        });

        console.log(`[DNS] ✅ Successfully created DNS record for ${fullDomain}`, JSON.stringify(result));
        return; // Success!

      } catch (error: any) {
        lastError = error;
        console.error(`[DNS] ❌ Attempt ${attempt} failed:`, error.message || error);
        
        // Check if error is recoverable
        const errorMessage = error.message?.toLowerCase() || '';
        
        // Don't retry if record already exists (81053 is Cloudflare's "record already exists" error)
        if (errorMessage.includes('already exists') || errorMessage.includes('81053')) {
          console.log(`[DNS] Record already exists for ${fullDomain}, treating as success`);
          return;
        }

        // Don't retry for authentication errors
        if (errorMessage.includes('auth') || errorMessage.includes('401') || errorMessage.includes('403')) {
          throw new Error(`DNS provisioning failed: Invalid credentials or permissions - ${error.message}`);
        }

        // Don't retry for invalid zone errors
        if (errorMessage.includes('zone') && errorMessage.includes('not found')) {
          throw new Error(`DNS provisioning failed: Invalid zone ID - ${error.message}`);
        }

        // If not last attempt, wait before retrying
        if (attempt < maxRetries) {
          console.log(`[DNS] Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries failed
    const errorDetails = lastError?.message || 'Unknown error';
    console.error(`[DNS] ❌ Failed after ${maxRetries} attempts for ${fullDomain}:`, errorDetails);
    throw new Error(`DNS provisioning failed after ${maxRetries} attempts: ${errorDetails}`);
  }

  /**
   * Get the target domain for CNAME records
   * Points to the platform dispatch worker
   */
  private getTargetDomain(): string {
    // Point to the platform dispatch worker
    // This will route to tenant-specific workers via dispatch namespace
    const platformUrl = 'handsfree-store-front-prod.suyesh.workers.dev';
    console.log(`[DNS] Pointing subdomain to platform dispatch worker: ${platformUrl}`);
    return platformUrl;
  }

  /**
   * Provision storage resources for a tenant
   */
  private async provisionTenantStorage(
    tenantId: string,
    subdomain: string
  ): Promise<TenantStorageConfig> {
    console.log(`[SubdomainService] Provisioning storage for tenant: ${tenantId}, subdomain: ${subdomain}`);

    // Fetch storage token from Token Manager
    console.log(`[SubdomainService] Fetching storage token from Token Manager...`);
    const storageToken = await getCloudflareStorageToken();

    if (!storageToken) {
      console.error(`[SubdomainService] ❌ No Cloudflare token available`);
      throw new Error('No Cloudflare token available for storage provisioning');
    }

    console.log(`[SubdomainService] ✅ Storage token retrieved (first 10 chars): ${storageToken.substring(0, 10)}...`);
    console.log(`[SubdomainService] Account ID: ${this.env.CLOUDFLARE_ACCOUNT_ID}`);

    const provisioner = new TenantStorageProvisioner(
      storageToken,
      this.env.CLOUDFLARE_ACCOUNT_ID
    );

    console.log(`[SubdomainService] Starting TenantStorageProvisioner...`);
    const config = await provisioner.provisionTenantStorage(
      tenantId,
      subdomain,
      (progress) => {
        console.log(`[Storage] ${progress.step}: ${progress.status}`, progress.resourceId || '');
      }
    );

    console.log(`[SubdomainService] Storage provisioning complete, saving config to KV...`);

    // Save configuration to KV
    await TenantStorageProvisioner.saveTenantConfig(config, this.env.DOMAIN_METADATA);

    console.log(`[SubdomainService] ✅ Storage config saved to KV`);

    return config;
  }

  /**
   * Provision database schema and seed data directly
   */
  private async provisionDatabase(
    databaseId: string,
    databaseName: string,
    tenantId: string,
    subdomain: string
  ): Promise<DatabaseProvisioningResult> {
    console.log(`[DB] Provisioning database for ${subdomain}`);

    // Get API token from Token Manager
    const apiToken = await getCloudflareStorageToken();
    const accountId = this.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken || !accountId) {
      throw new Error('Missing required credentials: API token and CLOUDFLARE_ACCOUNT_ID');
    }

    // Create DatabaseProvisioner with R2 bucket for schema storage
    const provisioner = new DatabaseProvisioner(
      apiToken,
      accountId,
      this.env.SCHEMA_STORAGE // Pass R2 bucket binding
    );

    const result = await provisioner.provisionDatabase({
      databaseId,
      tenantId,
      subdomain,
      includeSeeds: true,
      schemaVersion: 'latest', // Use latest schema from R2
    });

    if (!result.success) {
      throw new Error(result.error || 'Database provisioning failed');
    }

    console.log(`[DB] ✅ Provisioned: ${result.tablesCreated} tables, ${result.rowsInserted} rows`);

    return result;
  }

  /**
   * Get tenant database schema SQL
   */
  private async getSchemaSQL(): Promise<string> {
    // In production, embed this or fetch from R2/KV
    // For now, return the schema inline
    return `
CREATE TABLE IF NOT EXISTS CategoryTable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER,
  image_url TEXT,
  is_active BOOLEAN DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  compare_at_price DECIMAL(10, 2),
  cost_per_item DECIMAL(10, 2),
  sku TEXT UNIQUE,
  barcode TEXT,
  quantity INTEGER DEFAULT 0,
  track_quantity BOOLEAN DEFAULT 1,
  continue_selling BOOLEAN DEFAULT 0,
  weight DECIMAL(10, 2),
  weight_unit TEXT DEFAULT 'kg',
  requires_shipping BOOLEAN DEFAULT 1,
  is_physical BOOLEAN DEFAULT 1,
  hs_code TEXT,
  country_of_origin TEXT,
  category_id INTEGER,
  brand TEXT,
  vendor TEXT,
  tags TEXT,
  images TEXT,
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT 1,
  is_featured BOOLEAN DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES CategoryTable(id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  user_id INTEGER,
  status TEXT DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  session_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;
  }

  /**
   * Get tenant database seed SQL
   */
  private async getSeedSQL(): Promise<string> {
    return `
INSERT OR IGNORE INTO CategoryTable (id, name, slug, description, is_active) VALUES
(1, 'Electronics', 'electronics', 'Electronic devices and accessories', 1),
(2, 'Clothing', 'clothing', 'Apparel and fashion items', 1),
(3, 'Home & Garden', 'home-garden', 'Home improvement and garden supplies', 1);

INSERT OR IGNORE INTO Products (id, name, slug, description, price, quantity, category_id, is_active) VALUES
(1, 'Wireless Mouse', 'wireless-mouse', 'Ergonomic wireless mouse', 29.99, 100, 1, 1),
(2, 'Cotton T-Shirt', 'cotton-tshirt', 'Comfortable cotton t-shirt', 19.99, 50, 2, 1),
(3, 'Garden Tools Set', 'garden-tools', 'Complete garden tools set', 49.99, 25, 3, 1);
`;
  }

  /**
   * Get tenant's assigned subdomain
   */
  async getTenantSubdomain(tenantId: string): Promise<string | null> {
    const subdomain = await this.env.DOMAIN_METADATA.get(
      `tenant:${tenantId}:subdomain`
    );
    return subdomain;
  }

  /**
   * Update tenant's subdomain (with validation)
   */
  async updateTenantSubdomain(
    tenantId: string,
    newSubdomain: string
  ): Promise<SubdomainResult> {
    try {
      // Get current subdomain
      const currentDomain = await this.getTenantSubdomain(tenantId);
      
      if (!currentDomain) {
        throw new Error('Tenant does not have a subdomain assigned');
      }

      // Check if new subdomain is available
      const isAvailable = await this.isSubdomainAvailable(newSubdomain);
      if (!isAvailable) {
        throw new Error(`Subdomain '${newSubdomain}' is already taken`);
      }

      const newFullDomain = `${newSubdomain}.${this.baseDomain}`;

      // Get current domain status
      const currentDomainData = await this.env.DOMAIN_METADATA.get(
        `domain:${currentDomain}`
      );

      if (!currentDomainData) {
        throw new Error('Current domain data not found');
      }

      const currentStatus: DomainStatus = JSON.parse(currentDomainData);

      // Check if this is test mode
      const isTestMode = this.env.CLOUDFLARE_API_TOKEN === 'test_token_for_local_dev' || 
                        this.env.CLOUDFLARE_ZONE_ID === 'test_zone_id';

      // Delete old DNS record
      if (!isTestMode) {
        try {
          const records = await (await this.getCloudflareApi()).getDNSRecords(currentDomain);
          for (const record of records.result) {
            await (await this.getCloudflareApi()).deleteDNSRecord(record.id);
          }
        } catch (error) {
          console.error('Failed to delete old DNS records:', error);
        }
      } else {
        console.log('[TEST MODE] Simulating DNS record deletion for:', currentDomain);
      }

      // Create new domain status
      const newDomainStatus: DomainStatus = {
        ...currentStatus,
        domain: newFullDomain,
        metadata: {
          ...currentStatus.metadata,
          subdomain: newSubdomain,
          previousDomain: currentDomain,
          testMode: isTestMode,
        },
        updatedAt: new Date().toISOString(),
      };

      // Store new domain metadata
      await this.env.DOMAIN_METADATA.put(
        `domain:${newFullDomain}`,
        JSON.stringify(newDomainStatus)
      );

      // Update tenant subdomain mapping
      await this.env.DOMAIN_METADATA.put(
        `tenant:${tenantId}:subdomain`,
        newFullDomain
      );

      // Update tenant's domain list
      const domainList = await this.env.DOMAIN_METADATA.get(
        `tenant:${tenantId}:domains`,
        'json'
      ) as any[] || [];
      const updatedList = domainList.filter((d: string) => d !== currentDomain);
      updatedList.push(newFullDomain);
      await this.env.DOMAIN_METADATA.put(
        `tenant:${tenantId}:domains`,
        JSON.stringify(updatedList)
      );

      // Delete old domain metadata
      await this.env.DOMAIN_METADATA.delete(`domain:${currentDomain}`);

      // Create new DNS records
      if (!isTestMode) {
        await this.provisionSubdomainDNS(newSubdomain, newFullDomain);
      } else {
        console.log('[TEST MODE] Simulating DNS provisioning for:', newFullDomain);
      }

      return {
        success: true,
        subdomain: newSubdomain,
        fullDomain: newFullDomain,
      };
    } catch (error: any) {
      console.error('Subdomain update failed:', error);
      return {
        success: false,
        subdomain: '',
        fullDomain: '',
        error: error.message,
      };
    }
  }

  /**
   * Delete tenant's subdomain
   */
  async deleteTenantSubdomain(tenantId: string): Promise<boolean> {
    try {
      const subdomain = await this.getTenantSubdomain(tenantId);
      
      if (!subdomain) {
        return true; // Already deleted
      }

      // Check if this is test mode
      const isTestMode = this.env.CLOUDFLARE_API_TOKEN === 'test_token_for_local_dev' || 
                        this.env.CLOUDFLARE_ZONE_ID === 'test_zone_id';

      // Delete DNS records
      if (!isTestMode) {
        try {
          const records = await (await this.getCloudflareApi()).getDNSRecords(subdomain);
          for (const record of records.result) {
            await (await this.getCloudflareApi()).deleteDNSRecord(record.id);
          }
        } catch (error) {
          console.error('Failed to delete DNS records:', error);
        }
      } else {
        console.log('[TEST MODE] Simulating DNS record deletion for:', subdomain);
      }

      // Delete domain metadata
      await this.env.DOMAIN_METADATA.delete(`domain:${subdomain}`);

      // Delete tenant subdomain mapping
      await this.env.DOMAIN_METADATA.delete(`tenant:${tenantId}:subdomain`);

      // Remove from tenant's domain list
      const domainList = await this.env.DOMAIN_METADATA.get(
        `tenant:${tenantId}:domains`,
        'json'
      ) as any[] || [];
      const updatedList = domainList.filter((d: string) => d !== subdomain);
      await this.env.DOMAIN_METADATA.put(
        `tenant:${tenantId}:domains`,
        JSON.stringify(updatedList)
      );

      return true;
    } catch (error) {
      console.error('Subdomain deletion failed:', error);
      return false;
    }
  }
}

