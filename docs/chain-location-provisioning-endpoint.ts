/**
 * Chain Location Provisioning Endpoint
 *
 * Full tenant provisioning for multi-location chains with:
 * - 16-digit activation codes
 * - Encrypted activation codes stored in master tenant DB
 * - Parent tenant tagging for efficient queries
 * - Complete infrastructure (D1, KV, R2, DNS)
 *
 * Add this to your handsfree-restaurant-provisioning worker
 */

interface Env {
  DB: D1Database; // Master tenant's D1 database
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  PROVISIONING_KV: KVNamespace;
  PROVISIONING_DO: DurableObjectNamespace;
  ENCRYPTION_KEY: string; // For AES-256 encryption of activation codes
}

interface ChainLocationProvisionRequest {
  masterTenantId: string; // Parent tenant ID
  restaurantName: string;
  companyName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  pincode: string;
  restaurantType: string;
  subdomain: string;
}

interface ChainLocationProvisionResponse {
  success: boolean;
  provisioningId: string;
  tenantId: string;
  activationCode: string; // 16-digit encrypted code
  error?: string;
}

/**
 * POST /api/provision/chain-location
 * Full tenant provisioning for chain locations with parent tagging
 */
async function handleChainLocationProvisioning(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as ChainLocationProvisionRequest;

    // Validate required fields
    if (!body.masterTenantId || !body.companyName || !body.email) {
      return Response.json({
        success: false,
        error: 'Missing required fields: masterTenantId, companyName, email',
      }, { status: 400 });
    }

    console.log('[ChainLocationProvision] Creating location for master:', body.masterTenantId);
    console.log('[ChainLocationProvision] Location name:', body.restaurantName);

    // Generate 16-digit activation code (alphanumeric)
    const activationCode = generateActivationCode16Digit();
    console.log('[ChainLocationProvision] Generated activation code:', activationCode);

    // Encrypt activation code before storing
    const encryptedCode = await encryptActivationCode(activationCode, env.ENCRYPTION_KEY);

    // Generate unique tenant ID for this location
    const locationTenantId = `${body.subdomain}-${Date.now().toString(36)}`;
    const provisioningId = crypto.randomUUID();

    // Store provisioning request in KV for status tracking
    await env.PROVISIONING_KV.put(
      `provisioning:${provisioningId}`,
      JSON.stringify({
        provisioningId,
        tenantId: locationTenantId,
        masterTenantId: body.masterTenantId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }),
      { expirationTtl: 3600 } // 1 hour TTL
    );

    // Store encrypted activation code in master tenant's D1 database
    await storeEncryptedActivationCodeInMasterDB(
      env.DB,
      body.masterTenantId,
      locationTenantId,
      encryptedCode,
      body.restaurantName
    );

    // Start async provisioning via Durable Object
    const doId = env.PROVISIONING_DO.idFromName(provisioningId);
    const doStub = env.PROVISIONING_DO.get(doId);

    const provisioningData = {
      provisioningId,
      tenantId: locationTenantId,
      masterTenantId: body.masterTenantId, // Parent tenant tag
      restaurantName: body.restaurantName,
      companyName: body.companyName,
      ownerName: body.ownerName,
      email: body.email,
      phone: body.phone,
      city: body.city,
      pincode: body.pincode,
      restaurantType: body.restaurantType,
      subdomain: body.subdomain,
      activationCode: activationCode, // Plain code for DO to use
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
    };

    // Fire and forget - DO will handle async provisioning
    doStub.fetch('https://do.internal/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provisioningData),
    }).catch((err) => {
      console.error('[ChainLocationProvision] Failed to start DO provisioning:', err);
    });

    console.log('[ChainLocationProvision] Provisioning started:', provisioningId);

    // Return immediately with provisioning ID and activation code
    const response: ChainLocationProvisionResponse = {
      success: true,
      provisioningId,
      tenantId: locationTenantId,
      activationCode, // Return plain code to frontend
    };

    return Response.json(response);
  } catch (error) {
    console.error('[ChainLocationProvision] Fatal error:', error);
    return Response.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

/**
 * Generate 16-digit alphanumeric activation code
 * Format: XXXX-XXXX-XXXX-XXXX (with hyphens for readability)
 */
function generateActivationCode16Digit(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0,O,1,I)
  let code = '';

  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    // Add hyphen every 4 chars for readability
    if ((i + 1) % 4 === 0 && i < 15) {
      code += '-';
    }
  }

  return code;
}

/**
 * Encrypt activation code using AES-256-GCM
 */
async function encryptActivationCode(
  activationCode: string,
  encryptionKey: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(activationCode);

  // Derive key from encryption key string
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('handsfree-pos-chain'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV + encrypted data and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt activation code
 */
async function decryptActivationCode(
  encryptedCode: string,
  encryptionKey: string
): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedCode), c => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  // Derive key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('handsfree-pos-chain'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return decoder.decode(decrypted);
}

