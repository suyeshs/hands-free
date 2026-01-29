/**
 * Cloudflare Worker - Unified D1 Provisioning & Sync API
 *
 * Single endpoint structure for POS-controlled D1 provisioning and data sync.
 * Replaces multiple individual sync endpoints with a unified API.
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

interface SyncRequest {
  dataType: 'sales' | 'tips' | 'menu' | 'staff' | 'settings' | 'floor-plan' | 'inventory';
  records: any[];
}

// ==================== D1 PROVISIONING ====================

/**
 * POST /api/provision/:tenantId
 * Provision D1 database with custom schema from POS
 */
async function handleProvision(
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

    console.log(`[Provision] Starting for tenant: ${tenantId}`);
    console.log(`[Provision] Database: ${databaseName}, Schema statements: ${schema.length}`);

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
      console.error('[Provision] Database creation failed:', error);
      return Response.json({
        success: false,
        error: `Failed to create D1 database: ${error}`
      }, { status: 500 });
    }

    const createDbResult = await createDbResponse.json() as any;
    const databaseId = createDbResult.result.uuid;

    console.log(`[Provision] Database created: ${databaseId}`);

    // Step 2: Apply schema statements one by one
    let appliedStatements = 0;
    const errors: string[] = [];

    for (let i = 0; i < schema.length; i++) {
      const statement = schema[i];
      try {
        const execResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql: statement }),
          }
        );

        if (execResponse.ok) {
          appliedStatements++;
          console.log(`[Provision] Applied statement ${i + 1}/${schema.length}`);
        } else {
          const errorText = await execResponse.text();
          errors.push(`Statement ${i + 1} failed: ${errorText}`);
          console.warn(`[Provision] Statement ${i + 1} failed:`, errorText);
        }
      } catch (error) {
        errors.push(`Statement ${i + 1} error: ${error}`);
        console.error(`[Provision] Statement ${i + 1} error:`, error);
      }
    }

    // Step 3: Store metadata in KV
    await env.TENANT_METADATA.put(
      `tenant:${tenantId}:d1`,
      JSON.stringify({
        database_id: databaseId,
        database_name: databaseName,
        provisioned_at: new Date().toISOString(),
        table_count: appliedStatements,
      })
    );

    console.log(`[Provision] Complete: ${appliedStatements}/${schema.length} statements applied`);

    return Response.json({
      success: true,
      databaseId,
      databaseName,
      tableCount: appliedStatements,
      totalStatements: schema.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Provision] Fatal error:', error);
    return Response.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}

/**
 * GET /api/provision/:tenantId/status
 * Check D1 provisioning status
 */
