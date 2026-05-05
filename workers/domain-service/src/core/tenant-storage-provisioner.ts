/**
 * Tenant Storage Provisioner
 * 
 * Provisions separate storage resources for each tenant:
 * - KV Namespaces (per tenant)
 * - D1 Database (per tenant)
 * - R2 Bucket (per tenant)
 * 
 * Stores resource IDs for routing and cleanup.
 */

export interface TenantStorageConfig {
  tenantId: string;
  subdomain: string;
  resources: {
    kvNamespaces: {
      data: string;          // Main data storage KV
      cache: string;         // Cache KV
      sessions: string;      // Sessions KV
    };
    d1DatabaseId: string;    // Tenant database ID
    d1DatabaseName: string;  // Tenant database name
    r2BucketName: string;    // Tenant bucket name
  };
  createdAt: string;
  status: 'provisioning' | 'active' | 'suspended' | 'deleting';
}

export interface ProvisioningProgress {
  step: 'kv_data' | 'kv_cache' | 'kv_sessions' | 'd1_database' | 'r2_bucket' | 'completed';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  resourceId?: string;
  error?: string;
}

export class TenantStorageProvisioner {
  private apiToken: string;
  private accountId: string;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  /**
   * Provision all storage resources for a tenant
   */
  async provisionTenantStorage(
    tenantId: string,
    subdomain: string,
    onProgress?: (progress: ProvisioningProgress) => void
  ): Promise<TenantStorageConfig> {
    console.log(`[TenantStorageProvisioner] Starting provisioning for tenant: ${tenantId}, subdomain: ${subdomain}`);

    const config: TenantStorageConfig = {
      tenantId,
      subdomain,
      resources: {
        kvNamespaces: {
          data: '',
          cache: '',
          sessions: '',
        },
        d1DatabaseId: '',
        d1DatabaseName: '',
        r2BucketName: '',
      },
      createdAt: new Date().toISOString(),
      status: 'provisioning',
    };

    try {
      // Step 1: Create KV namespace for data
      console.log(`[TenantStorageProvisioner] Step 1/5: Creating KV namespace for data...`);
      onProgress?.({ step: 'kv_data', status: 'in_progress' });
      config.resources.kvNamespaces.data = await this.createKVNamespace(
        `${subdomain}_data`,
        `Data storage for ${subdomain}`
      );
      console.log(`[TenantStorageProvisioner] ✅ KV data namespace created: ${config.resources.kvNamespaces.data}`);
      onProgress?.({
        step: 'kv_data',
        status: 'completed',
        resourceId: config.resources.kvNamespaces.data
      });

      // Step 2: Create KV namespace for cache
      console.log(`[TenantStorageProvisioner] Step 2/5: Creating KV namespace for cache...`);
      onProgress?.({ step: 'kv_cache', status: 'in_progress' });
      config.resources.kvNamespaces.cache = await this.createKVNamespace(
        `${subdomain}_cache`,
        `Cache storage for ${subdomain}`
      );
      console.log(`[TenantStorageProvisioner] ✅ KV cache namespace created: ${config.resources.kvNamespaces.cache}`);
      onProgress?.({
        step: 'kv_cache',
        status: 'completed',
        resourceId: config.resources.kvNamespaces.cache
      });

      // Step 3: Create KV namespace for sessions
      console.log(`[TenantStorageProvisioner] Step 3/5: Creating KV namespace for sessions...`);
      onProgress?.({ step: 'kv_sessions', status: 'in_progress' });
      config.resources.kvNamespaces.sessions = await this.createKVNamespace(
        `${subdomain}_sessions`,
        `Session storage for ${subdomain}`
      );
      console.log(`[TenantStorageProvisioner] ✅ KV sessions namespace created: ${config.resources.kvNamespaces.sessions}`);
      onProgress?.({
        step: 'kv_sessions',
        status: 'completed',
        resourceId: config.resources.kvNamespaces.sessions
      });

      // Step 4: Create D1 Database
      console.log(`[TenantStorageProvisioner] Step 4/5: Creating D1 database...`);
      onProgress?.({ step: 'd1_database', status: 'in_progress' });
      const dbName = `${subdomain}_db`;
      config.resources.d1DatabaseId = await this.createD1Database(
        dbName,
        `Database for ${subdomain}`
      );
      config.resources.d1DatabaseName = dbName;
      console.log(`[TenantStorageProvisioner] ✅ D1 database created: ${config.resources.d1DatabaseId} (${dbName})`);
      onProgress?.({
        step: 'd1_database',
        status: 'completed',
        resourceId: config.resources.d1DatabaseId
      });

      // Step 5: Create R2 Bucket
      console.log(`[TenantStorageProvisioner] Step 5/5: Creating R2 bucket...`);
      onProgress?.({ step: 'r2_bucket', status: 'in_progress' });
      config.resources.r2BucketName = await this.createR2Bucket(
        `${subdomain}-files`
      );
      console.log(`[TenantStorageProvisioner] ✅ R2 bucket created: ${config.resources.r2BucketName}`);
      onProgress?.({
        step: 'r2_bucket',
        status: 'completed',
        resourceId: config.resources.r2BucketName
      });

      config.status = 'active';
      onProgress?.({ step: 'completed', status: 'completed' });

      console.log(`[TenantStorageProvisioner] ✅✅ All storage resources provisioned successfully for ${subdomain}`);
      console.log(`[TenantStorageProvisioner] Summary:`, JSON.stringify(config.resources, null, 2));

      return config;

    } catch (error) {
      config.status = 'suspended';
      console.error(`[TenantStorageProvisioner] ❌ Provisioning failed:`, error);
      console.error(`[TenantStorageProvisioner] Error details:`, error instanceof Error ? error.message : String(error));
      console.error(`[TenantStorageProvisioner] Partial config:`, JSON.stringify(config.resources, null, 2));
      throw new Error(`Failed to provision tenant storage: ${error}`);
    }
  }

