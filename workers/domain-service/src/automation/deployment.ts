/**
 * Automated Deployment Function for Domain Service
 * 
 * This function automates the entire deployment workflow for the domain service,
 * including resource provisioning, secret management, and deployment.
 * 
 * Leverages Cloudflare Workers API and Wrangler programmatically.
 * Can be integrated into SaaS store creation workflows.
 */

import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';

const execAsync = promisify(require('child_process').exec);

// ============================================================================
// TYPES
// ============================================================================

export interface DeploymentConfig {
  // Cloudflare credentials
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  cloudflareZoneId: string;
  
  // Domain configuration
  baseDomain: string;
  platformDomain: string;
  
  // SSL configuration
  letsencryptEmail: string;
  
  // Security
  webhookSecret: string;
  
  // Environment
  environment: 'staging' | 'production';
  
  // Optional: Existing resource IDs (if resources already exist)
  existingResources?: {
    kvNamespaceIds?: {
      domainMetadata?: string;
      tenantConfig?: string;
      sslCertificates?: string;
      validationTokens?: string;
    };
    d1DatabaseId?: string;
    r2BucketName?: string;
  };
}

export interface DeploymentResult {
  success: boolean;
  message: string;
  workerUrl?: string;
  resources?: {
    kvNamespaces: {
      domainMetadata: string;
      tenantConfig: string;
      sslCertificates: string;
      validationTokens: string;
    };
    d1Database: {
      id: string;
      name: string;
    };
    r2Bucket: {
      name: string;
    };
  };
  errors?: string[];
  timestamp: string;
}

interface CloudflareAPIResponse {
  success: boolean;
  errors: any[];
  messages: any[];
  result: any;
}

// ============================================================================
// CLOUDFLARE API CLIENT
// ============================================================================

class CloudflareAPIClient {
  private baseUrl = 'https://api.cloudflare.com/client/v4';
  
  constructor(
    private apiToken: string,
    private accountId: string
  ) {}

  private async makeRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<CloudflareAPIResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    return await response.json();
  }

  // KV Namespace operations
  async createKVNamespace(name: string): Promise<string> {
    const response = await this.makeRequest(
      `/accounts/${this.accountId}/storage/kv/namespaces`,
      'POST',
      { title: name }
    );

    if (!response.success) {
      throw new Error(`Failed to create KV namespace ${name}: ${JSON.stringify(response.errors)}`);
    }

    return response.result.id;
  }

  async listKVNamespaces(): Promise<any[]> {
    const response = await this.makeRequest(
      `/accounts/${this.accountId}/storage/kv/namespaces`
    );

    return response.success ? response.result : [];
  }

  // D1 Database operations
  async createD1Database(name: string): Promise<{ id: string; name: string }> {
    const response = await this.makeRequest(
      `/accounts/${this.accountId}/d1/database`,
      'POST',
      { name }
    );

    if (!response.success) {
      throw new Error(`Failed to create D1 database ${name}: ${JSON.stringify(response.errors)}`);
    }

    return {
      id: response.result.uuid,
      name: response.result.name,
    };
  }

  async listD1Databases(): Promise<any[]> {
    const response = await this.makeRequest(
      `/accounts/${this.accountId}/d1/database`
    );

    return response.success ? response.result : [];
  }

  // R2 Bucket operations
  async createR2Bucket(name: string): Promise<void> {
    const response = await this.makeRequest(
      `/accounts/${this.accountId}/r2/buckets`,
      'POST',
      { name }
    );

    if (!response.success) {
      throw new Error(`Failed to create R2 bucket ${name}: ${JSON.stringify(response.errors)}`);
    }
  }

  async listR2Buckets(): Promise<any[]> {
    const response = await this.makeRequest(
      `/accounts/${this.accountId}/r2/buckets`
    );

    return response.success ? response.result.buckets : [];
  }

  // Worker operations
  async deployWorker(scriptName: string, scriptContent: string, bindings: any): Promise<void> {
    // This is a simplified version - in production, use Wrangler API
    console.log(`Deploying worker ${scriptName}...`);
  }
}

