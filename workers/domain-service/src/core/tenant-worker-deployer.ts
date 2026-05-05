/**
 * Tenant Worker Deployer
 *
 * Deploys tenant-specific workers to Workers for Platforms dispatch namespace.
 * Each tenant worker has a dynamically bound D1 database.
 *
 * This now automatically deploys via Cloudflare API during provisioning.
 */

export interface TenantWorkerConfig {
  tenantId: string;
  subdomain: string;
  databaseId: string;
  databaseName: string;
}

export interface DeploymentResult {
  success: boolean;
  workerName: string;
  scriptId: string;
  error?: string;
}

export class TenantWorkerDeployer {
  constructor(
    private apiToken: string,
    private accountId: string,
    private dispatchNamespace: string = 'handsfree-tenants',
    private r2Bucket?: any // R2 bucket for fetching pre-built worker
  ) {}

  /**
   * Deploy a tenant worker with D1 binding using Cloudflare API
   *
   * This method deploys the pre-built tenant worker script to the dispatch namespace
   * with the correct bindings for the tenant's D1 database.
   */
  async deployTenantWorker(config: TenantWorkerConfig): Promise<DeploymentResult> {
    const workerName = `tenant-${config.subdomain}`;

    try {
      console.log(`[TenantWorker] 🚀 Starting automated deployment:`);
      console.log(`[TenantWorker]   Worker Name: ${workerName}`);
      console.log(`[TenantWorker]   Tenant ID: ${config.tenantId}`);
      console.log(`[TenantWorker]   Database: ${config.databaseName} (${config.databaseId})`);
      console.log(`[TenantWorker]   Dispatch Namespace: ${this.dispatchNamespace}`);

      // Fetch the pre-built worker script from the tenant-worker dist
      const workerScript = await this.fetchTenantWorkerScript();

      if (!workerScript) {
        throw new Error('Failed to fetch tenant worker script');
      }

      console.log(`[TenantWorker] ✅ Fetched worker script (${workerScript.length} bytes)`);

      // Deploy to dispatch namespace using Cloudflare API
      const deploymentResult = await this.deployToDispatchNamespace(
        workerName,
        workerScript,
        config
      );

      if (deploymentResult.success) {
        console.log(`[TenantWorker] ✅ Successfully deployed ${workerName} to dispatch namespace`);
        return {
          success: true,
          workerName,
          scriptId: deploymentResult.scriptId || workerName
        };
      } else {
        throw new Error(deploymentResult.error || 'Deployment failed');
      }

    } catch (error: any) {
      console.error(`[TenantWorker] ❌ Deployment failed:`, error);
      console.error(`[TenantWorker] Error details:`, error.message);

      // Log manual fallback option
      console.log(`[TenantWorker] 📋 Manual deployment fallback:`);
      console.log(`[TenantWorker]    bash platform/scripts/provision-tenant-worker.sh ${config.tenantId} ${config.databaseId} ${config.databaseName}`);

      return {
        success: false,
        workerName,
        scriptId: '',
        error: error.message
      };
    }
  }

  /**
   * Fetch the pre-built tenant worker script from R2
   */
  private async fetchTenantWorkerScript(): Promise<string | null> {
    try {
      if (!this.r2Bucket) {
        console.log(`[TenantWorker] ⚠️  No R2 bucket configured for worker storage`);
        console.log(`[TenantWorker] 📋 Manual deployment required - see TENANT_WORKER_AUTOMATION.md`);
        return null;
      }

      console.log(`[TenantWorker] Fetching pre-built worker from R2...`);

      // Fetch the latest built worker from R2
      const object = await this.r2Bucket.get('tenant-worker-latest.js');

      if (!object) {
        console.log(`[TenantWorker] ⚠️  Worker script not found in R2`);
        console.log(`[TenantWorker] 📋 Run: bash platform/scripts/build-and-upload-tenant-worker.sh`);
        return null;
      }

      const workerScript = await object.text();
      console.log(`[TenantWorker] ✅ Fetched worker script from R2 (${workerScript.length} bytes)`);

      return workerScript;

    } catch (error: any) {
      console.error(`[TenantWorker] ❌ Failed to fetch worker from R2:`, error);
      console.error(`[TenantWorker] Error:`, error.message);
      return null;
    }
  }

