/**
 * Cloudflare Worker D1 Provisioning & Additional Sync Endpoints
 *
 * Implements POS-controlled D1 provisioning and additional sync endpoints
 * for menu, staff, settings, and floor plan data.
 *
 * Add these endpoints to the handsfree-orders worker.
 */

// ==================== TYPE DEFINITIONS ====================

interface Env {
  DB: D1Database;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  TENANT_METADATA: KVNamespace;
}

interface D1ProvisionRequest {
  databaseName: string;
  schema: string[];
}

interface MenuSyncRequest {
  items: Array<{
    id: string;
    category_id: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    active: boolean;
    preparation_time?: number;
  }>;
  categories: Array<{
    id: string;
    name: string;
    sort_order: number;
    active: boolean;
    icon?: string;
  }>;
}

interface StaffSyncRequest {
  records: Array<{
    id: string;
    tenant_id: string;
    name: string;
    pin?: string;
    role: string;
    email?: string;
    phone?: string;
    active: boolean;
    created_at: string;
  }>;
}

interface SettingsSyncRequest {
  settings: {
    tenant_id: string;
    restaurant_name: string;
    currency: string;
    timezone: string;
    tax_enabled: boolean;
    service_charge_enabled: boolean;
    // Add other settings fields as needed
  };
}

interface FloorPlanSyncRequest {
  sections: Array<{
    id: string;
    name: string;
    sort_order: number;
    active: boolean;
  }>;
  tables: Array<{
    id: string;
    section_id: string;
    table_number: number;
    capacity: number;
    status: string;
    x_position?: number;
    y_position?: number;
  }>;
}

// ==================== D1 PROVISIONING ENDPOINTS ====================

/**
 * POST /api/d1/provision/:tenantId
 * Provision D1 database with custom schema from POS
 */