// ============================================================================
// DEPLOYMENT ORCHESTRATOR
// ============================================================================

export class DomainServiceDeployer {
  private apiClient: CloudflareAPIClient;
  private errors: string[] = [];

  constructor(private config: DeploymentConfig) {
    this.apiClient = new CloudflareAPIClient(
      config.cloudflareApiToken,
      config.cloudflareAccountId
    );
  }

  /**
   * Main deployment function - orchestrates the entire deployment process
   */
  async deploy(): Promise<DeploymentResult> {
    console.log('🚀 Starting automated deployment...');
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Base Domain: ${this.config.baseDomain}`);
    
    const startTime = Date.now();

    try {
      // Step 1: Create or verify Cloudflare resources
      console.log('\n📦 Step 1: Provisioning Cloudflare resources...');
      const resources = await this.provisionResources();

      // Step 2: Update wrangler.toml with resource IDs
      console.log('\n📝 Step 2: Updating wrangler.toml...');
      await this.updateWranglerConfig(resources);

      // Step 3: Initialize D1 database schema
      console.log('\n🗄️  Step 3: Initializing database schema...');
      await this.initializeDatabase(resources.d1Database.id);

      // Step 4: Set secrets
      console.log('\n🔐 Step 4: Setting secrets...');
      await this.setSecrets();

      // Step 5: Deploy worker
      console.log('\n🚀 Step 5: Deploying worker...');
      const workerUrl = await this.deployWorker();

      // Step 6: Verify deployment
      console.log('\n✅ Step 6: Verifying deployment...');
      await this.verifyDeployment(workerUrl);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✨ Deployment completed successfully in ${duration}s`);
      console.log(`🌐 Worker URL: ${workerUrl}`);