  /**
   * Deploy worker to dispatch namespace using Cloudflare API
   */
  private async deployToDispatchNamespace(
    workerName: string,
    workerScript: string,
    config: TenantWorkerConfig
  ): Promise<{ success: boolean; scriptId?: string; error?: string }> {
    try {
      // Prepare metadata with bindings
      const metadata = {
        main_module: 'index.js',
        compatibility_date: '2024-12-18',
        compatibility_flags: ['nodejs_compat'],
        bindings: [
          // Tenant's D1 database
          {
            type: 'd1',
            name: 'DB',
            id: config.databaseId
          },
          // Central tenants database
          {
            type: 'd1',
            name: 'TENANTS_DB',
            id: 'b2b7e8a8-c297-4176-be12-106f9471090c'
          },
          // Tenant metadata KV
          {
            type: 'kv_namespace',
            name: 'TENANT_METADATA',
            namespace_id: 'a9644721cac748608d3b15bf2095436b'
          }
        ],
        vars: {
          TABLE_SESSION_SECRET: 'a58bb150303b86581cf51f1f26179ec26d5bbaeef863dd89e2e3f35cc86ef45c'
        }
      };

      // Create multipart form data for script upload
      const formData = new FormData();

      // Add the worker script
      const scriptBlob = new Blob([workerScript], { type: 'application/javascript+module' });
      formData.append('index.js', scriptBlob, 'index.js');

      // Add metadata
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      formData.append('metadata', metadataBlob, 'metadata.json');

      // Deploy to dispatch namespace
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/dispatch/namespaces/${this.dispatchNamespace}/scripts/${workerName}`;

      console.log(`[TenantWorker] Deploying to: ${url}`);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed (${response.status}): ${error}`);
      }

      const result = await response.json() as any;

      console.log(`[TenantWorker] API response:`, JSON.stringify(result, null, 2));

      return {
        success: result.success === true,
        scriptId: result.result?.id || workerName,
        error: result.errors?.[0]?.message
      };

    } catch (error: any) {
      console.error(`[TenantWorker] API deployment failed:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Initialize tenant database via deployed worker
   */
  async initializeTenantDatabase(
    workerName: string,
    schema: string,
    seeds?: string
  ): Promise<{ success: boolean; tablesCreated: number; rowsInserted: number; error?: string }> {
    try {
      console.log(`[TenantWorker] Initializing database for ${workerName}...`);

      // Call the tenant worker's initialize endpoint
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/dispatch/namespaces/${this.dispatchNamespace}/scripts/${workerName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: '/initialize',
            method: 'POST',
            body: JSON.stringify({ schema, seeds })
          })
        }
      );

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(`Initialize failed: ${error.errors?.[0]?.message || response.statusText}`);
      }

      const result = await response.json() as any;

      console.log(`[TenantWorker] ✅ Database initialized for ${workerName}`);

      return {
        success: result.success !== false,
        tablesCreated: result.tablesCreated || 0,
        rowsInserted: result.rowsInserted || 0,
        error: result.error
      };

    } catch (error: any) {
      console.error(`[TenantWorker] ❌ Initialize failed:`, error);
      return {
        success: false,
        tablesCreated: 0,
        rowsInserted: 0,
        error: error.message
      };
    }
  }

  /**
   * Delete a tenant worker
   */
  async deleteTenantWorker(workerName: string): Promise<boolean> {
    try {
      console.log(`[TenantWorker] Deleting ${workerName}...`);

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/dispatch/namespaces/${this.dispatchNamespace}/scripts/${workerName}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          }
        }
      );

      if (!response.ok && response.status !== 404) {
        const error = await response.json() as any;
        throw new Error(`Delete failed: ${error.errors?.[0]?.message || response.statusText}`);
      }

      console.log(`[TenantWorker] ✅ Deleted ${workerName}`);
      return true;

    } catch (error: any) {
      console.error(`[TenantWorker] ❌ Delete failed:`, error);
      return false;
    }
  }

}

