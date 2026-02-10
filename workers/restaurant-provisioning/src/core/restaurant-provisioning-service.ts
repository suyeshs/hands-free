/**
 * Restaurant Provisioning Service
 *
 * Complete end-to-end tenant provisioning for restaurant POS systems.
 * Handles infrastructure, database, and activation code generation.
 */

import { TenantStorageProvisioner, type TenantStorageConfig } from './tenant-storage-provisioner';
import { DatabaseProvisioner, type DatabaseProvisioningResult } from './database-provisioner';
import { getCloudflareApiToken, getCloudflareStorageToken, initTokenManager } from '../lib/token-manager';

export interface RestaurantProvisioningRequest {
  tenantId: string;
  companyName: string;
  email: string;
  phone: string;
  ownerName?: string;
  city?: string;
  pincode?: string;
  businessCategory?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  state?: string;
  deliveryRadiusKm?: number;
}

export interface RestaurantProvisioningResult {
  success: boolean;
  tenantId: string;
  subdomain: string;
  fullDomain: string;
  storeUrl: string;
  activationCode: string;

  // Infrastructure details
  database: {
    id: string;
    name: string;
    tablesCreated: number;
    rowsInserted: number;
  };

  storage: {
    kvNamespaceData?: string;
    kvNamespaceCache?: string;
    kvNamespaceSessions?: string;
    r2BucketName?: string;
  };

  // Timestamps
  createdAt: string;

  error?: string;
}

export class RestaurantProvisioningService {
  private env: CloudflareEnv;
  private baseDomain: string;

  constructor(env: CloudflareEnv) {
    this.env = env;
    this.baseDomain = env.BASE_DOMAIN || 'handsfree.tech';

    // Initialize token manager with env for token access
    initTokenManager(env);
  }