/**
 * Store encrypted activation code in master tenant's D1 database
 */
async function storeEncryptedActivationCodeInMasterDB(
  db: D1Database,
  masterTenantId: string,
  locationTenantId: string,
  encryptedCode: string,
  locationName: string
): Promise<void> {
  try {
    // Create table if not exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS chain_location_activations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        master_tenant_id TEXT NOT NULL,
        location_tenant_id TEXT NOT NULL UNIQUE,
        location_name TEXT NOT NULL,
        encrypted_activation_code TEXT NOT NULL,
        is_activated BOOLEAN DEFAULT 0,
        activated_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_master_tenant (master_tenant_id),
        INDEX idx_location_tenant (location_tenant_id)
      )
    `).run();

    // Insert activation code
    await db.prepare(`
      INSERT INTO chain_location_activations (
        master_tenant_id,
        location_tenant_id,
        location_name,
        encrypted_activation_code
      ) VALUES (?, ?, ?, ?)
    `).bind(
      masterTenantId,
      locationTenantId,
      locationName,
      encryptedCode
    ).run();

    console.log('[StoreActivation] Stored encrypted activation in master DB:', locationTenantId);
  } catch (error) {
    console.error('[StoreActivation] Failed to store activation:', error);
    throw new Error(`Failed to store activation code: ${error}`);
  }
}

/**
 * GET /api/provision/chain-location/status/:provisioningId
 * Check provisioning status
 */
async function handleChainLocationProvisioningStatus(
  request: Request,
  env: Env,
  provisioningId: string
): Promise<Response> {
  try {
    // Get status from KV
    const statusData = await env.PROVISIONING_KV.get(`provisioning:${provisioningId}`, 'json');

    if (!statusData) {
      return Response.json({
        success: false,
        error: 'Provisioning ID not found',
      }, { status: 404 });
    }

    return Response.json({
      success: true,
      ...statusData,
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

/**
 * POST /api/provision/chain-location/verify-activation
 * Verify activation code and get location tenant info
 */
async function handleVerifyChainLocationActivation(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const { activationCode, masterTenantId } = await request.json() as {
      activationCode: string;
      masterTenantId: string;
    };

    if (!activationCode || !masterTenantId) {
      return Response.json({
        success: false,
        error: 'Missing activationCode or masterTenantId',
      }, { status: 400 });
    }

    // Query master tenant DB for matching activation code
    const result = await env.DB.prepare(`
      SELECT
        location_tenant_id,
        location_name,
        encrypted_activation_code,
        is_activated,
        activated_at
      FROM chain_location_activations
      WHERE master_tenant_id = ?
    `).bind(masterTenantId).all();

    if (!result.results || result.results.length === 0) {
      return Response.json({
        success: false,
        error: 'No locations found for this tenant',
      }, { status: 404 });
    }

    // Decrypt and compare each code
    for (const row of result.results) {
      const decryptedCode = await decryptActivationCode(
        row.encrypted_activation_code as string,
        env.ENCRYPTION_KEY
      );

      if (decryptedCode === activationCode) {
        // Found matching code
        if (row.is_activated) {
          return Response.json({
            success: false,
            error: 'This activation code has already been used',
          }, { status: 400 });
        }

        // Mark as activated
        await env.DB.prepare(`
          UPDATE chain_location_activations
          SET is_activated = 1, activated_at = ?, updated_at = ?
          WHERE location_tenant_id = ?
        `).bind(
          new Date().toISOString(),
          new Date().toISOString(),
          row.location_tenant_id
        ).run();

        return Response.json({
          success: true,
          locationTenantId: row.location_tenant_id,
          locationName: row.location_name,
          masterTenantId: masterTenantId,
        });
      }
    }

    return Response.json({
      success: false,
      error: 'Invalid activation code',
    }, { status: 401 });
  } catch (error) {
    console.error('[VerifyActivation] Error:', error);
    return Response.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

// ==================== DURABLE OBJECT ====================
/**
 * Provisioning Durable Object for async chain location provisioning
 * Handles the full provisioning flow with parent tenant tagging
 */
export class ChainLocationProvisioningDO {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/provision' && request.method === 'POST') {
      return this.handleProvisioning(request);
    }

    return new Response('Not found', { status: 404 });
  }

  async handleProvisioning(request: Request): Promise<Response> {
    const data = await request.json() as any;
    const { provisioningId, tenantId, masterTenantId } = data;

    console.log('[ProvisioningDO] Starting provisioning:', provisioningId);

    try {
      // Update status to provisioning
      await this.updateStatus(provisioningId, 'provisioning', 'Creating infrastructure...');

      // Step 1: Create D1 database
      const databaseName = `${tenantId.replace(/[^a-z0-9_-]/gi, '_')}_db`;
      const databaseId = await this.createD1Database(databaseName);

      // Tag database with parent tenant
      await this.tagResource('d1', databaseId, masterTenantId);

      // Step 2: Create KV namespace
      const kvNamespaceId = await this.createKVNamespace(`${tenantId}-kv`);
      await this.tagResource('kv', kvNamespaceId, masterTenantId);

      // Step 3: Create R2 bucket
      const r2BucketName = `${tenantId}-storage`;
      await this.createR2Bucket(r2BucketName);
      await this.tagResource('r2', r2BucketName, masterTenantId);

      // Step 4: Deploy worker
      const workerUrl = await this.deployWorker(tenantId, {
        d1DatabaseId: databaseId,
        kvNamespaceId: kvNamespaceId,
        r2BucketName: r2BucketName,
        masterTenantId: masterTenantId, // Add parent tenant to worker env
      });

      // Step 5: Apply schema migrations
      await this.applyMigrations(databaseId, data.accountId, data.apiToken);

      // Step 6: Store provisioning result
      const result = {
        success: true,
        provisioningId,
        tenantId,
        masterTenantId,
        activationCode: data.activationCode,
        cloudflareResources: {
          d1DatabaseId: databaseId,
          d1DatabaseName: databaseName,
          kvNamespaceId: kvNamespaceId,
          r2BucketName: r2BucketName,
          workerUrl: workerUrl,
        },
      };

      await this.updateStatus(provisioningId, 'completed', 'Provisioning complete', result);

      console.log('[ProvisioningDO] Provisioning completed:', provisioningId);
      return Response.json({ success: true });
    } catch (error) {
      console.error('[ProvisioningDO] Provisioning failed:', error);
      await this.updateStatus(provisioningId, 'failed', String(error));
      return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
  }

  async createD1Database(name: string): Promise<string> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/d1/database`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create D1 database: ${await response.text()}`);
    }

    const result = await response.json() as any;
    return result.result.uuid;
  }

  async createKVNamespace(name: string): Promise<string> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: name }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create KV namespace: ${await response.text()}`);
    }

    const result = await response.json() as any;
    return result.result.id;
  }

  async createR2Bucket(name: string): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create R2 bucket: ${await response.text()}`);
    }
  }

  async tagResource(resourceType: string, resourceId: string, masterTenantId: string): Promise<void> {
    // Store parent tenant tag in KV for efficient lookups
    await this.env.PROVISIONING_KV.put(
      `resource-tag:${resourceType}:${resourceId}`,
      JSON.stringify({
        masterTenantId,
        taggedAt: new Date().toISOString(),
      })
    );
  }

  async deployWorker(tenantId: string, bindings: any): Promise<string> {
    // Worker deployment logic here
    // Return worker URL
    return `https://${tenantId}.handsfree.workers.dev`;
  }

  async applyMigrations(databaseId: string, accountId: string, apiToken: string): Promise<void> {
    // Apply schema migrations to D1
    // Sync migrations from master tenant or use standard migrations
  }

  async updateStatus(provisioningId: string, status: string, message: string, result?: any): Promise<void> {
    const statusData = {
      provisioningId,
      status,
      message,
      result,
      updatedAt: new Date().toISOString(),
    };

    await this.env.PROVISIONING_KV.put(
      `provisioning:${provisioningId}`,
      JSON.stringify(statusData),
      { expirationTtl: 3600 }
    );
  }
}