async function handleD1Provisioning(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const { databaseName, schema } = await request.json() as D1ProvisionRequest;

    if (!databaseName || !schema || !Array.isArray(schema)) {
      return Response.json({
        success: false,
        error: 'Missing databaseName or schema array'
      }, { status: 400 });
    }

    console.log(`[D1 Provision] Provisioning D1 for tenant: ${tenantId}`);
    console.log(`[D1 Provision] Database name: ${databaseName}`);
    console.log(`[D1 Provision] Schema statements: ${schema.length}`);

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
      console.error('[D1 Provision] Failed to create database:', error);
      return Response.json({
        success: false,
        error: `Failed to create D1 database: ${error}`
      }, { status: 500 });
    }

    const createDbResult = await createDbResponse.json() as any;
    const databaseId = createDbResult.result.uuid;

    console.log(`[D1 Provision] Created database: ${databaseId}`);

    // Step 2: Apply schema statements
    let appliedStatements = 0;
    const errors: string[] = [];

    for (const statement of schema) {
      try {
        const execResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sql: statement,
            }),
          }
        );

        if (execResponse.ok) {
          appliedStatements++;
        } else {
          const error = await execResponse.text();
          errors.push(`Failed to apply statement: ${error}`);
          console.warn('[D1 Provision] Statement failed:', error);
        }
      } catch (error) {
        errors.push(`Error applying statement: ${error}`);
        console.error('[D1 Provision] Error:', error);
      }
    }

    // Step 3: Store database ID in KV metadata
    await env.TENANT_METADATA.put(
      `tenant:${tenantId}:d1`,
      JSON.stringify({
        database_id: databaseId,
        database_name: databaseName,
        provisioned_at: new Date().toISOString(),
        table_count: appliedStatements,
      })
    );

    console.log(`[D1 Provision] Success: ${appliedStatements}/${schema.length} statements applied`);

    return Response.json({
      success: true,
      databaseId,
      databaseName,
      tableCount: appliedStatements,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[D1 Provision] Fatal error:', error);
    return Response.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}

/**
 * GET /api/d1/status/:tenantId
 * Check D1 provisioning status for tenant
 */
async function handleD1Status(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}:d1`, 'json');

    if (!metadata) {
      return Response.json({
        provisioned: false,
      });
    }

    const metadataObj = metadata as any;

    return Response.json({
      provisioned: true,
      databaseId: metadataObj.database_id,
      databaseName: metadataObj.database_name,
      tableCount: metadataObj.table_count,
      provisionedAt: metadataObj.provisioned_at,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}

// ==================== MENU SYNC ENDPOINTS ====================

/**
 * POST /api/sync/:tenantId/menu
 * Sync menu items and categories to D1
 */
async function handleMenuSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const { items, categories } = await request.json() as MenuSyncRequest;

    if (!items || !categories) {
      return Response.json({
        success: false,
        error: 'Missing items or categories array'
      }, { status: 400 });
    }

    let synced = 0;
    const errors: string[] = [];

    // Sync categories first
    for (const category of categories) {
      try {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO menu_categories (
            id, tenant_id, name, sort_order, active, icon
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          category.id,
          tenantId,
          category.name,
          category.sort_order,
          category.active ? 1 : 0,
          category.icon || null
        ).run();

        synced++;
      } catch (err) {
        errors.push(`Failed to sync category ${category.name}: ${err}`);
      }
    }

    // Sync items
    for (const item of items) {
      try {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO menu_items (
            id, tenant_id, category_id, name, description, price,
            image, active, preparation_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          item.id,
          tenantId,
          item.category_id,
          item.name,
          item.description || null,
          item.price,
          item.image || null,
          item.active ? 1 : 0,
          item.preparation_time || 10
        ).run();

        synced++;
      } catch (err) {
        errors.push(`Failed to sync item ${item.name}: ${err}`);
      }
    }

    return Response.json({ success: true, synced, errors });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// ==================== STAFF SYNC ENDPOINTS ====================

/**
 * POST /api/sync/:tenantId/staff
 * Sync staff members to D1
 */
async function handleStaffSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const { records } = await request.json() as StaffSyncRequest;

    if (!records || !Array.isArray(records)) {
      return Response.json({
        success: false,
        error: 'Missing records array'
      }, { status: 400 });
    }

    let synced = 0;
    const errors: string[] = [];

    for (const staff of records) {
      try {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO staff_users (
            id, tenant_id, name, pin, role, email, phone, active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          staff.id,
          staff.tenant_id,
          staff.name,
          staff.pin || null,
          staff.role,
          staff.email || null,
          staff.phone || null,
          staff.active ? 1 : 0,
          staff.created_at
        ).run();

        synced++;
      } catch (err) {
        errors.push(`Failed to sync staff ${staff.name}: ${err}`);
      }
    }

    return Response.json({ success: true, synced, errors });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// ==================== SETTINGS SYNC ENDPOINTS ====================

/**
 * POST /api/sync/:tenantId/settings
 * Sync restaurant settings to D1
 */
async function handleSettingsSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const { settings } = await request.json() as SettingsSyncRequest;

    if (!settings) {
      return Response.json({
        success: false,
        error: 'Missing settings object'
      }, { status: 400 });
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO restaurant_settings (
        tenant_id, restaurant_name, currency, timezone,
        tax_enabled, service_charge_enabled
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      tenantId,
      settings.restaurant_name,
      settings.currency,
      settings.timezone,
      settings.tax_enabled ? 1 : 0,
      settings.service_charge_enabled ? 1 : 0
    ).run();

    return Response.json({ success: true, synced: 1, errors: [] });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// ==================== FLOOR PLAN SYNC ENDPOINTS ====================

/**
 * POST /api/sync/:tenantId/floor-plan
 * Sync floor plan sections and tables to D1
 */
async function handleFloorPlanSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const { sections, tables } = await request.json() as FloorPlanSyncRequest;

    if (!sections || !tables) {
      return Response.json({
        success: false,
        error: 'Missing sections or tables array'
      }, { status: 400 });
    }

    let synced = 0;
    const errors: string[] = [];

    // Sync sections
    for (const section of sections) {
      try {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO floor_plan_sections (
            id, tenant_id, name, sort_order, active
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
          section.id,
          tenantId,
          section.name,
          section.sort_order,
          section.active ? 1 : 0
        ).run();

        synced++;
      } catch (err) {
        errors.push(`Failed to sync section ${section.name}: ${err}`);
      }
    }

    // Sync tables
    for (const table of tables) {
      try {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO floor_plan_tables (
            id, tenant_id, section_id, table_number, capacity,
            status, x_position, y_position
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          table.id,
          tenantId,
          table.section_id,
          table.table_number,
          table.capacity,
          table.status,
          table.x_position || null,
          table.y_position || null
        ).run();

        synced++;
      } catch (err) {
        errors.push(`Failed to sync table ${table.table_number}: ${err}`);
      }
    }

    return Response.json({ success: true, synced, errors });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// ==================== ROUTER INTEGRATION ====================
/*
Add these routes to your worker's fetch handler:

// D1 Provisioning
if (path.match(/^\/api\/d1\/provision\/([^/]+)$/) && request.method === 'POST') {
  const tenantId = path.split('/')[4];
  return handleD1Provisioning(request, env, tenantId);
}

if (path.match(/^\/api\/d1\/status\/([^/]+)$/) && request.method === 'GET') {
  const tenantId = path.split('/')[4];
  return handleD1Status(request, env, tenantId);
}

// Menu Sync
if (path.match(/^\/api\/sync\/([^/]+)\/menu$/) && request.method === 'POST') {
  const tenantId = path.split('/')[3];
  return handleMenuSync(request, env, tenantId);
}

// Staff Sync
if (path.match(/^\/api\/sync\/([^/]+)\/staff$/) && request.method === 'POST') {
  const tenantId = path.split('/')[3];
  return handleStaffSync(request, env, tenantId);
}

// Settings Sync
if (path.match(/^\/api\/sync\/([^/]+)\/settings$/) && request.method === 'POST') {
  const tenantId = path.split('/')[3];
  return handleSettingsSync(request, env, tenantId);
}

// Floor Plan Sync
if (path.match(/^\/api\/sync\/([^/]+)\/floor-plan$/) && request.method === 'POST') {
  const tenantId = path.split('/')[3];
  return handleFloorPlanSync(request, env, tenantId);
}
*/

// ==================== ENVIRONMENT VARIABLES ====================
/*
Add these to your wrangler.toml:

[vars]
CLOUDFLARE_ACCOUNT_ID = "your-account-id"

[secrets]
CLOUDFLARE_API_TOKEN = "your-api-token-with-d1-permissions"

[[kv_namespaces]]
binding = "TENANT_METADATA"
id = "your-kv-namespace-id"
*/

export {
  handleD1Provisioning,
  handleD1Status,
  handleMenuSync,
  handleStaffSync,
  handleSettingsSync,
  handleFloorPlanSync,
};
