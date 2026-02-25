/**
 * Tenant Worker Deployment Service
 *
 * Deploys tenant-specific workers to the dispatch namespace
 * via Cloudflare Workers for Platforms API.
 */

export interface TenantWorkerDeploymentConfig {
  tenantId: string;
  subdomain: string;
  d1DatabaseId: string;
  d1DatabaseName: string;
}

export interface TenantWorkerDeploymentResult {
  success: boolean;
  workerName: string;
  versionId?: string;
  error?: string;
}

export class TenantWorkerDeployer {
  private apiToken: string;
  private dispatchToken: string;
  private accountId: string;
  private dispatchNamespaceName: string = 'handsfree-tenants';
  private schemaStorage?: R2Bucket;

  constructor(apiToken: string, accountId: string, schemaStorage?: R2Bucket, dispatchToken?: string) {
    this.apiToken = apiToken;
    this.dispatchToken = dispatchToken || apiToken;
    this.accountId = accountId;
    this.schemaStorage = schemaStorage;
  }

  /**
   * Deploy tenant worker to dispatch namespace
   */
  async deployTenantWorker(config: TenantWorkerDeploymentConfig): Promise<TenantWorkerDeploymentResult> {
    const workerName = `tenant-${config.subdomain}`;

    try {
      console.log(`[TenantWorkerDeployer] Deploying worker: ${workerName}`);

      // Fetch the tenant worker script from R2 or compile it
      // For now, we'll use a simple approach: fetch from a known URL
      const workerScript = await this.getWorkerScript();

      // Build the worker metadata (wrangler.json equivalent)
      const metadata = {
        main_module: 'worker.js',
        compatibility_date: '2024-12-18',
        compatibility_flags: ['nodejs_compat'],
        bindings: [
          {
            type: 'd1',
            name: 'DB',
            id: config.d1DatabaseId,
          },
        ],
      };

      // Create multipart form data
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

      let body = '';

      // Add metadata part
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="metadata"\r\n`;
      body += `Content-Type: application/json\r\n\r\n`;
      body += JSON.stringify(metadata) + '\r\n';

      // Add worker script part
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n`;
      body += `Content-Type: application/javascript+module\r\n\r\n`;
      body += workerScript + '\r\n';

      // End boundary
      body += `--${boundary}--\r\n`;

      // Deploy to dispatch namespace using Workers API
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/dispatch/namespaces/${this.dispatchNamespaceName}/scripts/${workerName}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.dispatchToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: body,
        }
      );

      const result = await response.json() as any;

      if (!response.ok) {
        throw new Error(`API error: ${result.errors?.[0]?.message || response.statusText}`);
      }

      console.log(`[TenantWorkerDeployer] ✅ Worker deployed: ${workerName}`);

      return {
        success: true,
        workerName,
        versionId: result.result?.id,
      };

    } catch (error: any) {
      console.error(`[TenantWorkerDeployer] ❌ Deployment failed for ${workerName}:`, error);

      return {
        success: false,
        workerName,
        error: error.message || 'Unknown deployment error',
      };
    }
  }

  /**
   * Get compiled worker script from R2
   *
   * The tenant worker script is pre-built and uploaded to R2 at:
   * workers/tenant-worker-bundle.js
   */
  private async getWorkerScript(): Promise<string> {
    if (!this.schemaStorage) {
      throw new Error('R2 SCHEMA_STORAGE binding not available - cannot fetch worker script');
    }

    console.log('[TenantWorkerDeployer] Fetching pre-built worker from R2...');

    const workerObject = await this.schemaStorage.get('workers/tenant-worker-bundle.js');

    if (!workerObject) {
      throw new Error(
        'Tenant worker bundle not found in R2 at workers/tenant-worker-bundle.js. ' +
        'Please run: cd workers/tenant-router && npm run build:tenant-worker'
      );
    }

    const workerScript = await workerObject.text();
    console.log(`[TenantWorkerDeployer] Loaded ${workerScript.length} bytes from R2`);

    return workerScript;
  }

  /**
   * Check if tenant worker exists in dispatch namespace
   */
  async checkWorkerExists(subdomain: string): Promise<boolean> {
    const workerName = `tenant-${subdomain}`;

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/dispatch/namespaces/${this.dispatchNamespaceName}/scripts/${workerName}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.dispatchToken}`,
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error(`[TenantWorkerDeployer] Error checking worker existence:`, error);
      return false;
    }
  }
}