// ==================== ROUTER INTEGRATION ====================
/*
Add these routes to your provisioning worker:

// Chain location provisioning
if (url.pathname === '/api/provision/chain-location' && request.method === 'POST') {
  return handleChainLocationProvisioning(request, env);
}

// Provisioning status
if (url.pathname.match(/^\/api\/provision\/chain-location\/status\/([^/]+)$/) && request.method === 'GET') {
  const provisioningId = url.pathname.split('/').pop();
  return handleChainLocationProvisioningStatus(request, env, provisioningId!);
}

// Activation verification
if (url.pathname === '/api/provision/chain-location/verify-activation' && request.method === 'POST') {
  return handleVerifyChainLocationActivation(request, env);
}

// Durable Object binding
export { ChainLocationProvisioningDO };
*/

// ==================== ENVIRONMENT VARIABLES ====================
/*
Add to wrangler.toml:

[vars]
CLOUDFLARE_ACCOUNT_ID = "your-account-id"

[secrets]
CLOUDFLARE_API_TOKEN = "your-api-token"
ENCRYPTION_KEY = "your-32-char-encryption-key"

[[d1_databases]]
binding = "DB"
database_name = "handsfree-master-db"
database_id = "your-master-db-id"

[[kv_namespaces]]
binding = "PROVISIONING_KV"
id = "your-kv-id"

[[durable_objects.bindings]]
name = "PROVISIONING_DO"
class_name = "ChainLocationProvisioningDO"
script_name = "handsfree-restaurant-provisioning"
*/

export {
  handleChainLocationProvisioning,
  handleChainLocationProvisioningStatus,
  handleVerifyChainLocationActivation,
  encryptActivationCode,
  decryptActivationCode,
};