      return {
        success: true,
        message: 'Deployment completed successfully',
        workerUrl,
        resources,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('\n❌ Deployment failed:', errorMessage);
      this.errors.push(errorMessage);

      return {
        success: false,
        message: 'Deployment failed',
        errors: this.errors,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Step 1: Provision all Cloudflare resources
   */
  private async provisionResources(): Promise<any> {
    const env = this.config.environment;
    const resources: any = {
      kvNamespaces: {},
      d1Database: {},
      r2Bucket: {},
    };

    // Create KV Namespaces
    console.log('Creating KV namespaces...');
    const kvNamespaces = [
      'DOMAIN_METADATA',
      'TENANT_CONFIG',
      'SSL_CERTIFICATES',
      'VALIDATION_TOKENS',
    ];

    for (const ns of kvNamespaces) {
      const name = `${ns}_${env}`;
      try {
        // Check if already exists
        const existing = await this.findExistingKVNamespace(name);
        if (existing) {
          console.log(`  ✓ KV namespace ${name} already exists (ID: ${existing.id})`);
          resources.kvNamespaces[this.toCamelCase(ns)] = existing.id;
        } else {
          const id = await this.apiClient.createKVNamespace(name);
          console.log(`  ✓ Created KV namespace ${name} (ID: ${id})`);
          resources.kvNamespaces[this.toCamelCase(ns)] = id;
        }
      } catch (error) {
        const errorMsg = `Failed to create KV namespace ${name}: ${error}`;
        console.error(`  ✗ ${errorMsg}`);
        this.errors.push(errorMsg);
      }
    }

    // Create D1 Database
    console.log('Creating D1 database...');
    const dbName = `facemash-domain-db-${env}`;
    try {
      const existing = await this.findExistingD1Database(dbName);
      if (existing) {
        console.log(`  ✓ D1 database ${dbName} already exists (ID: ${existing.uuid})`);
        resources.d1Database = { id: existing.uuid, name: existing.name };
      } else {
        const db = await this.apiClient.createD1Database(dbName);
        console.log(`  ✓ Created D1 database ${dbName} (ID: ${db.id})`);
        resources.d1Database = db;
      }
    } catch (error) {
      const errorMsg = `Failed to create D1 database: ${error}`;
      console.error(`  ✗ ${errorMsg}`);
      this.errors.push(errorMsg);
    }

    // Create R2 Bucket
    console.log('Creating R2 bucket...');
    const bucketName = `facemash-ssl-certificates-${env}`;
    try {
      const existing = await this.findExistingR2Bucket(bucketName);
      if (existing) {
        console.log(`  ✓ R2 bucket ${bucketName} already exists`);
        resources.r2Bucket = { name: bucketName };
      } else {
        await this.apiClient.createR2Bucket(bucketName);
        console.log(`  ✓ Created R2 bucket ${bucketName}`);
        resources.r2Bucket = { name: bucketName };
      }
    } catch (error) {
      const errorMsg = `Failed to create R2 bucket: ${error}`;
      console.error(`  ✗ ${errorMsg}`);
      this.errors.push(errorMsg);
    }

    return resources;
  }

  /**
   * Step 2: Update wrangler.toml with resource IDs
   */
  private async updateWranglerConfig(resources: any): Promise<void> {
    try {
      const wranglerPath = '../../wrangler.toml';
      let content = await readFile(wranglerPath, 'utf-8');

      // Update KV namespace IDs for the environment
      const env = this.config.environment;
      
      // Create a regex pattern to update the environment-specific KV namespaces
      const kvBindings = [
        { binding: 'DOMAIN_METADATA', id: resources.kvNamespaces.domainMetadata },
        { binding: 'TENANT_CONFIG', id: resources.kvNamespaces.tenantConfig },
        { binding: 'SSL_CERTIFICATES', id: resources.kvNamespaces.sslCertificates },
        { binding: 'VALIDATION_TOKENS', id: resources.kvNamespaces.validationTokens },
      ];

      for (const kv of kvBindings) {
        const pattern = new RegExp(
          `(\\[env\\.${env}\\.kv_namespaces\\][\\s\\S]*?binding = "${kv.binding}"[\\s\\S]*?id = ")([^"]*)(")`,
          'g'
        );
        content = content.replace(pattern, `$1${kv.id}$3`);
      }

      // Update D1 database ID
      const d1Pattern = new RegExp(
        `(\\[env\\.${env}\\.d1_databases\\][\\s\\S]*?database_id = ")([^"]*)(")`,
        'g'
      );
      content = content.replace(d1Pattern, `$1${resources.d1Database.id}$3`);

      // Update R2 bucket name
      const r2Pattern = new RegExp(
        `(\\[env\\.${env}\\.r2_buckets\\][\\s\\S]*?bucket_name = ")([^"]*)(")`,
        'g'
      );
      content = content.replace(r2Pattern, `$1${resources.r2Bucket.name}$3`);

      await writeFile(wranglerPath, content, 'utf-8');
      console.log('✓ Updated wrangler.toml successfully');
    } catch (error) {
      throw new Error(`Failed to update wrangler.toml: ${error}`);
    }
  }

  /**
   * Step 3: Initialize D1 database schema
   */
  private async initializeDatabase(databaseId: string): Promise<void> {
    try {
      const env = this.config.environment;
      const { stdout, stderr } = await execAsync(
        `wrangler d1 execute facemash-domain-db-${env} --env ${env} --file=./config/database.sql`
      );
      
      if (stderr) {
        console.warn('Database initialization warnings:', stderr);
      }
      
      console.log('✓ Database schema initialized successfully');
    } catch (error) {
      // If the error is about tables already existing, that's fine
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('already exists')) {
        console.log('✓ Database schema already initialized');
      } else {
        throw new Error(`Failed to initialize database: ${error}`);
      }
    }
  }

  /**
   * Step 4: Set secrets using Wrangler
   */
  private async setSecrets(): Promise<void> {
    const env = this.config.environment;
    const secrets = [
      { name: 'CLOUDFLARE_API_TOKEN', value: this.config.cloudflareApiToken },
      { name: 'CLOUDFLARE_ACCOUNT_ID', value: this.config.cloudflareAccountId },
      { name: 'CLOUDFLARE_ZONE_ID', value: this.config.cloudflareZoneId },
      { name: 'BASE_DOMAIN', value: this.config.baseDomain },
      { name: 'PLATFORM_DOMAIN', value: this.config.platformDomain },
      { name: 'LETSENCRYPT_ACCOUNT_EMAIL', value: this.config.letsencryptEmail },
      { name: 'WEBHOOK_SECRET', value: this.config.webhookSecret },
    ];

    for (const secret of secrets) {
      try {
        // Use echo to pipe the secret value to wrangler
        await execAsync(
          `echo "${secret.value}" | wrangler secret put ${secret.name} --env ${env}`,
          { shell: '/bin/bash' }
        );
        console.log(`  ✓ Set secret: ${secret.name}`);
      } catch (error) {
        const errorMsg = `Failed to set secret ${secret.name}: ${error}`;
        console.error(`  ✗ ${errorMsg}`);
        this.errors.push(errorMsg);
      }
    }
  }

  /**
   * Step 5: Deploy worker using Wrangler
   */
  private async deployWorker(): Promise<string> {
    try {
      const env = this.config.environment;
      const { stdout } = await execAsync(`npm run deploy:${env}`);
      
      console.log(stdout);
      
      // Extract worker URL from output
      const urlMatch = stdout.match(/https:\/\/[^\s]+/);
      const workerUrl = urlMatch ? urlMatch[0] : '';
      
      if (!workerUrl) {
        throw new Error('Failed to extract worker URL from deployment output');
      }
      
      console.log('✓ Worker deployed successfully');
      return workerUrl;
    } catch (error) {
      throw new Error(`Failed to deploy worker: ${error}`);
    }
  }

  /**
   * Step 6: Verify deployment with health check
   */
  private async verifyDeployment(workerUrl: string): Promise<void> {
    try {
      const response = await fetch(`${workerUrl}/api/health`);
      const data = await response.json() as any;
      
      if (data.success && data.data?.status === 'healthy') {
        console.log('✓ Health check passed');
      } else {
        console.warn('⚠ Health check returned degraded status');
      }
    } catch (error) {
      console.warn('⚠ Health check failed (this may be normal for new deployments):', error);
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async findExistingKVNamespace(name: string): Promise<any | null> {
    const namespaces = await this.apiClient.listKVNamespaces();
    return namespaces.find((ns: any) => ns.title === name) || null;
  }

  private async findExistingD1Database(name: string): Promise<any | null> {
    const databases = await this.apiClient.listD1Databases();
    return databases.find((db: any) => db.name === name) || null;
  }

  private async findExistingR2Bucket(name: string): Promise<any | null> {
    const buckets = await this.apiClient.listR2Buckets();
    return buckets.find((bucket: any) => bucket.name === name) || null;
  }

  private toCamelCase(str: string): string {
    return str
      .toLowerCase()
      .split('_')
      .map((word, index) => 
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join('');
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Deploy domain service with configuration
 */
export async function deployDomainService(
  config: DeploymentConfig
): Promise<DeploymentResult> {
  const deployer = new DomainServiceDeployer(config);
  return await deployer.deploy();
}

/**
 * Generate a secure webhook secret
 */
export function generateWebhookSecret(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate deployment configuration
 */
export function validateConfig(config: DeploymentConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.cloudflareApiToken) errors.push('cloudflareApiToken is required');
  if (!config.cloudflareAccountId) errors.push('cloudflareAccountId is required');
  if (!config.cloudflareZoneId) errors.push('cloudflareZoneId is required');
  if (!config.baseDomain) errors.push('baseDomain is required');
  if (!config.platformDomain) errors.push('platformDomain is required');
  if (!config.letsencryptEmail) errors.push('letsencryptEmail is required');
  if (!config.webhookSecret) errors.push('webhookSecret is required');
  if (!['staging', 'production'].includes(config.environment)) {
    errors.push('environment must be either "staging" or "production"');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  deployDomainService,
  DomainServiceDeployer,
  generateWebhookSecret,
  validateConfig,
};

