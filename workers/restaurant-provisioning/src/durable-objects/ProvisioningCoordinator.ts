/**
 * Durable Object for managing async restaurant provisioning
 * Handles WebSocket connections and background provisioning tasks
 */

import { DurableObject } from "cloudflare:workers";
import type { CloudflareEnv } from '../types';
import { TenantWorkerDeployer } from '../core/tenant-worker-deployer';
import { DatabaseProvisioner } from '../core/database-provisioner';

export interface ProvisioningStatus {
  tenantId: string;
  status: 'initializing' | 'in_progress' | 'complete' | 'failed';
  progress: {
    metadata: boolean;
    kvNamespaces: boolean;
    d1Database: boolean;
    d1Schema: boolean;
    r2Bucket: boolean;
    tenantWorker: boolean;
  };
  currentStep: string;
  progressPercent: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
  estimatedTimeRemaining?: number;
  resourceIds?: {
    d1DatabaseId?: string;
    r2BucketName?: string;
    tenantWorkerName?: string;
  };
}

export interface ProvisioningStartRequest {
  tenantId: string;
  request: any;
  kvNamespaces: {
    data: string;
    cache: string;
    sessions: string;
  };
  activationCode: string;
}

export class ProvisioningCoordinator extends DurableObject {
  private sessions: Set<WebSocket> = new Set();
  private currentStatus: ProvisioningStatus | null = null;
  private env: CloudflareEnv;

