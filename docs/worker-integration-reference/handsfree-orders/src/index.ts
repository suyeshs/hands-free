/**
 * HandsFree Orders Worker
 *
 * Provides:
 * - D1 database provisioning with custom schema from POS
 * - Unified data sync endpoint for SQLite → D1
 * - WebSocket connections for real-time order updates
 * - Order polling fallback
 */

export interface Env {
  // KV Namespace for tenant metadata
  TENANT_METADATA: KVNamespace;

  // Durable Object for WebSocket connections
  ORDER_SYNC: DurableObjectNamespace;

  // Environment variables
  ENVIRONMENT: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  WORKER_URL: string;

  // Secrets
  CLOUDFLARE_API_TOKEN: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, CF-Access-Client-Id, CF-Access-Client-Secret',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route requests
      if (path.startsWith('/api/provision/')) {
        const tenantId = path.split('/')[3];

        if (path.endsWith('/status')) {
          return handleProvisionStatus(request, env, tenantId, corsHeaders);
        } else {
          return handleProvision(request, env, tenantId, corsHeaders);
        }
      }

      if (path.startsWith('/api/sync/')) {
        const tenantId = path.split('/')[3];
        return handleSync(request, env, tenantId, corsHeaders);
      }

      if (path.startsWith('/api/orders/')) {
        const tenantId = path.split('/')[3];
        return handleOrders(request, env, tenantId, corsHeaders);
      }

      // WebSocket upgrade for real-time sync
      if (request.headers.get('Upgrade') === 'websocket') {
        return handleWebSocket(request, env, corsHeaders);
      }