async function handleProvisionStatus(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}:d1`, 'json');

    if (!metadata) {
      return Response.json({ provisioned: false });
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

// ==================== UNIFIED SYNC ENDPOINT ====================

/**
 * POST /api/sync/:tenantId
 * Universal sync endpoint for all data types
 */
async function handleSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const { dataType, records } = await request.json() as SyncRequest;

    if (!dataType || !records) {
      return Response.json({
        success: false,
        error: 'Missing dataType or records'
      }, { status: 400 });
    }

    console.log(`[Sync] ${dataType} for tenant ${tenantId}: ${records.length} records`);

    // Route to appropriate sync handler
    switch (dataType) {
      case 'sales':
        return await syncSales(env, tenantId, records);
      case 'tips':
        return await syncTips(env, tenantId, records);
      case 'menu':
        return await syncMenu(env, tenantId, records);
      case 'staff':
        return await syncStaff(env, tenantId, records);
      case 'settings':
        return await syncSettings(env, tenantId, records);
      case 'floor-plan':
        return await syncFloorPlan(env, tenantId, records);
      case 'inventory':
        return await syncInventory(env, tenantId, records);
      default:
        return Response.json({
          success: false,
          error: `Unknown dataType: ${dataType}`
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[Sync] Error:', error);
    return Response.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}

// ==================== SYNC HANDLERS ====================

async function syncSales(env: Env, tenantId: string, transactions: any[]): Promise<Response> {
  let synced = 0;
  const errors: string[] = [];

  for (const tx of transactions) {
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO sales_transactions (
          id, tenant_id, invoice_number, order_number, order_type, table_number,
          source, subtotal, service_charge, cgst, sgst, discount, round_off,
          grand_total, payment_method, payment_status, items_json,
          cashier_name, staff_id, created_at, completed_at, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        tx.id,
        tenantId,
        tx.invoice_number || tx.invoiceNumber,
        tx.order_number || tx.orderNumber || null,
        tx.order_type || tx.orderType,
        tx.table_number || tx.tableNumber || null,
        tx.source || 'pos',
        tx.subtotal,
        tx.service_charge || tx.serviceCharge || 0,
        tx.cgst || 0,
        tx.sgst || 0,
        tx.discount || 0,
        tx.round_off || tx.roundOff || 0,
        tx.grand_total || tx.grandTotal,
        tx.payment_method || tx.paymentMethod,
        tx.payment_status || tx.paymentStatus || 'completed',
        JSON.stringify(tx.items),
        tx.cashier_name || tx.cashierName || null,
        tx.staff_id || tx.staffId || null,
        tx.created_at || tx.createdAt,
        tx.completed_at || tx.completedAt
      ).run();

      synced++;
    } catch (err) {
      errors.push(`Failed to sync ${tx.invoice_number || tx.invoiceNumber}: ${err}`);
    }
  }

  return Response.json({ success: true, synced, errors });
}

async function syncTips(env: Env, tenantId: string, tips: any[]): Promise<Response> {
  let synced = 0;
  const errors: string[] = [];

  for (const tip of tips) {
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO tips (
          id, tenant_id, invoice_number, order_number, table_number, order_type,
          tip_amount, staff_id, server_name, entered_by_staff_id, entered_by_name,
          entry_method, created_at, tip_date, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        tip.id,
        tenantId,
        tip.invoice_number || tip.invoiceNumber,
        tip.order_number || tip.orderNumber || null,
        tip.table_number || tip.tableNumber || null,
        tip.order_type || tip.orderType,
        tip.tip_amount || tip.tipAmount,
        tip.staff_id || tip.staffId || null,
        tip.server_name || tip.serverName || null,
        tip.entered_by_staff_id || tip.enteredByStaffId || null,
        tip.entered_by_name || tip.enteredByName || null,
        tip.entry_method || tip.entryMethod || 'manual',
        tip.created_at || tip.createdAt,
        tip.tip_date || tip.tipDate
      ).run();

      synced++;
    } catch (err) {
      errors.push(`Failed to sync tip ${tip.id}: ${err}`);
    }
  }

  return Response.json({ success: true, synced, errors });
}

async function syncMenu(env: Env, tenantId: string, menuData: any[]): Promise<Response> {
  // menuData[0] should contain { items: [], categories: [] }
  const data = menuData[0] || {};
  const items = data.items || [];
  const categories = data.categories || [];

  let synced = 0;
  const errors: string[] = [];

  // Sync categories
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
        category.sort_order || category.sortOrder || 0,
        category.active ? 1 : 0,
        category.icon || null
      ).run();

      synced++;
    } catch (err) {
      errors.push(`Category ${category.name}: ${err}`);
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
        item.category_id || item.categoryId,
        item.name,
        item.description || null,
        item.price,
        item.image || null,
        item.active ? 1 : 0,
        item.preparation_time || item.preparationTime || 10
      ).run();

      synced++;
    } catch (err) {
      errors.push(`Item ${item.name}: ${err}`);
    }
  }

  return Response.json({ success: true, synced, errors });
}

async function syncStaff(env: Env, tenantId: string, staff: any[]): Promise<Response> {
  let synced = 0;
  const errors: string[] = [];

  for (const member of staff) {
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO staff_users (
          id, tenant_id, name, pin, role, email, phone, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        member.id,
        tenantId,
        member.name,
        member.pin || null,
        member.role,
        member.email || null,
        member.phone || null,
        member.active ? 1 : 0,
        member.created_at || member.createdAt || new Date().toISOString()
      ).run();

      synced++;
    } catch (err) {
      errors.push(`Staff ${member.name}: ${err}`);
    }
  }

  return Response.json({ success: true, synced, errors });
}

async function syncSettings(env: Env, tenantId: string, settingsArray: any[]): Promise<Response> {
  if (settingsArray.length === 0) {
    return Response.json({ success: true, synced: 0, errors: [] });
  }

  const settings = settingsArray[0];

  try {
    await env.DB.prepare(`
      INSERT OR REPLACE INTO restaurant_settings (
        tenant_id, restaurant_name, currency, timezone,
        tax_enabled, service_charge_enabled
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      tenantId,
      settings.restaurant_name || settings.restaurantName,
      settings.currency || 'INR',
      settings.timezone || 'Asia/Kolkata',
      settings.tax_enabled || settings.taxEnabled ? 1 : 0,
      settings.service_charge_enabled || settings.serviceChargeEnabled ? 1 : 0
    ).run();

    return Response.json({ success: true, synced: 1, errors: [] });
  } catch (err) {
    return Response.json({
      success: false,
      synced: 0,
      errors: [`Failed to sync settings: ${err}`]
    });
  }
}