  constructor(state: DurableObjectState, env: CloudflareEnv) {
    super(state, env);
    this.env = env;

    // Load existing status from storage
    state.blockConcurrencyWhile(async () => {
      const stored = await state.storage.get<ProvisioningStatus>('status');
      if (stored) {
        this.currentStatus = stored;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    // HTTP endpoints
    if (url.pathname === '/start' && request.method === 'POST') {
      return this.handleStartProvisioning(request);
    }

    if (url.pathname === '/status' && request.method === 'GET') {
      return this.handleGetStatus();
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    this.sessions.add(server);

    // Send current status immediately on connect
    if (this.currentStatus) {
      server.send(JSON.stringify({
        type: 'status',
        data: this.currentStatus
      }));
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    console.log('[ProvisioningCoordinator] Received message:', message);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.sessions.delete(ws);
    console.log('[ProvisioningCoordinator] WebSocket closed:', { code, reason, wasClean });
  }

  private async handleStartProvisioning(request: Request): Promise<Response> {
    try {
      const data: ProvisioningStartRequest = await request.json();
      const { tenantId, request: provisioningRequest, kvNamespaces, activationCode } = data;

      // Initialize status
      const initialStatus: ProvisioningStatus = {
        tenantId,
        status: 'in_progress',
        progress: {
          metadata: true,
          kvNamespaces: true,
          d1Database: false,
          d1Schema: false,
          r2Bucket: false,
          tenantWorker: false,
        },
        currentStep: 'Initializing background provisioning',
        progressPercent: 40,
        startedAt: new Date().toISOString(),
      };

      await this.updateStatus(initialStatus);

      // Start background provisioning
      this.ctx.waitUntil(this.runProvisioning(tenantId, provisioningRequest, kvNamespaces, activationCode));

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('[ProvisioningCoordinator] Error starting provisioning:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetStatus(): Promise<Response> {
    if (!this.currentStatus) {
      return new Response(JSON.stringify({ error: 'No provisioning in progress' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(this.currentStatus), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async runProvisioning(
    tenantId: string,
    provisioningRequest: any,
    kvNamespaces: any,
    activationCode: string
  ): Promise<void> {
    try {
      // STEP 1: Create D1 database
      await this.updateStatus({
        ...this.currentStatus!,
        currentStep: 'Creating D1 database',
        progressPercent: 50,
      });

      const database = await this.createD1Database(tenantId);

      await this.updateStatus({
        ...this.currentStatus!,
        progress: {
          ...this.currentStatus!.progress,
          d1Database: true,
        },
        currentStep: 'D1 database created',
        progressPercent: 60,
        resourceIds: {
          ...this.currentStatus!.resourceIds,
          d1DatabaseId: database.id,
        }
      });

      // STEP 2: Apply schema via DatabaseProvisioner (handles triggers, quotes, one-at-a-time)
      await this.applyDatabaseSchema(database.id, tenantId);

      // Seed initial restaurant_settings row with company info so any device that
      // activates this tenant sees the correct name immediately (even before any sync).
      await this.seedInitialRestaurantSettings(database.id, provisioningRequest);

      // STEP 3: Create R2 bucket
      await this.updateStatus({
        ...this.currentStatus!,
        currentStep: 'Creating file storage (R2 bucket)',
        progressPercent: 85,
      });

      const r2Bucket = await this.createR2Bucket(tenantId);

      await this.updateStatus({
        ...this.currentStatus!,
        progress: {
          ...this.currentStatus!.progress,
          r2Bucket: true,
        },
        currentStep: 'File storage created',
        progressPercent: 90,
        resourceIds: {
          ...this.currentStatus!.resourceIds,
          r2BucketName: r2Bucket.name,
        }
      });

      // STEP 4: Deploy tenant worker to dispatch namespace (non-fatal)
      await this.updateStatus({
        ...this.currentStatus!,
        currentStep: 'Deploying tenant worker',
        progressPercent: 92,
      });

      try {
        const tenantWorkerResult = await this.deployTenantWorker(
          tenantId,
          provisioningRequest.subdomain,
          database.id,
          database.name
        );

        await this.updateStatus({
          ...this.currentStatus!,
          progress: {
            ...this.currentStatus!.progress,
            tenantWorker: true,
          },
          currentStep: 'Tenant worker deployed',
          progressPercent: 95,
          resourceIds: {
            ...this.currentStatus!.resourceIds,
            tenantWorkerName: tenantWorkerResult.workerName,
          }
        });
      } catch (workerError: any) {
        // Worker deployment failure is non-fatal: D1, R2, KV, and activation code are ready.
        // The dispatch worker can be deployed separately via wrangler.
        console.error(`[ProvisioningCoordinator] Worker deployment failed (non-fatal): ${workerError.message}`);
        await this.updateStatus({
          ...this.currentStatus!,
          currentStep: 'Worker deployment skipped (requires manual deploy)',
          progressPercent: 95,
        });
      }

      // STEP 5: Store final metadata
      await this.updateStatus({
        ...this.currentStatus!,
        currentStep: 'Finalizing tenant metadata',
        progressPercent: 98,
      });

      await this.storeTenantMetadata(tenantId, database, r2Bucket, kvNamespaces, activationCode, provisioningRequest);

      // STEP 5: Complete
      await this.updateStatus({
        ...this.currentStatus!,
        status: 'complete',
        currentStep: 'Provisioning complete',
        progressPercent: 100,
        completedAt: new Date().toISOString(),
      });

      this.broadcast({
        type: 'complete',
        data: this.currentStatus!
      });

      // Schedule cleanup after 1 hour
      await this.ctx.storage.setAlarm(Date.now() + 3600000);

    } catch (error: any) {
      console.error('[ProvisioningCoordinator] Provisioning failed:', error);

      await this.updateStatus({
        ...this.currentStatus!,
        status: 'failed',
        error: error.message,
        currentStep: `Failed: ${error.message}`,
      });

      this.broadcast({
        type: 'error',
        data: { error: error.message }
      });
    }
  }

  private async createD1Database(tenantId: string): Promise<{ id: string; name: string }> {
    const databaseName = `${tenantId}_db`;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/d1/database`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: databaseName }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create D1 database: ${error}`);
    }

    const result = await response.json();
    return {
      id: result.result.uuid,
      name: databaseName,
    };
  }

  private async applyDatabaseSchema(databaseId: string, tenantId: string): Promise<void> {
    const dbProvisioner = new DatabaseProvisioner(
      this.env.CLOUDFLARE_API_TOKEN,
      this.env.CLOUDFLARE_ACCOUNT_ID,
      this.env.SCHEMA_STORAGE
    );

    const result = await dbProvisioner.provisionDatabase({
      databaseId,
      tenantId,
      subdomain: tenantId,
      includeSeeds: true,
      schemaVersion: 'latest',
    });

    if (!result.success) {
      throw new Error(`Schema application failed: ${result.error}`);
    }

    await this.updateStatus({
      ...this.currentStatus!,
      progress: {
        ...this.currentStatus!.progress,
        d1Schema: true,
      },
      currentStep: `Database schema applied (${result.tablesCreated} tables)`,
      progressPercent: 85,
    });
  }

  private async seedInitialRestaurantSettings(databaseId: string, provisioningRequest: any): Promise<void> {
    const name = (provisioningRequest.companyName || provisioningRequest.restaurantName || 'Restaurant').replace(/'/g, "''");
    const email = (provisioningRequest.email || '').replace(/'/g, "''");
    const phone = (provisioningRequest.phone || '').replace(/'/g, "''");
    const sql = `INSERT OR IGNORE INTO restaurant_settings (id, name, email, phone) VALUES (1, '${name}', '${email}', '${phone}')`;

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql }),
        }
      );
      if (response.ok) {
        console.log('[ProvisioningCoordinator] ✅ Seeded initial restaurant_settings');
      } else {
        console.warn('[ProvisioningCoordinator] ⚠️  Could not seed restaurant_settings:', await response.text());
      }
    } catch (e: any) {
      console.warn('[ProvisioningCoordinator] ⚠️  seedInitialRestaurantSettings failed (non-fatal):', e.message);
    }
  }

  private async createR2Bucket(tenantId: string): Promise<{ name: string }> {
    const bucketName = `${tenantId}-files`;
    const storageToken = this.env.CLOUDFLARE_STORAGE_TOKEN || this.env.CLOUDFLARE_API_TOKEN;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${storageToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: bucketName }),
      }
    );

    if (!response.ok) {
      const error = await response.text();

      // Check if bucket already exists (idempotency)
      if (error.includes('already exists')) {
        console.log(`[ProvisioningCoordinator] R2 bucket ${bucketName} already exists`);
        return { name: bucketName };
      }

      throw new Error(`Failed to create R2 bucket: ${error}`);
    }

    return { name: bucketName };
  }

  private async deployTenantWorker(
    tenantId: string,
    subdomain: string,
    d1DatabaseId: string,
    d1DatabaseName: string
  ): Promise<{ workerName: string; success: boolean }> {
    console.log(`[ProvisioningCoordinator] Deploying tenant worker for ${tenantId}...`);

    const deployer = new TenantWorkerDeployer(
      this.env.CLOUDFLARE_API_TOKEN,
      this.env.CLOUDFLARE_ACCOUNT_ID,
      this.env.SCHEMA_STORAGE,
      this.env.CLOUDFLARE_DISPATCH_TOKEN
    );

    const result = await deployer.deployTenantWorker({
      tenantId,
      subdomain,
      d1DatabaseId,
      d1DatabaseName,
    });

    if (!result.success) {
      console.error(`[ProvisioningCoordinator] Tenant worker deployment failed: ${result.error}`);
      throw new Error(`Tenant worker deployment failed: ${result.error}`);
    }

    console.log(`[ProvisioningCoordinator] ✅ Tenant worker deployed: ${result.workerName}`);

    return {
      workerName: result.workerName,
      success: true,
    };
  }

  private async storeTenantMetadata(
    tenantId: string,
    database: { id: string; name: string },
    r2Bucket: { name: string },
    kvNamespaces: any,
    activationCode: string,
    provisioningRequest: any
  ): Promise<void> {
    const tenantMetadata = {
      tenantId,
      subdomain: tenantId,
      fullDomain: `${tenantId}.${this.env.BASE_DOMAIN}`,
      storeUrl: `https://${tenantId}.${this.env.BASE_DOMAIN}`,
      activationCode,
      databaseId: database.id,
      databaseName: database.name,
      kvNamespaceData: kvNamespaces.data,
      kvNamespaceCache: kvNamespaces.cache,
      kvNamespaceSessions: kvNamespaces.sessions,
      r2BucketName: r2Bucket.name,
      companyName: provisioningRequest.companyName,
      locationName: provisioningRequest.locationName,
      ownerName: provisioningRequest.ownerName,
      email: provisioningRequest.email,
      phone: provisioningRequest.phone,
      city: provisioningRequest.city,
      pincode: provisioningRequest.pincode,
      businessCategory: provisioningRequest.businessCategory,
      restaurantType: provisioningRequest.restaurantType,
      masterTenantId: provisioningRequest.masterTenantId || null,
      provisioningStatus: 'complete',
      createdAt: this.currentStatus!.startedAt,
      completedAt: new Date().toISOString(),
    };

    await this.env.TENANT_METADATA.put(
      `tenant:${tenantId}`,
      JSON.stringify(tenantMetadata)
    );

    // Insert into TENANTS_DB
    if (this.env.TENANTS_DB) {
      try {
        const isChainLocation = provisioningRequest.masterTenantId ? 1 : 0;
        await this.env.TENANTS_DB.prepare(
          `INSERT INTO restaurant_tenants (
            tenant_id, subdomain, full_domain, store_url, d1_database_id, d1_database_name,
            company_name, email, phone,
            city, pincode, business_category,
            chain_id, is_chain_location,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          tenantId,
          tenantId,
          `${tenantId}.${this.env.BASE_DOMAIN}`,
          `https://${tenantId}.${this.env.BASE_DOMAIN}`,
          database.id,
          database.name,
          provisioningRequest.companyName,
          provisioningRequest.email,
          provisioningRequest.phone || null,
          provisioningRequest.city || null,
          provisioningRequest.pincode || null,
          provisioningRequest.businessCategory || null,
          provisioningRequest.masterTenantId || null,
          isChainLocation,
          'active',
          this.currentStatus!.startedAt,
          new Date().toISOString()
        ).run();
      } catch (error) {
        console.error('[ProvisioningCoordinator] Failed to insert into TENANTS_DB:', error);
      }
    }
  }

  private async updateStatus(status: ProvisioningStatus): Promise<void> {
    this.currentStatus = status;
    await this.ctx.storage.put('status', status);

    this.broadcast({
      type: 'progress',
      data: status
    });
  }

  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);

    this.sessions.forEach(ws => {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error('[ProvisioningCoordinator] Failed to send to WebSocket:', error);
        this.sessions.delete(ws);
      }
    });
  }

  async alarm() {
    console.log('[ProvisioningCoordinator] Alarm triggered - cleaning up old data');

    if (this.currentStatus?.status === 'complete' || this.currentStatus?.status === 'failed') {
      await this.ctx.storage.deleteAll();
      this.currentStatus = null;
    }
  }
}