      // Health check
      if (path === '/health' || path === '/') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'handsfree-orders',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

/**
 * Handle D1 provisioning
 * POST /api/provision/:tenantId
 */
async function handleProvision(
  request: Request,
  env: Env,
  tenantId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { databaseName, schema } = await request.json() as {
      databaseName: string;
      schema: string[];
    };

    console.log(`[D1 Provision] Starting provisioning for tenant: ${tenantId}`);
    console.log(`[D1 Provision] Database name: ${databaseName}`);
    console.log(`[D1 Provision] Schema statements: ${schema.length}`);

    let databaseId: string;
    let wasCreated = false;

    // Step 1: Check if database already exists
    const listDbResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (listDbResponse.ok) {
      const listResult = await listDbResponse.json() as any;
      const existingDb = listResult.result?.find((db: any) => db.name === databaseName);

      if (existingDb) {
        databaseId = existingDb.uuid;
        console.log(`[D1 Provision] Database already exists with ID: ${databaseId}`);
      } else {
        // Database doesn't exist, create it
        const createDbResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: databaseName,
            }),
          }
        );

        if (!createDbResponse.ok) {
          const errorText = await createDbResponse.text();
          console.error('[D1 Provision] Failed to create database:', errorText);
          throw new Error(`Failed to create D1 database: ${errorText}`);
        }

        const createDbResult = await createDbResponse.json() as any;
        databaseId = createDbResult.result.uuid;
        wasCreated = true;
        console.log(`[D1 Provision] Database created with ID: ${databaseId}`);
      }
    } else {
      const errorText = await listDbResponse.text();
      console.error('[D1 Provision] Failed to list databases:', errorText);
      throw new Error(`Failed to list D1 databases: ${errorText}`);
    }

    console.log(`[D1 Provision] Using database ID: ${databaseId} (${wasCreated ? 'newly created' : 'existing'})`);

    // Step 2: Apply schema statements one by one
    let successCount = 0;
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
          successCount++;
        } else {
          const errorText = await execResponse.text();
          console.error(`[D1 Provision] Failed to execute statement: ${statement}`, errorText);
          errors.push(`Statement failed: ${statement.substring(0, 100)}...`);
        }
      } catch (error) {
        console.error(`[D1 Provision] Error executing statement:`, error);
        errors.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`[D1 Provision] Applied ${successCount}/${schema.length} statements`);

    // Step 3: Store metadata in KV
    await env.TENANT_METADATA.put(
      `tenant:${tenantId}:d1`,
      JSON.stringify({
        provisioned: true,
        databaseId,
        databaseName,
        tableCount: successCount,
        provisionedAt: new Date().toISOString(),
        schemaVersion: '1.0',
      }),
      {
        expirationTtl: 60 * 60 * 24 * 365, // 1 year
      }
    );

    console.log(`[D1 Provision] Metadata stored for tenant: ${tenantId}`);

    return new Response(JSON.stringify({
      success: true,
      databaseId,
      databaseName,
      tableCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[D1 Provision] Provisioning failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get D1 provisioning status
 * GET /api/provision/:tenantId/status
 */
async function handleProvisionStatus(
  request: Request,
  env: Env,
  tenantId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}:d1`, 'json') as any;

    if (!metadata) {
      return new Response(JSON.stringify({
        provisioned: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      provisioned: metadata.provisioned,
      databaseId: metadata.databaseId,
      databaseName: metadata.databaseName,
      tableCount: metadata.tableCount,
      provisionedAt: metadata.provisionedAt,
      schemaVersion: metadata.schemaVersion,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[D1 Provision] Status check failed:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle unified data sync
 * POST /api/sync/:tenantId
 */
async function handleSync(
  request: Request,
  env: Env,
  tenantId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { dataType, records } = await request.json() as {
      dataType: string;
      records: any[];
    };

    console.log(`[Sync] Syncing ${dataType} for tenant ${tenantId}: ${records.length} records`);

    // Get database ID from metadata
    const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}:d1`, 'json') as any;
    if (!metadata || !metadata.provisioned) {
      return new Response(JSON.stringify({
        error: 'D1 database not provisioned for this tenant',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const databaseId = metadata.databaseId;

    // Route to appropriate sync handler
    let result;
    switch (dataType) {
      case 'sales':
        result = await syncSales(env, databaseId, records);
        break;
      case 'tips':
        result = await syncTips(env, databaseId, records);
        break;
      case 'menu':
        result = await syncMenu(env, databaseId, records);
        break;
      case 'staff':
        result = await syncStaff(env, databaseId, records);
        break;
      case 'settings':
        result = await syncSettings(env, databaseId, records);
        break;
      case 'floor-plan':
        result = await syncFloorPlan(env, databaseId, records);
        break;
      case 'inventory':
        result = await syncInventory(env, databaseId, records);
        break;
      default:
        return new Response(JSON.stringify({
          error: `Unknown data type: ${dataType}`,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Sync] Sync failed:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      synced: 0,
      failed: 0,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Helper function to execute D1 SQL via HTTP API
async function executeD1Query(env: Env, databaseId: string, sql: string, params: any[] = []): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql,
          params,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[D1 Query] Execution failed:', error);
    return false;
  }
}

// Helper function to execute D1 SELECT queries and return results via HTTP API
async function executeD1Select(env: Env, databaseId: string, sql: string, params: any[] = []): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql,
          params,
        }),
      }
    );

    if (!response.ok) {
      console.error('[D1 Select] Query failed:', await response.text());
      return [];
    }

    const result = await response.json() as any;
    return result.result?.[0]?.results || [];
  } catch (error) {
    console.error('[D1 Select] Execution failed:', error);
    return [];
  }
}

// Sync handlers for different data types
async function syncSales(env: Env, databaseId: string, records: any[]) {
  const result = { synced: 0, failed: 0, errors: [] as string[] };

  for (const record of records) {
    try {
      const success = await executeD1Query(
        env,
        databaseId,
        `INSERT OR REPLACE INTO sales_transactions
         (id, tenant_id, order_id, total_amount, payment_method, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.tenant_id,
          record.order_id,
          record.total_amount,
          record.payment_method,
          record.completed_at,
          record.created_at,
          record.updated_at,
        ]
      );

      if (success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`Sale ${record.id}: Query execution failed`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Sale ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return result;
}

async function syncTips(env: Env, databaseId: string, records: any[]) {
  const result = { synced: 0, failed: 0, errors: [] as string[] };

  for (const record of records) {
    try {
      const success = await executeD1Query(
        env,
        databaseId,
        `INSERT OR REPLACE INTO tips
         (id, tenant_id, sale_id, staff_id, amount, tip_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.tenant_id,
          record.sale_id,
          record.staff_id,
          record.amount,
          record.tip_type,
          record.created_at,
        ]
      );

      if (success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`Tip ${record.id}: Query execution failed`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Tip ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return result;
}

async function syncMenu(env: Env, databaseId: string, records: any[]) {
  const result = { synced: 0, failed: 0, errors: [] as string[] };

  // Menu sync receives [{ items: [], categories: [] }]
  for (const batch of records) {
    // Sync categories
    for (const category of batch.categories || []) {
      try {
        const success = await executeD1Query(
          env,
          databaseId,
          `INSERT OR REPLACE INTO menu_categories
           (id, tenant_id, name, display_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            category.id,
            category.tenant_id,
            category.name,
            category.display_order,
            category.created_at,
            category.updated_at,
          ]
        );

        if (success) {
          result.synced++;
        } else {
          result.failed++;
          result.errors.push(`Category ${category.id}: Query execution failed`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Category ${category.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Sync items
    for (const item of batch.items || []) {
      try {
        const success = await executeD1Query(
          env,
          databaseId,
          `INSERT OR REPLACE INTO menu_items
           (id, tenant_id, category_id, name, price, description, available, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.tenant_id,
            item.category_id,
            item.name,
            item.price,
            item.description,
            item.available ? 1 : 0,
            item.created_at,
            item.updated_at,
          ]
        );

        if (success) {
          result.synced++;
        } else {
          result.failed++;
          result.errors.push(`Item ${item.id}: Query execution failed`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Item ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  return result;
}

async function syncStaff(env: Env, databaseId: string, records: any[]) {
  const result = { synced: 0, failed: 0, errors: [] as string[] };

  for (const record of records) {
    try {
      const success = await executeD1Query(
        env,
        databaseId,
        `INSERT OR REPLACE INTO staff_users
         (id, tenant_id, name, role, pin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.tenant_id,
          record.name,
          record.role,
          record.pin,
          record.created_at,
          record.updated_at,
        ]
      );

      if (success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`Staff ${record.id}: Query execution failed`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Staff ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return result;
}

async function syncSettings(env: Env, databaseId: string, records: any[]) {
  const result = { synced: 0, failed: 0, errors: [] as string[] };

  for (const record of records) {
    try {
      const success = await executeD1Query(
        env,
        databaseId,
        `INSERT OR REPLACE INTO restaurant_settings
         (id, tenant_id, restaurant_name, address, phone, email, timezone, currency, tax_rate, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.tenant_id,
          record.restaurant_name,
          record.address,
          record.phone,
          record.email,
          record.timezone,
          record.currency,
          record.tax_rate,
          record.updated_at,
        ]
      );

      if (success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`Settings ${record.id}: Query execution failed`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Settings ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return result;
}

async function syncFloorPlan(env: Env, databaseId: string, records: any[]) {
  const result = { synced: 0, failed: 0, errors: [] as string[] };

  // Floor plan sync receives [{ sections: [], tables: [] }]
  for (const batch of records) {
    // Sync sections
    for (const section of batch.sections || []) {
      try {
        const success = await executeD1Query(
          env,
          databaseId,
          `INSERT OR REPLACE INTO floor_plan_sections
           (id, tenant_id, name, color, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            section.id,
            section.tenant_id,
            section.name,
            section.color,
            section.created_at,
            section.updated_at,
          ]
        );

        if (success) {
          result.synced++;
        } else {
          result.failed++;
          result.errors.push(`Section ${section.id}: Query execution failed`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Section ${section.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Sync tables
    for (const table of batch.tables || []) {
      try {
        const success = await executeD1Query(
          env,
          databaseId,
          `INSERT OR REPLACE INTO floor_plan_tables
           (id, tenant_id, section_id, table_number, capacity, x, y, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            table.id,
            table.tenant_id,
            table.section_id,
            table.table_number,
            table.capacity,
            table.x,
            table.y,
            table.created_at,
            table.updated_at,
          ]
        );

        if (success) {
          result.synced++;
        } else {
          result.failed++;
          result.errors.push(`Table ${table.id}: Query execution failed`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Table ${table.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  return result;
}

async function syncInventory(env: Env, databaseId: string, records: any[]) {
  const result = { synced: 0, failed: 0, errors: [] as string[] };

  // Inventory sync receives [{ items: [], recipes: [] }]
  for (const batch of records) {
    // Sync bar inventory items
    for (const item of batch.items || []) {
      try {
        const success = await executeD1Query(
          env,
          databaseId,
          `INSERT OR REPLACE INTO bar_inventory_items
           (id, tenant_id, name, category, unit, quantity, cost, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.tenant_id,
            item.name,
            item.category,
            item.unit,
            item.quantity,
            item.cost,
            item.created_at,
            item.updated_at,
          ]
        );

        if (success) {
          result.synced++;
        } else {
          result.failed++;
          result.errors.push(`Inventory ${item.id}: Query execution failed`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Inventory ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Sync bar recipes
    for (const recipe of batch.recipes || []) {
      try {
        const success = await executeD1Query(
          env,
          databaseId,
          `INSERT OR REPLACE INTO bar_recipes
           (id, tenant_id, drink_name, ingredients, instructions, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            recipe.id,
            recipe.tenant_id,
            recipe.drink_name,
            JSON.stringify(recipe.ingredients),
            recipe.instructions,
            recipe.created_at,
            recipe.updated_at,
          ]
        );

        if (success) {
          result.synced++;
        } else {
          result.failed++;
          result.errors.push(`Recipe ${recipe.id}: Query execution failed`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Recipe ${recipe.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  return result;
}

/**
 * Handle order queries
 * GET /api/orders/:tenantId
 */
async function handleOrders(
  request: Request,
  env: Env,
  tenantId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Get database ID from metadata
    const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}:d1`, 'json') as any;
    if (!metadata || !metadata.provisioned) {
      return new Response(JSON.stringify({
        error: 'D1 database not provisioned for this tenant',
        orders: [],
        count: 0,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const databaseId = metadata.databaseId;

    // Query recent orders from D1 via HTTP API
    const orders = await executeD1Select(
      env,
      databaseId,
      `SELECT * FROM sales_transactions
       WHERE tenant_id = ?
       ORDER BY completed_at DESC
       LIMIT 50`,
      [tenantId]
    );

    return new Response(JSON.stringify({
      orders,
      count: orders.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Orders] Query failed:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      orders: [],
      count: 0,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle WebSocket upgrade for real-time sync
 */
async function handleWebSocket(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');

  if (!tenantId) {
    return new Response('Missing tenantId parameter', { status: 400, headers: corsHeaders });
  }

  // Get Durable Object ID for this tenant
  const id = env.ORDER_SYNC.idFromName(tenantId);
  const stub = env.ORDER_SYNC.get(id);

  // Forward the request to the Durable Object
  return stub.fetch(request);
}

/**
 * Durable Object for WebSocket connections
 */
export class OrderSyncDurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Set<WebSocket>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();
    this.sessions.add(server);

    // Handle messages
    server.addEventListener('message', (event) => {
      console.log('[WebSocket] Message received:', event.data);

      // Broadcast to all connected clients
      this.sessions.forEach((session) => {
        if (session !== server && session.readyState === WebSocket.OPEN) {
          session.send(event.data);
        }
      });
    });

    // Handle close
    server.addEventListener('close', () => {
      this.sessions.delete(server);
      console.log('[WebSocket] Connection closed');
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}