  /**
   * Generate POS activation code (16 alphanumeric characters)
   */
  private generateActivationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking chars
    let code = '';
    for (let i = 0; i < 16; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      code += chars[randomIndex];
    }
    // Format as XXXX-XXXX-XXXX-XXXX
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
  }

  /**
   * Sanitize subdomain to ensure it's DNS-safe
   */
  private sanitizeSubdomain(subdomain: string): string {
    return subdomain
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .substring(0, 63);
  }

  /**
   * Generate unique subdomain from tenant ID
   */
  private generateSubdomain(tenantId: string): string {
    return this.sanitizeSubdomain(tenantId);
  }

  /**
   * Provision complete restaurant tenant
   */
  async provisionRestaurant(request: RestaurantProvisioningRequest): Promise<RestaurantProvisioningResult> {
    const startTime = Date.now();
    const now = new Date().toISOString();

    try {
      console.log(`[RestaurantProvisioning] Starting provisioning for ${request.tenantId}`);

      // Step 1: Generate subdomain
      const subdomain = this.generateSubdomain(request.tenantId);
      const fullDomain = `${subdomain}.${this.baseDomain}`;
      const storeUrl = `https://${fullDomain}`;

      console.log(`[RestaurantProvisioning] Subdomain: ${subdomain}`);
      console.log(`[RestaurantProvisioning] Full domain: ${fullDomain}`);

      // Step 2: Provision infrastructure (D1 + KV + R2)
      console.log(`[RestaurantProvisioning] Provisioning infrastructure...`);
      const storageToken = await getCloudflareStorageToken();
      const provisioner = new TenantStorageProvisioner(
        storageToken,
        this.env.CLOUDFLARE_ACCOUNT_ID
      );

      const storageConfig: TenantStorageConfig = await provisioner.provisionTenantStorage(
        request.tenantId,
        subdomain,
        (progress) => {
          console.log(`[Storage] ${progress.step}: ${progress.status}`, progress.resourceId || '');
        }
      );

      console.log(`[RestaurantProvisioning] Infrastructure provisioned:`, {
        d1DatabaseId: storageConfig.resources.d1DatabaseId,
        d1DatabaseName: storageConfig.resources.d1DatabaseName,
        kvNamespaces: storageConfig.resources.kvNamespaces,
        r2Bucket: storageConfig.resources.r2BucketName,
      });

      // Step 3: Provision database schema
      console.log(`[RestaurantProvisioning] Provisioning database schema...`);
      const dbProvisioner = new DatabaseProvisioner(
        storageToken,
        this.env.CLOUDFLARE_ACCOUNT_ID,
        this.env.SCHEMA_STORAGE
      );

      const dbResult: DatabaseProvisioningResult = await dbProvisioner.provisionDatabase({
        databaseId: storageConfig.resources.d1DatabaseId!,
        tenantId: request.tenantId,
        subdomain: subdomain,
        includeSeeds: true,
        schemaVersion: 'latest',
      });

      if (!dbResult.success) {
        throw new Error(`Database provisioning failed: ${dbResult.error}`);
      }

      console.log(`[RestaurantProvisioning] Database schema provisioned: ${dbResult.tablesCreated} tables, ${dbResult.rowsInserted} rows`);

      // Step 4: Generate activation code
      const activationCode = this.generateActivationCode();
      const normalizedCode = activationCode.replace(/-/g, '').toUpperCase();
      console.log(`[RestaurantProvisioning] Generated activation code: ${activationCode}`);

      // Step 5: Store activation code in TENANT_METADATA KV
      const activationKey = `pos_activation:${normalizedCode}`;
      const activationData = {
        tenantId: request.tenantId,
        companyName: request.companyName,
        ownerName: request.ownerName,
        createdAt: now,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      };

      await this.env.TENANT_METADATA.put(activationKey, JSON.stringify(activationData));
      console.log(`[RestaurantProvisioning] Stored activation code in KV`);

      // Step 6: Store tenant metadata in TENANT_METADATA KV
      // IMPORTANT: Use snake_case for d1_database_id/d1_database_name to match tenant-db-resolver.ts
      const tenantMetadata = {
        tenantId: request.tenantId,
        subdomain: subdomain,
        fullDomain: fullDomain,
        storeUrl: storeUrl,
        d1_database_id: storageConfig.resources.d1DatabaseId, // snake_case for compatibility
        d1_database_name: storageConfig.resources.d1DatabaseName, // snake_case for compatibility
        companyName: request.companyName,
        email: request.email,
        phone: request.phone,
        status: 'active',
        provisioningStatus: 'complete',
        createdAt: now,
      };

      await this.env.TENANT_METADATA.put(
        `tenant:${request.tenantId}`,
        JSON.stringify(tenantMetadata)
      );
      console.log(`[RestaurantProvisioning] Stored tenant metadata in KV with correct field names`);

      // Step 7: Insert tenant record into TENANTS_DB (handsfree-tenants)
      // Use INSERT OR REPLACE to make it idempotent
      console.log(`[RestaurantProvisioning] Inserting/updating tenant record in TENANTS_DB...`);
      await this.env.TENANTS_DB.prepare(
        `INSERT OR REPLACE INTO restaurant_tenants
         (tenant_id, company_name, email, phone, business_category, subdomain, full_domain, store_url,
          status, created_at, updated_at, address, latitude, longitude, place_id, city, state, pincode,
          delivery_radius_km, d1_database_id, d1_database_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        request.tenantId,
        request.companyName,
        request.email,
        request.phone || null,
        request.businessCategory || 'RESTAURANT',
        subdomain,
        fullDomain,
        storeUrl,
        'active', // Status is active since provisioning completed
        now,
        now,
        request.address || null,
        request.latitude || null,
        request.longitude || null,
        request.placeId || null,
        request.city || null,
        request.state || null,
        request.pincode || null,
        request.deliveryRadiusKm || 10,
        storageConfig.resources.d1DatabaseId,
        storageConfig.resources.d1DatabaseName
      ).run();

      console.log(`[RestaurantProvisioning] Tenant record inserted into TENANTS_DB`);

      // Step 8: Insert theme config into TENANTS_DB
      // Use INSERT OR REPLACE to make it idempotent
      const cuisineJson = request.businessCategory === 'RESTAURANT'
        ? JSON.stringify(['Multi-cuisine'])
        : null;

      await this.env.TENANTS_DB.prepare(
        `INSERT OR REPLACE INTO restaurant_theme_configs
         (tenant_id, name, description, cuisine, primary_color, secondary_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        request.tenantId,
        request.companyName,
        `Welcome to ${request.companyName}`,
        cuisineJson,
        '#FFA000',
        '#FF6F00',
        now,
        now
      ).run();

      console.log(`[RestaurantProvisioning] Theme config inserted`);

      // Step 9: Deploy tenant worker to dispatch namespace (non-blocking)
      // Worker deployment is handled separately to avoid blocking provisioning
      console.log(`[RestaurantProvisioning] Tenant worker deployment: MANUAL STEP REQUIRED`);
      console.log(`[RestaurantProvisioning] To deploy tenant worker, run:`);
      console.log(`  cd platform/workers/tenant-router/tenant-worker`);
      console.log(`  npx wrangler deploy --config - --dispatch-namespace handsfree-tenants --name tenant-${subdomain} <<EOF`);
      console.log(`  {`);
      console.log(`    "name": "tenant-${subdomain}",`);
      console.log(`    "main": "src/index.ts",`);
      console.log(`    "compatibility_date": "2024-12-18",`);
      console.log(`    "compatibility_flags": ["nodejs_compat"],`);
      console.log(`    "d1_databases": [`);
      console.log(`      {`);
      console.log(`        "binding": "DB",`);
      console.log(`        "database_id": "${storageConfig.resources.d1DatabaseId}",`);
      console.log(`        "database_name": "${storageConfig.resources.d1DatabaseName}"`);
      console.log(`      }`);
      console.log(`    ]`);
      console.log(`  }`);
      console.log(`  EOF`);
      console.log(`[RestaurantProvisioning] NOTE: Automated worker deployment will be added in future release`);

      const duration = Date.now() - startTime;
      console.log(`[RestaurantProvisioning] ✅ Provisioning complete in ${duration}ms`);

      // Return success result
      return {
        success: true,
        tenantId: request.tenantId,
        subdomain,
        fullDomain,
        storeUrl,
        activationCode,
        database: {
          id: storageConfig.resources.d1DatabaseId!,
          name: storageConfig.resources.d1DatabaseName!,
          tablesCreated: dbResult.tablesCreated,
          rowsInserted: dbResult.rowsInserted,
        },
        storage: {
          kvNamespaceData: storageConfig.resources.kvNamespaces?.data,
          kvNamespaceCache: storageConfig.resources.kvNamespaces?.cache,
          kvNamespaceSessions: storageConfig.resources.kvNamespaces?.sessions,
          r2BucketName: storageConfig.resources.r2BucketName,
        },
        createdAt: now,
      };

    } catch (error: any) {
      console.error(`[RestaurantProvisioning] ❌ Provisioning failed:`, error);
      console.error(`[RestaurantProvisioning] Error stack:`, error.stack);

      return {
        success: false,
        tenantId: request.tenantId,
        subdomain: '',
        fullDomain: '',
        storeUrl: '',
        activationCode: '',
        database: {
          id: '',
          name: '',
          tablesCreated: 0,
          rowsInserted: 0,
        },
        storage: {},
        createdAt: now,
        error: error.message || 'Unknown error occurred',
      };
    }
  }
}