async function syncFloorPlan(env: Env, tenantId: string, floorPlanData: any[]): Promise<Response> {
  const data = floorPlanData[0] || {};
  const sections = data.sections || [];
  const tables = data.tables || [];

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
        section.sort_order || section.sortOrder || 0,
        section.active ? 1 : 0
      ).run();

      synced++;
    } catch (err) {
      errors.push(`Section ${section.name}: ${err}`);
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
        table.section_id || table.sectionId,
        table.table_number || table.tableNumber,
        table.capacity,
        table.status || 'available',
        table.x_position || table.xPosition || null,
        table.y_position || table.yPosition || null
      ).run();

      synced++;
    } catch (err) {
      errors.push(`Table ${table.table_number || table.tableNumber}: ${err}`);
    }
  }

  return Response.json({ success: true, synced, errors });
}

async function syncInventory(env: Env, tenantId: string, inventory: any[]): Promise<Response> {
  // Placeholder for inventory sync (if bar/inventory module enabled)
  return Response.json({
    success: true,
    synced: 0,
    errors: [],
    message: 'Inventory sync not yet implemented'
  });
}

// ==================== WORKER FETCH HANDLER ====================
/*
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Provisioning endpoints
    if (path.match(/^\/api\/provision\/([^/]+)$/)) {
      const tenantId = path.split('/')[3];
      if (request.method === 'POST') {
        const response = await handleProvision(request, env, tenantId);
        return new Response(response.body, {
          ...response,
          headers: { ...response.headers, ...corsHeaders },
        });
      }
    }

    if (path.match(/^\/api\/provision\/([^/]+)\/status$/)) {
      const tenantId = path.split('/')[3];
      if (request.method === 'GET') {
        const response = await handleProvisionStatus(request, env, tenantId);
        return new Response(response.body, {
          ...response,
          headers: { ...response.headers, ...corsHeaders },
        });
      }
    }

    // Unified sync endpoint
    if (path.match(/^\/api\/sync\/([^/]+)$/)) {
      const tenantId = path.split('/')[3];
      if (request.method === 'POST') {
        const response = await handleSync(request, env, tenantId);
        return new Response(response.body, {
          ...response,
          headers: { ...response.headers, ...corsHeaders },
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
*/

export {
  handleProvision,
  handleProvisionStatus,
  handleSync,
};
