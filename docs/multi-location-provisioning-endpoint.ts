/**
 * Multi-Location Provisioning Endpoint
 *
 * This is a lightweight provisioning endpoint specifically for multi-location chains.
 * It only creates a D1 database and links it to the master tenant - no KV, R2, or DNS.
 *
 * Add this to your handsfree-restaurant-provisioning worker
 */

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  PROVISIONING_KV: KVNamespace;
}

interface LocationProvisionRequest {
  tenantId: string; // Master tenant ID for chain linking
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

interface LocationProvisionResponse {
  success: boolean;
  tenantId: string;
  activationCode: string;
  cloudflareResources: {
    d1DatabaseId: string;
    d1DatabaseName: string;
  };
  error?: string;
}

/**
 * POST /api/provision/location
 * Lightweight provisioning for multi-location chains
 * Only creates D1 database, no KV/R2/DNS
 */
async function handleLocationProvisioning(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as LocationProvisionRequest;

    // Validate required fields
    if (!body.tenantId || !body.companyName || !body.email) {
      return Response.json({
        success: false,
        error: 'Missing required fields: tenantId, companyName, email',
      }, { status: 400 });
    }

    console.log('[LocationProvision] Creating location for chain:', body.tenantId);
    console.log('[LocationProvision] Location name:', body.restaurantName);

    // Generate unique tenant ID for this location
    const locationTenantId = `${body.subdomain}-${Date.now().toString(36)}`;

    // Generate activation code
    const activationCode = generateActivationCode();

    // Create D1 database name
    const databaseName = `${locationTenantId.replace(/[^a-z0-9_-]/gi, '_')}_db`;

    console.log('[LocationProvision] Creating D1 database:', databaseName);

    // Step 1: Create D1 database via Cloudflare API
    const createDbResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: databaseName }),
      }
    );

    if (!createDbResponse.ok) {
      const error = await createDbResponse.text();
      console.error('[LocationProvision] Failed to create D1:', error);
      return Response.json({
        success: false,
        error: `Failed to create D1 database: ${error}`,
      }, { status: 500 });
    }

    const createDbResult = await createDbResponse.json() as any;
    const databaseId = createDbResult.result.uuid;

    console.log('[LocationProvision] D1 database created:', databaseId);

    // Step 2: Apply base schema (will be synced from master via migration sync)
    // Apply minimal schema - just the tenant_config table
    // The rest will come from migration sync
    const minimalSchema = `
      CREATE TABLE IF NOT EXISTS tenant_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL UNIQUE,
        d1_database_id TEXT,
        activation_code TEXT,
        master_tenant_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO tenant_config (tenant_id, d1_database_id, activation_code, master_tenant_id)
      VALUES ('${locationTenantId}', '${databaseId}', '${activationCode}', '${body.tenantId}');
    `;

    const execResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: minimalSchema }),
      }
    );

    if (!execResponse.ok) {
      const error = await execResponse.text();
      console.warn('[LocationProvision] Failed to apply schema:', error);
      // Don't fail - schema can be applied via migration sync
    }

    // Step 3: Store metadata in KV
    const metadata = {
      tenantId: locationTenantId,
      masterTenantId: body.tenantId,
      restaurantName: body.restaurantName,
      companyName: body.companyName,
      ownerName: body.ownerName,
      email: body.email,
      phone: body.phone,
      city: body.city,
      pincode: body.pincode,
      restaurantType: body.restaurantType,
      subdomain: body.subdomain,
      activationCode: activationCode,
      d1DatabaseId: databaseId,
      d1DatabaseName: databaseName,
      provisionedAt: new Date().toISOString(),
      provisioningType: 'multi-location',
    };

    await env.PROVISIONING_KV.put(
      `tenant:${locationTenantId}`,
      JSON.stringify(metadata)
    );

    await env.PROVISIONING_KV.put(
      `activation:${activationCode}`,
      JSON.stringify({
        tenantId: locationTenantId,
        masterTenantId: body.tenantId,
        createdAt: new Date().toISOString(),
      })
    );

    console.log('[LocationProvision] Location provisioned successfully:', locationTenantId);

    // Return immediately - no async processing needed for D1-only
    const response: LocationProvisionResponse = {
      success: true,
      tenantId: locationTenantId,
      activationCode: activationCode,
      cloudflareResources: {
        d1DatabaseId: databaseId,
        d1DatabaseName: databaseName,
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error('[LocationProvision] Fatal error:', error);
    return Response.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

/**
 * Generate activation code (6 uppercase alphanumeric characters)
 */
function generateActivationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/provision/location/migrate
 * Apply migration sync to a location's D1 database
 * This syncs the schema from master tenant
 */
async function handleLocationMigration(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const { locationTenantId, masterTenantId, migrations } = await request.json() as {
      locationTenantId: string;
      masterTenantId: string;
      migrations: string[];
    };

    // Get location metadata
    const metadataStr = await env.PROVISIONING_KV.get(`tenant:${locationTenantId}`);
    if (!metadataStr) {
      return Response.json({
        success: false,
        error: 'Location not found',
      }, { status: 404 });
    }

    const metadata = JSON.parse(metadataStr);
    const databaseId = metadata.d1DatabaseId;

    console.log('[LocationMigration] Applying migrations to:', locationTenantId);
    console.log('[LocationMigration] Database ID:', databaseId);
    console.log('[LocationMigration] Migrations count:', migrations.length);

    let appliedCount = 0;
    const errors: string[] = [];

    // Apply each migration
    for (const migration of migrations) {
      try {
        const execResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql: migration }),
          }
        );

        if (execResponse.ok) {
          appliedCount++;
        } else {
          const error = await execResponse.text();
          errors.push(`Migration failed: ${error}`);
          console.warn('[LocationMigration] Failed:', error);
        }
      } catch (error) {
        errors.push(`Error applying migration: ${error}`);
      }
    }

    console.log(`[LocationMigration] Applied ${appliedCount}/${migrations.length} migrations`);

    return Response.json({
      success: true,
      appliedCount,
      totalMigrations: migrations.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[LocationMigration] Fatal error:', error);
    return Response.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

// ==================== ROUTER INTEGRATION ====================
/*
Add these routes to your provisioning worker's fetch handler:

// Multi-location provisioning
if (url.pathname === '/api/provision/location' && request.method === 'POST') {
  return handleLocationProvisioning(request, env);
}

// Multi-location migration sync
if (url.pathname === '/api/provision/location/migrate' && request.method === 'POST') {
  return handleLocationMigration(request, env);
}
*/

export {
  handleLocationProvisioning,
  handleLocationMigration,
};