  /**
   * Create KV Namespace with retry logic
   *
   * Cloudflare API has eventual consistency - namespace may not appear in listings
   * immediately after creation. We trust the creation response and only retry
   * if the API indicates the namespace already exists.
   */
  private async createKVNamespace(title: string, description?: string): Promise<string> {
    console.log(`[KVProvisioner] Creating KV namespace: ${title}`);

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        }
      );

      const data = await response.json() as any;

      if (!response.ok) {
        // Check if error is "already exists" (code 10026)
        const alreadyExists = data.errors?.some((e: any) =>
          e.code === 10026 || e.message?.includes('already exists')
        );

        if (alreadyExists) {
          console.log(`[KVProvisioner] Namespace ${title} already exists, finding it...`);
          return await this.findExistingKVNamespace(title);
        }

        throw new Error(`KV creation failed: ${JSON.stringify(data.errors)}`);
      }

      // Trust the creation response - namespace is created even if not in list yet
      const namespaceId = data.result.id;
      console.log(`[KVProvisioner] ✅ Created KV namespace: ${title} (${namespaceId})`);

      return namespaceId;

    } catch (error: any) {
      console.error(`[KVProvisioner] ❌ Failed to create KV namespace ${title}:`, error);
      throw error;
    }
  }

  /**
   * Find existing KV namespace with exponential backoff retry
   *
   * Used when namespace already exists and we need to retrieve its ID.
   * Retries with exponential backoff to handle API eventual consistency.
   */
  private async findExistingKVNamespace(title: string): Promise<string> {
    console.log(`[KVProvisioner] Finding existing namespace: ${title}`);

    // Exponential backoff: 2s, 4s, 8s, 16s, 32s = up to 62 seconds total
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to list KV namespaces: ${response.statusText}`);
        }

        const data = await response.json() as any;
        const namespace = data.result?.find((ns: any) => ns.title === title);

        if (namespace) {
          console.log(`[KVProvisioner] ✅ Found existing namespace: ${title} (${namespace.id})`);
          return namespace.id;
        }

        // Not found yet - wait with exponential backoff
        if (attempt < 4) {
          const delay = Math.min(2000 * Math.pow(2, attempt), 32000);
          console.log(`[KVProvisioner] Namespace not in list yet, waiting ${delay}ms (attempt ${attempt + 1}/5)`);
          await this.sleep(delay);
        }

      } catch (error) {
        console.error(`[KVProvisioner] Error listing namespaces (attempt ${attempt + 1}):`, error);
        if (attempt < 4) {
          const delay = Math.min(2000 * Math.pow(2, attempt), 32000);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `KV namespace "${title}" exists but cannot be found in list after 5 retries (62 seconds). ` +
      `This may be due to API propagation delays. The namespace should be available shortly.`
    );
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create D1 Database
   */
  private async createD1Database(name: string, description?: string): Promise<string> {
    console.log(`[D1Provisioner] Creating D1 database: ${name}`);
    console.log(`[D1Provisioner] Account ID: ${this.accountId}`);
    console.log(`[D1Provisioner] API Token (first 10 chars): ${this.apiToken?.substring(0, 10)}...`);

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database`;
    console.log(`[D1Provisioner] API URL: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    console.log(`[D1Provisioner] Response status: ${response.status} ${response.statusText}`);

    const data = await response.json() as any;
    console.log(`[D1Provisioner] Response data:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error(`[D1Provisioner] ❌ D1 creation failed:`, JSON.stringify(data, null, 2));
      throw new Error(`D1 creation failed: ${JSON.stringify(data)}`);
    }

    const databaseId = data.result?.uuid;
    if (!databaseId) {
      console.error(`[D1Provisioner] ❌ No UUID in response:`, JSON.stringify(data, null, 2));
      throw new Error(`D1 creation succeeded but no UUID returned: ${JSON.stringify(data)}`);
    }

    console.log(`[D1Provisioner] ✅ D1 database created successfully: ${databaseId}`);
    return databaseId;
  }

  /**
   * Create R2 Bucket
   */
  private async createR2Bucket(name: string): Promise<string> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`R2 creation failed: ${JSON.stringify(error)}`);
    }

    return name; // R2 returns the bucket name
  }

  /**
   * Delete all tenant storage resources
   */
  async deleteTenantStorage(config: TenantStorageConfig): Promise<void> {
    const errors: string[] = [];

    // Delete KV namespaces
    for (const [key, namespaceId] of Object.entries(config.resources.kvNamespaces)) {
      try {
        await this.deleteKVNamespace(namespaceId);
      } catch (error) {
        errors.push(`Failed to delete KV ${key}: ${error}`);
      }
    }

    // Delete D1 database
    try {
      await this.deleteD1Database(config.resources.d1DatabaseId);
    } catch (error) {
      errors.push(`Failed to delete D1: ${error}`);
    }

    // Delete R2 bucket
    try {
      await this.deleteR2Bucket(config.resources.r2BucketName);
    } catch (error) {
      errors.push(`Failed to delete R2: ${error}`);
    }

    if (errors.length > 0) {
      throw new Error(`Cleanup errors: ${errors.join(', ')}`);
    }
  }

  private async deleteKVNamespace(namespaceId: string): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`KV deletion failed: ${response.statusText}`);
    }
  }

  private async deleteD1Database(databaseId: string): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${databaseId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`D1 deletion failed: ${response.statusText}`);
    }
  }

  private async deleteR2Bucket(bucketName: string): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${bucketName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`R2 deletion failed: ${response.statusText}`);
    }
  }

  /**
   * Get tenant storage configuration by subdomain
   */
  static async getTenantConfig(
    subdomain: string,
    kvNamespace: KVNamespace
  ): Promise<TenantStorageConfig | null> {
    const config = await kvNamespace.get(`tenant:storage:${subdomain}`, 'json');
    return config as TenantStorageConfig | null;
  }

  /**
   * Save tenant storage configuration
   */
  static async saveTenantConfig(
    config: TenantStorageConfig,
    kvNamespace: KVNamespace
  ): Promise<void> {
    await kvNamespace.put(
      `tenant:storage:${config.subdomain}`,
      JSON.stringify(config)
    );
    
    // Also index by tenant ID for lookups
    await kvNamespace.put(
      `tenant:id:${config.tenantId}`,
      config.subdomain
    );
  }

  /**
   * List all tenant configurations
   */
  static async listTenantConfigs(
    kvNamespace: KVNamespace
  ): Promise<TenantStorageConfig[]> {
    const list = await kvNamespace.list({ prefix: 'tenant:storage:' });
    const configs: TenantStorageConfig[] = [];

    for (const key of list.keys) {
      const config = await kvNamespace.get(key.name, 'json');
      if (config) {
        configs.push(config as TenantStorageConfig);
      }
    }

    return configs;
  }
}

